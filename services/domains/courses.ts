import type { Course } from '../../types';
import { authedJsonPost } from '../platform/apiClient';

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
  return await authedJsonPost<{ courseId: string }>('/api/courses/createCourse', input, { timeoutMs: 15000 });
};

export const getMyCourses = async (input?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<{ courses: MyCourseSummary[] }> => {
  return await authedJsonPost<{ courses: MyCourseSummary[] }>('/api/courses/myCourses', input || {}, { timeoutMs: 15000 });
};
