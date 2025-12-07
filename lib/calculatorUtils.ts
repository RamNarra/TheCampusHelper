
// Grade Mapping Logic based on JNTUH R22/R18 approx standards or the user provided table
// 90–100 → O (10), 80–89 → A+ (9), 70–79 → A (8), 60–69 → B+ (7), 50–59 → B (6), 45–49 → C (5), <45 → F (0)

export interface GradeInfo {
  label: string;
  gp: number;
  color: string;
}

export const getGradeInfo = (totalMarks: number): GradeInfo => {
  const marks = Math.round(totalMarks);

  if (marks >= 90) return { label: 'O', gp: 10, color: 'text-green-400' };
  if (marks >= 80) return { label: 'A+', gp: 9, color: 'text-green-300' };
  if (marks >= 70) return { label: 'A', gp: 8, color: 'text-blue-400' };
  if (marks >= 60) return { label: 'B+', gp: 7, color: 'text-blue-300' };
  if (marks >= 50) return { label: 'B', gp: 6, color: 'text-yellow-400' };
  if (marks >= 45) return { label: 'C', gp: 5, color: 'text-orange-400' };
  return { label: 'F', gp: 0, color: 'text-red-500 font-bold' };
};

export interface SubjectRow {
  id: string;
  name: string;
  credits: number;
  internal: number;
  external: number;
}

export interface SemesterRow {
  id: string;
  name: string;
  sgpa: number;
  credits: number;
}

export const calculateSGPA = (subjects: SubjectRow[]) => {
  let totalCredits = 0;
  let totalGradePoints = 0;

  subjects.forEach(sub => {
    // Validate inputs before calculating
    if (sub.credits > 0) {
      const finalMarks = (isNaN(sub.internal) ? 0 : sub.internal) + (isNaN(sub.external) ? 0 : sub.external);
      const { gp } = getGradeInfo(finalMarks);
      
      totalCredits += sub.credits;
      totalGradePoints += (gp * sub.credits);
    }
  });

  if (totalCredits === 0) return 0;
  return parseFloat((totalGradePoints / totalCredits).toFixed(2));
};

export const calculateCGPA = (semesters: SemesterRow[]) => {
  let totalCredits = 0;
  let weightedSum = 0;

  semesters.forEach(sem => {
    if (sem.credits > 0) {
      totalCredits += sem.credits;
      weightedSum += (sem.sgpa * sem.credits);
    }
  });

  if (totalCredits === 0) return 0;
  return parseFloat((weightedSum / totalCredits).toFixed(2));
};

// Returns -1 if impossible (e.g., > 10 SGPA required)
export const calculateRequiredSGPA = (
  currentCGPA: number, 
  completedCredits: number, 
  targetCGPA: number, 
  nextSemCredits: number
) => {
  // Logic:
  // (CurrentCGPA * CompletedCredits) + (RequiredSGPA * NextSemCredits) = TargetCGPA * (CompletedCredits + NextSemCredits)
  
  const totalTargetPoints = targetCGPA * (completedCredits + nextSemCredits);
  const currentPoints = currentCGPA * completedCredits;
  
  const requiredPoints = totalTargetPoints - currentPoints;
  const requiredSGPA = requiredPoints / nextSemCredits;

  return parseFloat(requiredSGPA.toFixed(2));
};

export const isValidMarks = (internal: number, external: number) => {
  return internal >= 0 && internal <= 40 && external >= 0 && external <= 60;
};
