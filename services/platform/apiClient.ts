import { getAuthToken } from '../domains/auth';
import { addDevAllFeaturesHeader, withTimeout } from './utils';

export type ApiErrorDetails = {
  status: number;
  message: string;
  requestId?: string;
};

export const parseApiError = async (response: Response): Promise<ApiErrorDetails> => {
  const status = response.status;

  if (status === 404) {
    return {
      status,
      message:
        'Backend route is not available. In local dev, run "npm run dev:secure" (Vercel dev) so /api routes work.',
    };
  }

  if (status === 429) {
    return { status, message: 'You are sending requests too quickly. Please wait a minute and try again.' };
  }

  if (status === 502) {
    return { status, message: 'Service is temporarily unavailable. Please try again in a moment.' };
  }

  try {
    const err = (await response.json().catch(() => null)) as any;
    const requestId = typeof err?.requestId === 'string' ? err.requestId : undefined;
    const message = String(err?.error || err?.message || '').trim();
    if (message) return { status, message, requestId };
    return { status, message: `Request failed (${status})`, requestId };
  } catch {
    return { status, message: `Request failed (${status})` };
  }
};

export const authedJsonPost = async <TResponse>(
  url: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<TResponse> => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...addDevAllFeaturesHeader(),
      },
      body: JSON.stringify(body ?? {}),
    }),
    options?.timeoutMs ?? 15000
  );

  if (!res.ok) {
    const err = await parseApiError(res);
    const suffix = err.requestId ? ` (requestId: ${err.requestId})` : '';
    throw new Error(`${err.message}${suffix}`);
  }

  return (await res.json()) as TResponse;
};
