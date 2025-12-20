import type { Course } from '../../types';
import { getAuthToken } from './auth';
import { withTimeout } from '../platform/utils';

export type MyCourseSummary = {
  courseId: string;
  role: 'student' | 'instructor';
  status: 'active' | 'removed';
  course: Course;
};

export const createCourse = async (input: {
  name: string;
  code: string;
  term: string;
  description?: string;
}): Promise<{ courseId: string }> => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');

  const res = await withTimeout(
    fetch('/api/courses/createCourse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    }),
    15000
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Create course failed (${res.status})`);
  }

  return (await res.json()) as { courseId: string };
};

export const getMyCourses = async (input?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<{ courses: MyCourseSummary[] }> => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');

  const res = await withTimeout(
    fetch('/api/courses/myCourses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input || {}),
    }),
    15000
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Get my courses failed (${res.status})`);
  }

  return (await res.json()) as { courses: MyCourseSummary[] };
};
