import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import createEvent from '../api_impl/calendar/createEvent';
import upsert from '../api_impl/events/upsert';

export const config = { runtime: 'nodejs' };

const actions = {
  createEvent,
  upsert,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
