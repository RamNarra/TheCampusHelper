# Phase-3 (System Brain) — Permanent Invariant

Phase-3 is a **read-only intelligence layer**.

## Non-negotiable invariant

Phase-3 must **never**:

- Write to Firestore / Storage / any external service
- Call any serverless endpoints that cause mutations
- Expose serverless endpoints of its own
- Trigger messaging, grading, moderation, enrollment, scheduling, or any workflow action

Phase-3 may only:

- Read already-emitted, server-authoritative data (e.g. `domainEvents`)
- Compute deterministic, explainable insights with bounded resource usage
- Render those insights in a **read-only** UI gated to **admin or instructor**

## Design constraints

- **Observer-only**: Insights are advisory and must not change system state.
- **Deterministic**: For a given input event set + analysis `nowMs`, the output must be stable.
- **Explainable**: Every insight must include `evidenceRefs` and `invalidationConditions`.
- **Bounded**: The analyzer must cap input size (e.g. last N events) and avoid unbounded loops.

## Implementation notes

- Analyzer lives in `lib/phase3/` and must remain free of `firebase-admin` imports.
- The Insights UI lives in `pages/InsightsPage.tsx` and must not write to Firestore.
- Data sourcing is read-only: the UI reads recent `domainEvents` and runs the analyzer locally.
