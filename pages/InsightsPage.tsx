import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { AlertTriangle, Activity, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';
import { getDb } from '../services/platform/firebaseClient';
import type { DomainEventForAnalysis } from '../lib/phase3/types';
import { analyzePhase3DomainEvents, normalizeInsightsForUi } from '../lib/phase3/analyzer';

import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function toIso(occurredAt: unknown): string {
  if (occurredAt instanceof Timestamp) return occurredAt.toDate().toISOString();
  if (occurredAt instanceof Date) return occurredAt.toISOString();
  if (typeof occurredAt === 'string') return occurredAt;
  if (typeof occurredAt === 'number') return new Date(occurredAt).toISOString();
  return new Date(0).toISOString();
}

function formatInsightType(insightType: string): { title: string; group: string } {
  const raw = String(insightType || '').trim();
  if (!raw) return { title: 'Insight', group: 'insight' };
  const [group, rest] = raw.includes('.') ? raw.split('.', 2) : ['insight', raw];
  const prettify = (s: string) =>
    s
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const groupLabel = prettify(group);
  const restLabel = prettify(rest);
  const title = restLabel ? `${groupLabel} · ${restLabel}` : groupLabel;
  return { title: title.replace(/^\w/, (c) => c.toUpperCase()), group };
}

function severityFromGroup(group: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const g = String(group || '').toLowerCase();
  if (g.includes('integrity')) return { label: 'High', variant: 'destructive' };
  if (g.includes('overload')) return { label: 'Medium', variant: 'secondary' };
  if (g.includes('risk')) return { label: 'Medium', variant: 'secondary' };
  return { label: 'Low', variant: 'outline' };
}

function confidenceLabel(confidence: number): { label: string; tone: 'good' | 'mid' | 'low' } {
  const c = Number.isFinite(confidence) ? confidence : 0;
  if (c >= 0.75) return { label: 'High confidence', tone: 'good' };
  if (c >= 0.5) return { label: 'Medium confidence', tone: 'mid' };
  return { label: 'Low confidence', tone: 'low' };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function ConfidenceBar({ value }: { value: number }) {
  const v = clamp01(value);
  const meta = confidenceLabel(v);
  const fillClass =
    meta.tone === 'good'
      ? 'bg-primary'
      : meta.tone === 'mid'
        ? 'bg-secondary'
        : 'bg-muted-foreground';

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        <div className={`h-full ${fillClass}`} style={{ width: `${Math.round(v * 100)}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">{Math.round(v * 100)}%</div>
    </div>
  );
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

  const topInsights = useMemo(() => {
    return insights
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50);
  }, [insights]);

  return (
    <div className="flex-grow bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Insights</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Phase-3 (observer-only): read-only insights derived from recent domain events.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">Events: {events.length}</Badge>
            <Badge variant="outline">Insights: {insights.length}</Badge>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">Analysis window</div>
              <div className="mt-1 text-lg font-semibold">Latest 200 events</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Deterministic, append-only observer of domain events.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">Ordering</div>
              <div className="mt-1 text-lg font-semibold">By confidence</div>
              <div className="mt-2 text-sm text-muted-foreground">Highest confidence signals first.</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">Safety</div>
              <div className="mt-1 text-lg font-semibold">No writes</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Insights never mutate data; they only explain observed patterns.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* States */}
        {state === 'loading' && (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx}>
                <CardContent className="p-5">
                  <div className="h-4 w-2/3 bg-muted rounded" />
                  <div className="mt-3 h-3 w-1/2 bg-muted rounded" />
                  <div className="mt-5 space-y-2">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-5/6 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {state === 'error' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="p-5 pb-0">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div className="font-semibold">Failed to load insights</div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{error || 'Something went wrong.'}</div>
            </CardContent>
          </Card>
        )}

        {state === 'loaded' && insights.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-lg font-semibold">No insights yet</div>
              <div className="mt-2 text-sm text-muted-foreground">
                No insights were generated from the current event window.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {state === 'loaded' && insights.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
            <div className="space-y-4">
              {topInsights.map((i) => {
                const scopeText =
                  i.scope.type === 'course'
                    ? `course=${i.scope.courseId}`
                    : `user=${i.scope.userId} course=${i.scope.courseId}`;

                const meta = formatInsightType(i.insightType);
                const sev = severityFromGroup(meta.group);
                const key = `${i.insightType}:${scopeText}:${i.evidenceRefs[0] ?? 'e'}`;

                return (
                  <div key={key} className="relative">
                    {/* left rail */}
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border hidden sm:block" aria-hidden="true" />
                    <div className="flex gap-4">
                      <div className="hidden sm:flex w-6 justify-center pt-6">
                        <div className="h-3 w-3 rounded-full bg-primary/70 ring-4 ring-primary/10" aria-hidden="true" />
                      </div>

                      <Card className="flex-1">
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm sm:text-base font-semibold">{meta.title}</div>
                                <Badge variant={sev.variant}>Severity: {sev.label}</Badge>
                                <Badge variant="outline">{scopeText}</Badge>
                              </div>
                              <div className="text-sm text-foreground/90">{i.whyGenerated}</div>
                            </div>

                            <div className="shrink-0">
                              <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                              <ConfidenceBar value={i.confidence} />
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                            <div className="text-xs font-medium text-muted-foreground">Invalidation conditions</div>
                            <div className="mt-1 text-sm text-muted-foreground">{i.invalidationConditions}</div>
                          </div>

                          <details className="mt-4 group">
                            <summary className="cursor-pointer list-none select-none">
                              <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                                <div className="text-sm font-medium">Evidence ({i.evidenceRefs.length})</div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                              </div>
                            </summary>

                            <div className="mt-3 grid gap-2">
                              {i.evidenceRefs.slice(0, 50).map((ref) => (
                                <div
                                  key={ref}
                                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground font-mono break-all"
                                >
                                  {ref}
                                </div>
                              ))}
                              {i.evidenceRefs.length > 50 ? (
                                <div className="text-xs text-muted-foreground">Showing first 50 evidence refs.</div>
                              ) : null}
                            </div>
                          </details>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column: quick legend */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-5">
                  <div className="text-sm font-semibold">Legend</div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Integrity</span>
                      <Badge variant="destructive">High</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Overload / Risk</span>
                      <Badge variant="secondary">Medium</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Other</span>
                      <Badge variant="outline">Low</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="text-sm font-semibold">Notes</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    This page is read-only and derived from `domainEvents`. Use evidence refs to correlate with audits.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsPage;
