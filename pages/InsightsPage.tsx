import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';
import { getDb } from '../services/platform/firebaseClient';
import type { DomainEventForAnalysis } from '../lib/phase3/types';
import { analyzePhase3DomainEvents, normalizeInsightsForUi } from '../lib/phase3/analyzer';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function toIso(occurredAt: unknown): string {
  if (occurredAt instanceof Timestamp) return occurredAt.toDate().toISOString();
  if (occurredAt instanceof Date) return occurredAt.toISOString();
  if (typeof occurredAt === 'string') return occurredAt;
  if (typeof occurredAt === 'number') return new Date(occurredAt).toISOString();
  return new Date(0).toISOString();
}

const InsightsPage: React.FC = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  const canView = !!user && (role === 'instructor' || isAtLeastRole(role, 'admin'));
  if (!canView) return <Navigate to="/" replace />;

  const [state, setState] = useState<LoadState>('idle');
  const [events, setEvents] = useState<DomainEventForAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setState('loading');
      setError(null);

      const db = getDb();
      if (!db) {
        setState('error');
        setError('Firebase is not configured in this environment.');
        return;
      }

      try {
        const q = query(collection(db, 'domainEvents'), orderBy('occurredAt', 'desc'), limit(200));
        const snap = await getDocs(q);

        const list: DomainEventForAnalysis[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              eventId: d.id,
              type: String(data.type || ''),
              courseId: String(data.courseId || ''),
              actorUid: String(data.actorUid || ''),
              actorRole: String(data.actorRole || ''),
              aggregate: (data.aggregate || { kind: 'course', id: 'unknown' }) as any,
              payload: (data.payload || {}) as any,
              idempotencyKey: String(data.idempotencyKey || ''),
              requestId: (data.requestId ?? null) as any,
              occurredAt: toIso(data.occurredAt),
            };
          })
          .filter((e) => e.type && e.courseId && e.actorUid && e.idempotencyKey);

        // Analyzer expects chronological-ish inputs (older -> newer) for density windows.
        list.sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)));

        setEvents(list);
        setState('loaded');
      } catch (e: any) {
        setState('error');
        setError(e?.message || 'Failed to load domain events.');
      }
    };

    run();
  }, []);

  const insights = useMemo(() => {
    const nowMs = Date.now();
    return normalizeInsightsForUi(analyzePhase3DomainEvents(events, { nowMs }));
  }, [events]);

  return (
    <div className="flex-grow bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Insights</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Phase-3 (observer-only): read-only insights derived from recent domain events.
            </p>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            <div>Events: {events.length}</div>
            <div>Insights: {insights.length}</div>
          </div>
        </div>

        {state === 'loading' && (
          <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
            Loading domain events…
          </div>
        )}

        {state === 'error' && (
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-sm">
            {error || 'Something went wrong.'}
          </div>
        )}

        {state === 'loaded' && insights.length === 0 && (
          <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
            No insights generated from the current window.
          </div>
        )}

        {insights.length > 0 && (
          <div className="space-y-3">
            {insights
              .slice()
              .sort((a, b) => b.confidence - a.confidence)
              .map((i) => {
                const scope = i.scope.type === 'course'
                  ? `course=${i.scope.courseId}`
                  : `user=${i.scope.userId} course=${i.scope.courseId}`;

                return (
                  <div key={`${i.insightType}:${scope}:${i.evidenceRefs[0] ?? 'e'}`} className="p-4 rounded-xl border border-border bg-background">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{i.insightType}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{scope}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">conf={i.confidence.toFixed(2)}</div>
                    </div>

                    <p className="text-sm mt-3">{i.whyGenerated}</p>

                    <div className="mt-3 text-xs text-muted-foreground">
                      <div>Evidence refs: {i.evidenceRefs.slice(0, 6).join(', ')}{i.evidenceRefs.length > 6 ? '…' : ''}</div>
                      <div className="mt-1">Invalidation: {i.invalidationConditions}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsPage;
