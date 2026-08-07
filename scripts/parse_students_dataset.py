import subprocess
import re
import json
import os

pdf_path = '/home/p4cketsn1ff3r/Downloads/B.Tech I-I Reg A25 Regulation Jan-2026.pdf'
out_path = '/home/p4cketsn1ff3r/Downloads/Projects_and_Development/TheCampusHelper/scripts/students_dataset.json'

print(f"Reading text from {pdf_path}...")
out = subprocess.check_output(['pdftotext', '-layout', pdf_path, '-']).decode('utf-8', errors='ignore')

pages = out.split('\x0c')
print(f"Total pages: {len(pages)}")

# Official Grade Point Mapping from SNIST R25 Regulations (CGpa calcu and sgpa cakcu.jpeg)
GRADE_POINTS = {
    'O': 10,
    'A+': 9,
    'A': 8,
    'B+': 7,
    'B': 6,
    'C': 5,
    'P': 4,
    'F': 0,
    'AB': 0
}

header_re = re.compile(r'STUDENT MARKS DETAILS OF \d+ BATCH - B\.TECH \((.*?)\)', re.IGNORECASE)

# Mapping roll prefixes to official branch names
PREFIX_TO_BRANCH = {
    '01': 'CIVIL',
    '02': 'EEE',
    '03': 'MECH',
    '04': 'ECE',
    '05': 'CSE',
    '12': 'IT',
    '62': 'CYS',
    '66': 'AIML',
    '67': 'DS'
}

current_branch = 'CIVIL'
students = []
roll_set = set()
duplicates = []
errors = []

for p_idx, page in enumerate(pages):
    h_match = header_re.search(page)
    if h_match:
        current_branch = h_match.group(1).strip()
    
    lines = page.split('\n')
    for line in lines:
        row_match = re.match(r'^\s*(\d+)\s+(25311A[0-9A-Z]{4})\s+([A-Z\s\.\'-]+?)\s{2,}(.*)$', line)
        if row_match:
            sno, roll, name, rest = row_match.groups()
            roll = roll.strip()
            name = name.strip()

            if roll in roll_set:
                duplicates.append(roll)
            roll_set.add(roll)

            # Determine official branch from roll code prefix
            prefix = roll[6:8]
            official_branch = PREFIX_TO_BRANCH.get(prefix, current_branch)

            # Extract end of row: TotalMarks, Percentage, Backlogs, Credits
            end_match = re.search(r'(\d+)\s+(\d+\.\d+)\s+(\d+)\s+(\d+)\s*$', rest)
            if not end_match:
                errors.append(f"Failed to parse end stats for roll {roll}")
                continue

            tot_marks, pct, backlogs, credits = end_match.groups()
            tot_marks = int(tot_marks)
            pct = float(pct)
            backlogs = int(backlogs)
            credits_earned = int(credits)

            # Extract individual subject grades: format e.g. 98(O), 83(A+), 35(F)
            grades_found = re.findall(r'(\d+|\bF\b|\bAB\b)\(([O|A\+|A|B\+|B|C|P|F|AB]+)\)', rest)

            subject_list = []
            total_weighted_points = 0.0
            total_credits_attempted = 0

            for idx, (marks_str, letter) in enumerate(grades_found):
                gp = GRADE_POINTS.get(letter, 0)
                is_pass = letter not in ['F', 'AB']

                # Approximate subject credits based on grade pattern & total credits
                # Standard JNTUH course credits: 3.0 for theory, 1.5 for lab
                # If total credits = 20 (8 subjects), 21 (9 subjects)
                subj_credit = 3.0 if idx < 5 else (1.5 if idx < 8 else 1.0)

                total_weighted_points += gp * subj_credit
                total_credits_attempted += subj_credit

                subject_list.append({
                    "code": f"25SUB{idx+1:02d}",
                    "name": f"Subject {idx+1}",
                    "marksObtained": int(marks_str) if marks_str.isdigit() else 0,
                    "gradeLetter": letter,
                    "gradePoints": gp,
                    "credits": subj_credit,
                    "passed": is_pass
                })

            # Calculate precise SGPA
            computed_sgpa = round(total_weighted_points / total_credits_attempted, 2) if total_credits_attempted > 0 else 0.0

            student_doc = {
                "rollNumber": roll,
                "normalizedRoll": roll.lower(),
                "name": name,
                "branch": official_branch,
                "batch": "2025-2029",
                "currentSemester": 2,
                "claimedUid": None,
                "linkedEmails": [],
                "semesters": {
                    "sem1": {
                        "semesterId": "sem1",
                        "academicYear": "2025-2026",
                        "regulation": "R25",
                        "monthYear": "January 2026",
                        "totalMarksObtained": tot_marks,
                        "maxMarksPossible": 1000,
                        "percentage": pct,
                        "sgpa": computed_sgpa,
                        "creditsEarned": credits_earned,
                        "creditsAttempted": int(total_credits_attempted),
                        "backlogsCount": backlogs,
                        "subjects": subject_list
                    }
                },
                "overall": {
                    "cgpa": computed_sgpa,
                    "totalCreditsEarned": credits_earned,
                    "totalBacklogs": backlogs
                },
                "createdAt": "2026-08-07T08:42:00.000Z",
                "updatedAt": "2026-08-07T08:42:00.000Z"
            }

            students.append(student_doc)

print(f"\n================ IMPORT VALIDATION REPORT ================")
print(f"Total PDF Pages Scanned:      {len(pages)}")
print(f"Total Student Records Parsed: {len(students)}")
print(f"Unique Roll Numbers:          {len(roll_set)}")
print(f"Duplicate Roll Numbers:       {len(duplicates)}")
print(f"Parsing Errors:               {len(errors)}")

branch_counts = {}
for s in students:
    b = s['branch']
    branch_counts[b] = branch_counts.get(b, 0) + 1

print("\n--- Student Branch Distribution ---")
for b, count in sorted(branch_counts.items()):
    print(f"  {b:6s} : {count} students")

# Save extracted JSON dataset
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w') as f:
    json.dump(students, f, indent=2)

print(f"\nSaved clean JSON dataset to: {out_path}")
