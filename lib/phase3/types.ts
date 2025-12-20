export type Phase3Scope =
  | { type: 'course'; courseId: string }
  | { type: 'user'; userId: string; courseId: string };

export type Phase3EvidenceRef = string;

export type Phase3Insight = {
  insightType: string;
  scope: Phase3Scope;
  whyGenerated: string;
  evidenceRefs: Phase3EvidenceRef[];
  confidence: number; // 0..1
  invalidationConditions: string;
};

export type DomainAggregate = {
  kind: 'course' | 'streamPost' | 'assignment' | 'submission' | 'test' | 'attempt' | 'grade' | 'gradebook';
  id: string;
  version?: number;
};

export type DomainEventForAnalysis = {
  eventId?: string;
  type: string;
  courseId: string;
  actorUid: string;
  actorRole: string;
  aggregate: DomainAggregate;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  requestId?: string | null;
  // ISO timestamp string.
  occurredAt: string;
};
