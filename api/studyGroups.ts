import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import approveRequest from '../api_impl/studyGroups/approveRequest';
import rejectRequest from '../api_impl/studyGroups/rejectRequest';
import join from '../api_impl/studyGroups/join';
import leave from '../api_impl/studyGroups/leave';
import createSession from '../api_impl/studyGroups/createSession';
import updateSession from '../api_impl/studyGroups/updateSession';
import deleteSession from '../api_impl/studyGroups/deleteSession';

import resourcesSubmit from '../api_impl/resources/submit';
import resourcesSetStatus from '../api_impl/resources/setStatus';
import resourcesDelete from '../api_impl/resources/delete';

export const config = { runtime: 'nodejs' };

const actions = {
  approveRequest,
  rejectRequest,
  join,
  leave,
  createSession,
  updateSession,
  deleteSession,

  resourcesSubmit,
  resourcesSetStatus,
  resourcesDelete,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
