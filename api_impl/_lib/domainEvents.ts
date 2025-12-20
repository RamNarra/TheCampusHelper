import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdminApp } from './firebaseAdmin';

export type DomainAggregate = {
  kind: 'course' | 'streamPost' | 'assignment' | 'submission' | 'test' | 'attempt' | 'grade' | 'gradebook';
  id: string;
  version?: number;
};

export async function emitDomainEvent(params: {
  type: string;
  courseId: string;
  actorUid: string;
  actorRole: string;
  aggregate: DomainAggregate;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  requestId?: string;
}) {
  const admin = ensureFirebaseAdminApp();
  const db = admin.firestore();

  const id = crypto.createHash('sha256').update(params.idempotencyKey).digest('hex');
  const ref = db.collection('domainEvents').doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;

    tx.create(ref, {
      type: params.type,
      courseId: params.courseId,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      aggregate: params.aggregate,
      payload: params.payload ?? {},
      idempotencyKey: params.idempotencyKey,
      requestId: params.requestId ?? null,
      occurredAt: FieldValue.serverTimestamp(),
    });
  });

  return { eventId: id };
}
