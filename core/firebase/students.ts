import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp 
} from 'firebase/firestore';
import { getDb } from './client';

export interface SubjectGrade {
  code: string;
  name: string;
  marksObtained: number;
  gradeLetter: string;
  gradePoints: number;
  credits: number;
  passed: boolean;
}

export interface SemesterResult {
  semesterId: string;
  academicYear: string;
  regulation: string;
  monthYear: string;
  totalMarksObtained: number;
  maxMarksPossible: number;
  percentage: number;
  sgpa: number;
  creditsEarned: number;
  creditsAttempted: number;
  backlogsCount: number;
  subjects: SubjectGrade[];
}

export interface StudentProfileDoc {
  rollNumber: string;
  normalizedRoll: string;
  name: string;
  branch: string;
  batch: string;
  currentSemester: number;
  claimedUid: string | null;
  linkedEmails: string[];
  semesters: Record<string, SemesterResult>;
  overall: {
    cgpa: number;
    totalCreditsEarned: number;
    totalBacklogs: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extracts standard SNIST roll number pattern from email or string
 * e.g. "25311A6601@sreenidhi.edu.in" -> "25311A6601"
 */
export function extractRollNumberFromInput(input: string): string | null {
  if (!input) return null;
  const match = input.match(/\b(25311A[0-9A-Z]{4})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Resolves and auto-links authenticated user to pre-imported Firestore student document.
 */
export async function linkAndFetchStudentProfile(
  uid: string,
  userEmail?: string | null,
  userDisplayName?: string | null
): Promise<StudentProfileDoc | null> {
  const db = getDb();
  if (!db) return null;

  // 1. Try extracting Roll Number from email (e.g. 25311a6601@sreenidhi.edu.in)
  let rollNumber = userEmail ? extractRollNumberFromInput(userEmail) : null;

  // 2. If roll number found, attempt direct document fetch from `students/{rollNumber}`
  if (rollNumber) {
    const studentRef = doc(db, 'students', rollNumber);
    const snap = await getDoc(studentRef);

    if (snap.exists()) {
      const data = snap.data() as StudentProfileDoc;

      // Link claimedUid and add email if not linked yet
      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (!data.claimedUid) {
        updates.claimedUid = uid;
      }
      if (userEmail && !data.linkedEmails?.includes(userEmail.toLowerCase())) {
        updates.linkedEmails = arrayUnion(userEmail.toLowerCase());
      }

      await updateDoc(studentRef, updates);
      return { ...data, claimedUid: uid, linkedEmails: [...(data.linkedEmails || []), userEmail || ''] };
    }
  }

  return null;
}
