import crypto from 'crypto';
import { analyzePhase3DomainEvents, normalizeInsightsForUi } from '../lib/phase3/analyzer';

/**
 * Phase-3 System Brain (DEV)
 * - No Firestore access required
 * - No endpoints, no UI, no writes
 * - Generates SIMULATED domainEvents matching api/_lib/domainEvents.ts schema
 * - Runs a conservative analyzer over ONLY those events
 *
 * Run:
 *   node scripts/phase3-simulate-and-analyze.mjs
 */

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function seededRng(seedStr) {
  // deterministic RNG: sha256(seed) -> uint32; mulberry32
  const h = crypto.createHash('sha256').update(seedStr).digest();
  let seed = h.readUInt32LE(0);
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeEvent({
  type,
  courseId,
  actorUid,
  actorRole,
  aggregate,
  payload,
  idempotencyKey,
  requestId,
  occurredAtIso,
}) {
  const eventId = sha256Hex(idempotencyKey);
  return {
    eventId,
    type,
    courseId,
    actorUid,
    actorRole,
    aggregate,
    payload: payload ?? {},
    idempotencyKey,
    requestId: requestId ?? null,
    occurredAt: occurredAtIso,
    __simulated: true,
  };
}

function simulateDomainEvents({ nowMs = Date.now(), seed = 'phase3-dev-sim-v1' } = {}) {
  const rng = seededRng(seed);

  // Two courses, a few users. Keep it small but expressive.
  const courses = [
    { courseId: 'course_cs101', instructorUid: 'u_instructor_1', name: 'CS101' },
    { courseId: 'course_math201', instructorUid: 'u_instructor_2', name: 'MATH201' },
  ];
  const students = ['u_student_a', 'u_student_b', 'u_student_c', 'u_student_d'];

  const t0 = nowMs - 7 * 24 * 60 * 60 * 1000; // 7d ago

  const events = [];
  let reqCounter = 1;

  function reqId() {
    return `sim-req-${reqCounter++}`;
  }

  // Assignments published in each course (2 per course to enable longitudinal patterns)
  for (const c of courses) {
    for (let aIdx = 1; aIdx <= 2; aIdx++) {
      const assignmentId = `a_${c.courseId}_${aIdx}`;
      const version = 2;
      const dueMillis =
        t0 +
        (2 + aIdx) * 24 * 60 * 60 * 1000 +
        Math.floor(rng() * 3 * 60 * 60 * 1000);

      events.push(
        makeEvent({
          type: 'assignment.published',
          courseId: c.courseId,
          actorUid: c.instructorUid,
          actorRole: 'instructor',
          aggregate: { kind: 'assignment', id: assignmentId, version },
          payload: { courseId: c.courseId, assignmentId, version, calendarEventId: `cal_${assignmentId}` },
          idempotencyKey: `assignment.published:${c.courseId}:${assignmentId}:v${version}`,
          requestId: reqId(),
          occurredAtIso: iso(t0 + aIdx * 60 * 60 * 1000),
        })
      );

      // Submissions (some late)
      for (const s of students) {
        // Force a repeated-late pattern for one student in CS101.
        const forcedLate = c.courseId === 'course_cs101' && s === 'u_student_a';
        const isLate = forcedLate || rng() < (c.courseId === 'course_cs101' ? 0.25 : 0.12);
        const submitAt =
          dueMillis + (isLate ? (2 + Math.floor(rng() * 48)) * 60 * 60 * 1000 : -1 * 60 * 60 * 1000);

        events.push(
          makeEvent({
            type: 'submission.submitted',
            courseId: c.courseId,
            actorUid: s,
            actorRole: 'student',
            aggregate: { kind: 'submission', id: `${assignmentId}:${s}`, version },
            payload: { courseId: c.courseId, assignmentId, studentId: s, assignmentVersionAtSubmission: version },
            idempotencyKey: `submission.submitted:${c.courseId}:${assignmentId}:${s}:v${version}`,
            requestId: reqId(),
            occurredAtIso: iso(submitAt),
          })
        );

        if (isLate) {
          // Represent late-ness as its own domain signal (Phase-3 simulation requirement)
          events.push(
            makeEvent({
              type: 'submission.late',
              courseId: c.courseId,
              actorUid: s,
              actorRole: 'student',
              aggregate: { kind: 'submission', id: `${assignmentId}:${s}`, version },
              payload: {
                courseId: c.courseId,
                assignmentId,
                studentId: s,
                dueMillis,
                submittedAtMillis: submitAt,
                lateByHours: Math.max(1, Math.round((submitAt - dueMillis) / (60 * 60 * 1000))),
              },
              idempotencyKey: `submission.late:${c.courseId}:${assignmentId}:${s}:v${version}:${submitAt}`,
              requestId: reqId(),
              occurredAtIso: iso(submitAt + 5 * 1000),
            })
          );
        }
      }

      // Instructor grades a subset; create grade.mutated events
      for (const s of students) {
        if (rng() < 0.75) {
          const pointsPossible = 100;
          const score = Math.round(pointsPossible * (0.5 + rng() * 0.5));
          const gradeRevision = 1;
          const gradeId = `assignment_${assignmentId}_${s}`;

          events.push(
            makeEvent({
              type: 'grade.mutated',
              courseId: c.courseId,
              actorUid: c.instructorUid,
              actorRole: 'instructor',
              aggregate: { kind: 'grade', id: gradeId, version: gradeRevision },
              payload: {
                courseId: c.courseId,
                sourceType: 'assignment',
                sourceId: assignmentId,
                studentId: s,
                before: { score: null, gradeRevision: 0 },
                after: { score, gradeRevision },
                pointsPossible,
              },
              idempotencyKey: `grade.mutated:assignment:${c.courseId}:${assignmentId}:${s}:r${gradeRevision}`,
              requestId: reqId(),
              occurredAtIso: iso(dueMillis + 2 * 24 * 60 * 60 * 1000 + Math.floor(rng() * 8 * 60 * 60 * 1000)),
            })
          );
        }
      }
    }

    // Gradebook recompute to simulate integrity repair and drift detection
    // Force one suspicious drift on CS101.
    const flagged = c.courseId === 'course_cs101' && rng() < 0.9;
    const deltaTotalScore = flagged ? 5 + Math.floor(rng() * 10) : Math.floor(rng() * 2);
    const deltaTotalPossible = 0;
    const recomputeStudentId = pick(rng, students);

    events.push(
      makeEvent({
        type: 'gradebook.student.recomputed',
        courseId: c.courseId,
        actorUid: c.instructorUid,
        actorRole: 'instructor',
        aggregate: { kind: 'gradebook', id: recomputeStudentId },
        payload: {
          courseId: c.courseId,
          studentId: recomputeStudentId,
          totalScore: 250,
          totalPossible: 300,
          reason: 'periodic_reconcile',
          deltaTotalScore,
          deltaTotalPossible,
          driftFlagged: flagged,
        },
        idempotencyKey: `gradebook.student.recomputed:${c.courseId}:${recomputeStudentId}:250:300`,
        requestId: reqId(),
        occurredAtIso: iso(nowMs - 6 * 60 * 60 * 1000),
      })
    );

    // Include the required event type name from the execution spec.
    events.push(
      makeEvent({
        type: 'gradebook.recomputed',
        courseId: c.courseId,
        actorUid: c.instructorUid,
        actorRole: 'instructor',
        aggregate: { kind: 'gradebook', id: recomputeStudentId },
        payload: {
          courseId: c.courseId,
          studentId: recomputeStudentId,
          note: 'SIMULATION: alias of gradebook.student.recomputed for spec coverage',
        },
        idempotencyKey: `gradebook.recomputed:${c.courseId}:${recomputeStudentId}:${nowMs}`,
        requestId: reqId(),
        occurredAtIso: iso(nowMs - 6 * 60 * 60 * 1000 + 1000),
      })
    );
  }

  // Tests attempts started/submitted (include some high-velocity starts)
  for (const c of courses) {
    const testId = `t_${c.courseId}_1`;
    const testVersion = 1;

    // 1-2 attempts per student
    for (const s of students) {
      const attemptCount = 1 + (rng() < 0.25 ? 1 : 0);
      for (let i = 1; i <= attemptCount; i++) {
        const attemptId = `${s}__${i}`;
        const startedAt = nowMs - (48 - Math.floor(rng() * 24)) * 60 * 60 * 1000;
        const submitted = rng() < 0.85;

        events.push(
          makeEvent({
            type: 'test.attempt.started',
            courseId: c.courseId,
            actorUid: s,
            actorRole: 'student',
            aggregate: { kind: 'attempt', id: attemptId, version: testVersion },
            payload: { courseId: c.courseId, testId, attemptId, attemptNo: i, testVersion },
            idempotencyKey: `test.attempt.started:${c.courseId}:${testId}:${attemptId}:v${testVersion}`,
            requestId: reqId(),
            occurredAtIso: iso(startedAt),
          })
        );

        if (submitted) {
          const score = 10 + Math.floor(rng() * 11);
          events.push(
            makeEvent({
              type: 'test.attempt.submitted',
              courseId: c.courseId,
              actorUid: s,
              actorRole: 'student',
              aggregate: { kind: 'attempt', id: attemptId, version: testVersion },
              payload: { courseId: c.courseId, testId, attemptId, testVersion, score },
              idempotencyKey: `test.attempt.submitted:${c.courseId}:${testId}:${attemptId}:v${testVersion}`,
              requestId: reqId(),
              occurredAtIso: iso(startedAt + (15 + Math.floor(rng() * 40)) * 60 * 1000),
            })
          );
        }
      }
    }

    // Clustered starts (overload risk) in CS101
    if (c.courseId === 'course_cs101') {
      const burstBase = nowMs - 45 * 60 * 1000;
      for (let k = 0; k < 18; k++) {
        const s = pick(rng, students);
        const attemptId = `${s}__burst_${k}`;
        events.push(
          makeEvent({
            type: 'test.attempt.started',
            courseId: c.courseId,
            actorUid: s,
            actorRole: 'student',
            aggregate: { kind: 'attempt', id: attemptId, version: testVersion },
            payload: { courseId: c.courseId, testId, attemptId, attemptNo: 99, testVersion },
            idempotencyKey: `test.attempt.started:${c.courseId}:${testId}:${attemptId}:v${testVersion}`,
            requestId: reqId(),
            occurredAtIso: iso(burstBase + k * 60 * 1000),
          })
        );
      }
    }
  }

  // Sort by occurredAt (helps analysis)
  events.sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)));

  return events;
}

