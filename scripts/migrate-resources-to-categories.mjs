import * as admin from 'firebase-admin';

const SYSTEM_TYPES = new Set(['PPT', 'MidPaper', 'PYQ', 'ImpQ']);

function normalizeType(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (SYSTEM_TYPES.has(t)) return t;

  // Legacy mappings
  if (t === 'Note' || t === 'Lab Record') return 'ImpQ';

  const lower = t.toLowerCase();
  if (lower === 'mid papers' || lower === 'midpaper') return 'MidPaper';
  if (lower === 'pyqs' || lower === 'pyq') return 'PYQ';
  if (lower === 'ppts' || lower === 'ppt') return 'PPT';
  if (lower === 'important qs' || lower === 'important questions') return 'ImpQ';

  return null;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArgIdx = process.argv.findIndex((a) => a === '--limit');
  const limit = limitArgIdx >= 0 ? Number(process.argv[limitArgIdx + 1] || '0') : 0;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID for local).');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = admin.firestore();

  let updated = 0;
  let scanned = 0;

  // Scan the resources collection.
  // NOTE: We do not delete anything. We only:
  // - remove unit field (optional)
  // - normalize type into one of the system-defined categories
  // - preserve the original type in legacyType if it had to be mapped
  let q = db.collection('resources').orderBy(admin.firestore.FieldPath.documentId());
  if (limit && Number.isFinite(limit) && limit > 0) q = q.limit(limit);

  const snap = await q.get();

  // Batch writes (max 500 ops)
  let batch = db.batch();
  let batchOps = 0;

  const commitBatch = async () => {
    if (batchOps === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data() || {};

    const currentType = data.type;
    const normalized = normalizeType(currentType);

    // If already compliant AND no unit field present, skip.
    const hasUnit = Object.prototype.hasOwnProperty.call(data, 'unit');
    const isCompliantType = SYSTEM_TYPES.has(String(currentType || '').trim());

    if (!hasUnit && isCompliantType) continue;

    const patch = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (hasUnit) {
      // Remove unit field
      patch.unit = admin.firestore.FieldValue.delete();
    }

    if (normalized && !isCompliantType) {
      patch.type = normalized;
      patch.legacyType = String(currentType || '').trim() || null;
    }

    // If type is unknown, don't clobber it; still remove unit.
    if (!normalized && hasUnit) {
      patch.legacyType = String(currentType || '').trim() || null;
    }

    if (Object.keys(patch).length > 1) {
      batch.update(doc.ref, patch);
      batchOps += 1;
      updated += 1;
    }

    if (batchOps >= 450) await commitBatch();
  }

  await commitBatch();

  console.log(JSON.stringify({ dryRun, scanned, updated }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
