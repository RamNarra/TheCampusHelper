import type { VercelRequest, VercelResponse } from '../api_impl/_lib/request';
import { getAction, rejectUnknownAction } from '../server/routerUtils';

import createCourse from '../api_impl/courses/createCourse';
import myCourses from '../api_impl/courses/myCourses';
import setEnrollment from '../api_impl/courses/setEnrollment';
import setVisibility from '../api_impl/courses/setVisibility';
import postToStream from '../api_impl/courses/postToStream';

export const config = { runtime: 'nodejs' };

const actions = {
  createCourse,
  myCourses,
  setEnrollment,
  setVisibility,
  postToStream,
} as const satisfies Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getAction(req);
  const fn = (actions as any)[action] as undefined | ((req: VercelRequest, res: VercelResponse) => Promise<unknown>);
  if (!fn) return rejectUnknownAction(req, res, Object.keys(actions));
  return fn(req, res);
}
