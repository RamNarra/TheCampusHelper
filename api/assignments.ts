import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import create from '../api_impl/assignments/create';
import publish from '../api_impl/assignments/publish';
import submit from '../api_impl/submissions/submit';
import grade from '../api_impl/submissions/grade';

export const config = { runtime: 'nodejs' };

const actions = {
  create,
  publish,
  submit,
  grade,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
