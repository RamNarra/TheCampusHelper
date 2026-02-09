import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import submit from '../api_impl/resources/submit';
import setStatus from '../api_impl/resources/setStatus';
import del from '../api_impl/resources/delete';

export const config = { runtime: 'nodejs' };

const actions = {
  submit,
  setStatus,
  delete: del,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
