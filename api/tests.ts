import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import create from '../api_impl/tests/create';
import publish from '../api_impl/tests/publish';
import startAttempt from '../api_impl/tests/startAttempt';
import submitAttempt from '../api_impl/tests/submitAttempt';

export const config = { runtime: 'nodejs' };

const actions = {
  create,
  publish,
  startAttempt,
  submitAttempt,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