function analyzePhase3(events) {
  // Delegated to shared TS analyzer to keep Phase-3 logic consistent.
  // This script remains DEV-only and generates SIMULATED inputs.
  return normalizeInsightsForUi(analyzePhase3DomainEvents(events, { nowMs: Date.now() }));
}

function buildHumanReport(insights, events) {
  const lines = [];
  lines.push('SIMULATED PHASE-3 OUTPUT (DEV)');
  lines.push('');
  lines.push(`Simulated domainEvents analyzed: ${events.length}`);
  lines.push(`Insights generated: ${insights.length}`);
  lines.push('');

  const informational = insights.filter((i) => i.confidence < 0.4);
  if (informational.length) {
    lines.push(`Informational-only insights (confidence < 0.4): ${informational.length}`);
  }

  const top = [...insights].sort((a, b) => b.confidence - a.confidence).slice(0, 6);
  lines.push('');
  lines.push('Key detections:');
  for (const i of top) {
    const scope = i.scope.type === 'course' ? `course=${i.scope.courseId}` : `user=${i.scope.userId} course=${i.scope.courseId}`;
    const tag = i.confidence < 0.4 ? ' (informational only)' : '';
    lines.push(`- ${i.insightType} [${scope}] conf=${i.confidence.toFixed(2)}${tag}`);
  }

  lines.push('');
  lines.push('Recommended next best actions (advisory only; no direct messaging):');
  // Map insight -> conservative action
  for (const i of top) {
    if (i.insightType === 'overload_risk.test_attempt_burst') {
      lines.push('- Verify scheduled exam timing vs. burst; check function latency/error budgets; pre-warm/scale where applicable.');
    } else if (i.insightType === 'risk.student_late_submission_pattern') {
      lines.push('- Instructor/staff review: consider outreach via existing human workflows; validate whether accommodations apply.');
    } else if (i.insightType === 'integrity.gradebook_drift_flagged') {
      lines.push('- Instructor/staff audit: inspect recent grade mutations for the student; run targeted recompute and reconcile.');
    } else if (i.insightType === 'risk.test_attempt_dropoff') {
      lines.push('- Check whether students are starting but failing to submit (timeouts, confusion); review attempt expiry/window UX and server logs.');
    } else {
      lines.push('- Review evidenceRefs and confirm whether intervention is needed.');
    }
  }

  lines.push('');
  lines.push('PRODUCTION PHASE-3 BEHAVIOR (WHEN LIVE EVENTS ARE AVAILABLE)');
  lines.push('');
  lines.push('- Replace simulated events with Firestore reads from domainEvents (read-only).');
  lines.push('- Run identical analysis logic; emit aiInsights to logs or a separate read-optimized store (still no grade/test mutations).');

  return lines.join('\n');
}

