import type { UserRole } from '../../types';
import { getAuthToken, forceRefreshAuthToken } from './auth';
import { withTimeout } from '../platform/utils';

export const bootstrapAdminAccess = async (): Promise<boolean> => {
  try {
    const token = await getAuthToken();
    if (!token) return false;
    const res = await fetch('/api/bootstrapAdmin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      try {
        const text = await res.text();
        console.warn('bootstrapAdminAccess failed:', res.status, text);
      } catch {
        console.warn('bootstrapAdminAccess failed:', res.status);
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const bootstrapAdminAccessDetailed = async (): Promise<{
  ok: boolean;
  status: number;
  bodyText: string;
}> => {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, status: 0, bodyText: 'Not signed in' };
    const res = await fetch('/api/bootstrapAdmin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const bodyText = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, bodyText };
  } catch (e: any) {
    return { ok: false, status: 0, bodyText: e?.message || 'Request failed' };
  }
};

export const updateUserRole = async (targetUid: string, role: UserRole) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await withTimeout(
    fetch('/api/admin/setUserRole', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUid, role }),
    }),
    10000
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Role update failed (${res.status})`);
  }

  await forceRefreshAuthToken();
};

export const setUserDisabled = async (targetUid: string, disabled: boolean) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await withTimeout(
    fetch('/api/admin/setUserDisabled', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUid, disabled }),
    }),
    10000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Disable update failed (${res.status})`);
  }
};

export const approveStudyGroupRequest = async (requestId: string) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await withTimeout(
    fetch('/api/studyGroups/approveRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId }),
    }),
    15000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Approve request failed (${res.status})`);
  }
};

export const rejectStudyGroupRequest = async (requestId: string, reason?: string) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await withTimeout(
    fetch('/api/studyGroups/rejectRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId, reason: reason || '' }),
    }),
    15000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Reject request failed (${res.status})`);
  }
};
