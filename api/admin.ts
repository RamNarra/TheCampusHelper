import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import setUserRole from '../api_impl/admin/setUserRole';
import setUserDisabled from '../api_impl/admin/setUserDisabled';
import setPhase1Toggle from '../api_impl/admin/setPhase1Toggle';

export const config = { runtime: 'nodejs' };

const actions = {
  setUserRole,
  setUserDisabled,
  setPhase1Toggle,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
