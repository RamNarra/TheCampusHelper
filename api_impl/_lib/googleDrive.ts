type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
};

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function getDriveApiKey(): string | null {
  const key = process.env.DRIVE_API_KEY;
  return isNonEmpty(key) ? key.trim() : null;
}

function toDriveFile(raw: any): DriveFile | null {
  const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  const mimeType = typeof raw?.mimeType === 'string' ? raw.mimeType.trim() : '';
  if (!id || !name || !mimeType) return null;
  const out: DriveFile = { id, name, mimeType };
  if (typeof raw?.size === 'string' && raw.size.trim()) out.size = raw.size.trim();
  if (typeof raw?.modifiedTime === 'string' && raw.modifiedTime.trim()) out.modifiedTime = raw.modifiedTime.trim();
  return out;
}

export async function listDriveFolderFiles(params: {
  folderId: string;
  apiKey: string;
  pageSize?: number;
  maxFiles?: number;
  includeGoogleDocs?: boolean;
  timeoutMs?: number;
}): Promise<DriveFile[]> {
  const folderId = (params.folderId || '').trim();
  if (!folderId) throw new Error('Missing folderId');

  const apiKey = (params.apiKey || '').trim();
  if (!apiKey) throw new Error('Drive API key is not configured');

  const includeGoogleDocs = params.includeGoogleDocs === true;
  const maxFiles = Math.max(1, Math.min(500, typeof params.maxFiles === 'number' ? params.maxFiles : 200));
  const pageSize = Math.max(1, Math.min(200, typeof params.pageSize === 'number' ? params.pageSize : 100));

  // We generally want binary files (PDF/PPT/etc). Optionally include Google Docs types.
  const googleMimePrefixes = [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.form",
  ];

  const mimeFilter = includeGoogleDocs
    ? ''
    : ` and not mimeType contains 'application/vnd.google-apps'`;

  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false${mimeFilter}`;

  const controller = new AbortController();
  const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 15_000;
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));

  try {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;

    while (out.length < maxFiles) {
      const limit = Math.min(pageSize, maxFiles - out.length);
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('q', q);
      url.searchParams.set('pageSize', String(limit));
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,modifiedTime)');
      url.searchParams.set('orderBy', 'modifiedTime desc');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        const suffix = text ? `: ${text.slice(0, 300)}` : '';
        const err = new Error(`Drive API files.list failed (${res.status})${suffix}`);
        (err as any).status = res.status === 403 || res.status === 401 ? 403 : 502;
        throw err;
      }

      let json: any;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        const err = new Error('Drive API returned non-JSON response');
        (err as any).status = 502;
        throw err;
      }

      const files: any[] = Array.isArray(json?.files) ? json.files : [];
      for (const f of files) {
        const parsed = toDriveFile(f);
        if (!parsed) continue;
        if (!includeGoogleDocs && googleMimePrefixes.some((p) => parsed.mimeType === p)) continue;
        out.push(parsed);
        if (out.length >= maxFiles) break;
      }

      pageToken = typeof json?.nextPageToken === 'string' ? json.nextPageToken : undefined;
      if (!pageToken) break;
    }

    return out;
  } finally {
    clearTimeout(timeout);
  }
}
