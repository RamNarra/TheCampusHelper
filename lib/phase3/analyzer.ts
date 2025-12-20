import type { DomainEventForAnalysis, Phase3Insight } from './types';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeParseMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function analyzePhase3DomainEvents(
  events: DomainEventForAnalysis[],
  opts: { nowMs: number }
): Phase3Insight[] {
  // Phase-3 invariant: observer-only, no writes.
  // Conservative heuristics; every insight cites evidenceRefs.

  const nowMs = opts.nowMs;

  // Bounded analysis: cap number of events consumed.
  const boundedEvents = events.slice(-250);

  // Index by course
  const byCourse = new Map<string, DomainEventForAnalysis[]>();
  for (const ev of boundedEvents) {
    const list = byCourse.get(ev.courseId) ?? [];
    list.push(ev);
    byCourse.set(ev.courseId, list);
  }

  const insights: Phase3Insight[] = [];

  // 1) Overload risk: burst of test.attempt.started
  for (const [courseId, evs] of byCourse.entries()) {
    const starts = evs.filter((e) => e.type === 'test.attempt.started');
    if (starts.length < 8) continue;

    const times = starts
      .map((e) => safeParseMs(e.occurredAt))
      .filter((t): t is number => typeof t === 'number')
      .sort((a, b) => a - b);

    let maxInHour = 0;
    let bestStartIdx = 0;

    for (let i = 0; i < times.length; i++) {
      const windowStart = times[i];
      const windowEnd = windowStart + 60 * 60 * 1000;
      let j = i;
      while (j < times.length && times[j] <= windowEnd) j++;
      const count = j - i;
      if (count > maxInHour) {
        maxInHour = count;
        bestStartIdx = i;
      }
    }

    if (maxInHour >= 15) {
      const windowStart = times[bestStartIdx];
      const windowEnd = windowStart + 60 * 60 * 1000;

      const evidence = starts
        .filter((e) => {
          const t = safeParseMs(e.occurredAt);
          return typeof t === 'number' && t >= windowStart && t <= windowEnd;
        })
        .slice(0, 25)
        .map((e) => e.eventId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const confidence = clamp01(0.55 + Math.min(0.35, (maxInHour - 15) * 0.02));

      insights.push({
        insightType: 'overload_risk.test_attempt_burst',
        scope: { type: 'course', courseId },
        whyGenerated: `Detected high volume of test attempt starts within 60 minutes (maxInHour=${maxInHour}). This can indicate load spikes and degraded availability risk.`,
        evidenceRefs: evidence,
        confidence,
        invalidationConditions:
          'If the burst is expected (e.g., scheduled exam start) AND infrastructure error rates remain normal, this risk may be overestimated.',
      });
    }
  }

  // 2) Student risk: repeated lateness signals
  const lateByStudentCourse = new Map<string, DomainEventForAnalysis[]>();
  for (const ev of boundedEvents) {
    if (ev.type !== 'submission.late') continue;
    const studentId = ev.payload?.studentId;
    if (typeof studentId !== 'string') continue;
    const key = `${ev.courseId}::${studentId}`;
    const list = lateByStudentCourse.get(key) ?? [];
    list.push(ev);
    lateByStudentCourse.set(key, list);
  }

  for (const [key, lates] of lateByStudentCourse.entries()) {
    if (lates.length < 2) continue;
    const [courseId, studentId] = key.split('::');

    const lateHours = lates
      .map((e) => Number(e.payload?.lateByHours ?? NaN))
      .filter((n) => Number.isFinite(n));
    const avgLateHours = lateHours.length ? lateHours.reduce((a, b) => a + b, 0) / lateHours.length : NaN;

    const evidence = lates
      .map((e) => e.eventId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const confidence = clamp01(0.45 + Math.min(0.4, (lates.length - 2) * 0.15));

    insights.push({
      insightType: 'risk.student_late_submission_pattern',
      scope: { type: 'user', userId: studentId, courseId },
      whyGenerated: `Multiple late submission signals detected (count=${lates.length}, avgLateHours≈${Number.isFinite(avgLateHours) ? avgLateHours.toFixed(1) : 'unknown'}). Pattern may indicate workload overload or disengagement risk.`,
      evidenceRefs: evidence,
      confidence,
      invalidationConditions:
        'If later events show on-time submissions OR accommodations/extended deadlines (not present in events), this pattern may not reflect risk.',
    });
  }

  // 3) Integrity/inconsistency risk: gradebook recompute with driftFlagged
  for (const ev of boundedEvents) {
    if (ev.type !== 'gradebook.student.recomputed') continue;
    if (ev.payload?.driftFlagged !== true) continue;
    const studentId = ev.payload?.studentId;
    if (typeof studentId !== 'string') continue;

    const deltaScore = Number(ev.payload?.deltaTotalScore ?? NaN);
    const deltaPossible = Number(ev.payload?.deltaTotalPossible ?? NaN);

    const confidence = clamp01(0.6 + (Number.isFinite(deltaScore) ? Math.min(0.25, Math.abs(deltaScore) / 40) : 0));
    const evidence = typeof ev.eventId === 'string' && ev.eventId.length > 0 ? [ev.eventId] : [];

    insights.push({
      insightType: 'integrity.gradebook_drift_flagged',
      scope: { type: 'user', userId: studentId, courseId: ev.courseId },
      whyGenerated: `Gradebook recompute reported driftFlagged=true (deltaTotalScore=${Number.isFinite(deltaScore) ? deltaScore : 'unknown'}, deltaTotalPossible=${Number.isFinite(deltaPossible) ? deltaPossible : 'unknown'}). This can indicate prior inconsistency between grades and gradebook aggregate.`,
      evidenceRefs: evidence,
      confidence,
      invalidationConditions:
        'If subsequent recompute events show driftFlagged=false with stable totals OR if drift is explained by a legitimate late-added grade (not visible in events), this concern may be reduced.',
    });
  }

  // 4) Assessment friction: attempts started but not submitted after 12h
  const attemptsStarted = new Map<string, DomainEventForAnalysis>();
  const attemptsSubmitted = new Set<string>();

  for (const ev of boundedEvents) {
    if (ev.type === 'test.attempt.started') {
      const attemptId = ev.payload?.attemptId;
      if (typeof attemptId === 'string') attemptsStarted.set(`${ev.courseId}::${attemptId}`, ev);
    }
    if (ev.type === 'test.attempt.submitted') {
      const attemptId = ev.payload?.attemptId;
      if (typeof attemptId === 'string') attemptsSubmitted.add(`${ev.courseId}::${attemptId}`);
    }
  }

  const staleStarts: DomainEventForAnalysis[] = [];
  for (const [key, ev] of attemptsStarted.entries()) {
    if (attemptsSubmitted.has(key)) continue;
    const t = safeParseMs(ev.occurredAt);
    if (typeof t !== 'number') continue;
    if (nowMs - t > 12 * 60 * 60 * 1000) staleStarts.push(ev);
  }

  if (staleStarts.length >= 4) {
    const byCourseStale = new Map<string, DomainEventForAnalysis[]>();
    for (const ev of staleStarts) {
      const list = byCourseStale.get(ev.courseId) ?? [];
      list.push(ev);
      byCourseStale.set(ev.courseId, list);
    }

    for (const [courseId, evs] of byCourseStale.entries()) {
      if (evs.length < 4) continue;

      const confidence = clamp01(0.4 + Math.min(0.35, (evs.length - 4) * 0.05));
      const evidence = evs
        .slice(0, 25)
        .map((e) => e.eventId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      insights.push({
        insightType: 'risk.test_attempt_dropoff',
        scope: { type: 'course', courseId },
        whyGenerated: `Detected attempts started without corresponding submission after 12h (count=${evs.length}). Could indicate UX friction, window confusion, or platform reliability issues.`,
        evidenceRefs: evidence,
        confidence,
        invalidationConditions:
          'If later events show delayed submissions for these attempts OR if the test is practice-only with no submission requirement, this signal may be a false positive.',
      });
    }
  }

  // Explainability rule: all insights must have evidence.
  return insights.filter((i) => Array.isArray(i.evidenceRefs) && i.evidenceRefs.length > 0);
}

export function normalizeInsightsForUi(insights: Phase3Insight[]): Phase3Insight[] {
  // UI helper: enforce informational-only label for low confidence.
  return insights.map((i) => {
    const confidence = Number(i.confidence.toFixed(2));
    const informationalOnly = confidence < 0.4;
    return {
      ...i,
      confidence,
      whyGenerated: informationalOnly && !i.whyGenerated.startsWith('INFORMATIONAL ONLY:')
        ? `INFORMATIONAL ONLY: ${i.whyGenerated}`
        : i.whyGenerated,
    };
  });
}