function main() {
  // Step 1: detect constraints (by construction: no creds)
  const constraints = {
    firebaseAdminCredentialsPresent: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
    firestoreReadable: false,
  };

  // Step 2: bootstrap simulation layer
  const simulatedEvents = simulateDomainEvents({
    nowMs: Date.now(),
    seed: 'phase3-dev-sim-2025-12-20',
  });

  // Step 3: run System Brain
  const aiInsights = analyzePhase3(simulatedEvents).map((i) => {
    const confidence = Number(i.confidence.toFixed(2));
    const informationalOnly = confidence < 0.4;
    return {
      insightType: i.insightType,
      scope: i.scope,
      whyGenerated: informationalOnly ? `INFORMATIONAL ONLY: ${i.whyGenerated}` : i.whyGenerated,
      evidenceRefs: i.evidenceRefs,
      confidence,
      invalidationConditions: i.invalidationConditions,
    };
  });

  // Step 4: output final form
  const report = buildHumanReport(aiInsights, simulatedEvents);

  const output = {
    meta: {
      mode: 'SIMULATION_ONLY_DEV',
      constraints,
      simulatedEvents: true,
      generatedAt: new Date().toISOString(),
    },
    aiInsights,
    report,
  };

  // Print JSON first (machine readable), then report.
  process.stdout.write(JSON.stringify(output.aiInsights, null, 2));
  process.stdout.write('\n\n');
  process.stdout.write(report);
  process.stdout.write('\n');
}

main();
