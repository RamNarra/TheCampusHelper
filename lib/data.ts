
import { Resource } from '../types';

// --- Types ---
export interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: 'Hackathon' | 'Workshop' | 'Cultural' | 'Seminar';
  description: string;
  imageUrl: string;
  registrationLink: string;
  status: 'upcoming' | 'ongoing' | 'completed';
}

// Subject Lists defined by specific Cycle Logic

// List A: CS/IT/DS Sem 1 | AIML/ECE/CYS Sem 2
const listA = [
  'Matrices and Calculus',
  'Engineering Physics',
  'English for Skill Enhancement',
  'Electronic Devices and Circuits',
  'Programming for Problem Solving',
  'Engineering Physics Lab',
  'Programming for Problem Solving Lab',
  'English Language and Communication Skills Lab',
  'Engineering Workshop',
  'Induction Program'
];

// List B: CS/IT/DS Sem 2 | AIML/ECE/CYS Sem 1
const listB = [
  'Ordinary Differential Equations and Vector Calculus',
  'Advanced Engineering Chemistry',
  'Engineering Drawing and Computer Aided Drafting',
  'Basic Electrical Engineering',
  'Data Structures',
  'Advanced Engineering Chemistry Lab',
  'Data Structures Lab',
  'Python Programming Lab',
  'Basic Electrical Engineering Lab',
  'IT Workshop'
];

// Sem 3 Base
const sem3Base = [
  'Discrete Mathematics',
  'Computer Organization and Architecture',
  'Object Oriented Programming through java',
  'Software Engineering',
  'Database Management Systems',
  'Innovation and Entrepreneurship',
  'Object Oriented Programming through java Lab',
  'Software Engineering Lab',
  'Database Management Systems Lab',
  'Node Js/React JS/ Django',
  'Environmental Science'
];

// Sem 4 Base
const sem4Base = [
  'Computer oriented Statistical Methods',
  'Operating Systems',
  'Algorithm design and Analysis',
  'Computer Networks',
  'Machine Learning',
  'Computational Mathematics Lab',
  'Operating Systems Lab',
  'Computer Networks Lab',
  'Machine Learning Lab',
  'Data Visualization- R/ Python/ Power BI'
];

// Sem 5 Base
const sem5Base = [
  'Automata Theory and Compiler Design',
  'Artificial Intelligence',
  'DevOps',
  'Professional Elective-I',
  'Open Elective-I',
  'Compiler Design Lab',
  'Artificial Intelligence with Python Lab',
  'DevOps Lab',
  'Field-Based Research Project',
  'UI Design – Flutter/ Android Studio',
  'Indian Knowledge System'
];

// Sem 6 Base
const sem6Base = [
  'Cryptography and Networks Security',
  'Deep Learning',
  'Business Economics and Financial Analysis',
  'Professional Elective-II',
  'Open Elective – II',
  'Cryptography and Networks Security Lab',
  'Deep Learning Lab',
  'Advanced Data Structures using Python Lab',
  'Advanced English Communication Skills Laboratory',
  'Prompt Engineering',
  'Gender Sensitization Lab'
];

// Sem 7 Base
const sem7Base = [
  'Natural Language Processing',
  'Cyber Security',
  'Fundamentals of Management',
  'Professional Elective-III',
  'Professional Elective – IV',
  'Open Elective – III',
  'Natural Language Processing Lab',
  'Cyber Security Lab',
  'Industry Oriented Mini Project/ Internship'
];

// Sem 8 Base
const sem8Base = [
  'Professional Elective – V',
  'Professional Elective – VI',
  'Project Work'
];

export const getSubjects = (branch: string, semester: string): string[] => {
  const isGroupA = branch === 'CS_IT_DS'; // Group A: CS/IT/DS
  // isGroupB: AIML/ECE/CYS

  // Logic: 
  // Group A follows sequential order (1->A, 2->B, 3->3, 4->4...)
  // Group B follows swapped order (1->B, 2->A, 3->4, 4->3...)
  
  if (isGroupA) {
    switch (semester) {
      case '1': return listA;
      case '2': return listB;
      case '3': return sem3Base;
      case '4': return sem4Base;
      case '5': return sem5Base;
      case '6': return sem6Base;
      case '7': return sem7Base;
      case '8': return sem8Base;
      default: return [];
    }
  } else {
    // Group B (Swapped)
    switch (semester) {
      case '1': return listB;
      case '2': return listA;
      case '3': return sem4Base;
      case '4': return sem3Base;
      case '5': return sem6Base;
      case '6': return sem5Base;
      case '7': return sem8Base;
      case '8': return sem7Base;
      default: return [];
    }
  }
};

export const resources: Resource[] = [
  // --- USER REQUESTED RESOURCE ---
  // Path: CS/IT/DS > Sem 1 > Engineering Physics > Unit 2 > Teacher PPTs
  {
    id: 'res-ep-u2-ppt',
    title: 'Unit 2: Fiber Optics',
    subject: 'Engineering Physics',
    branch: 'CS_IT_DS', 
    semester: '1',
    unit: '2',
    type: 'PPT',
    downloadUrl: 'https://docs.google.com/presentation/d/1--fcBt0glKsOPnxbhWMZ9BoXZ_4EAKKZ/edit?usp=sharing',
    status: 'approved',
    driveFileId: '1--fcBt0glKsOPnxbhWMZ9BoXZ_4EAKKZ' 
  },
  
  // Previous Examples
  {
    id: 'res-ma-u1-impq',
    title: 'Unit 1 Important Questions',
    subject: 'Matrices and Calculus',
    branch: 'CS_IT_DS', 
    semester: '1',
    unit: '1',
    type: 'ImpQ',
    downloadUrl: '#',
    status: 'approved',
    driveFileId: '19sC8_bC_kXp5r4v5X3j_h5y0sF_x1r1' 
  },
  {
    id: 'res-ds-u1-note',
    title: 'Introduction to Data Structures',
    subject: 'Data Structures',
    branch: 'CS_IT_DS', 
    semester: '2',
    unit: '1',
    type: 'Note',
    downloadUrl: '#',
    status: 'approved',
    driveFileId: '1BDq7G_y9XvXyk5zXXzXzXzXzXzXzXzX' 
  },
  {
    id: 'res-ma-u1-note',
    title: 'Rank of Matrix Notes',
    subject: 'Matrices and Calculus',
    branch: 'CS_IT_DS', 
    semester: '1',
    unit: '1',
    type: 'Note',
    downloadUrl: '#',
    status: 'approved'
  }
];

export const pendingUploads: Resource[] = [
  {
    id: 'pend-001',
    title: 'Unit 3 Notes',
    subject: 'Data Structures',
    branch: 'CS_IT_DS',
    semester: '2',
    unit: '3',
    type: 'Note',
    downloadUrl: '#',
    status: 'pending'
  }
];

// --- Events Data ---
export const upcomingEvents: EventItem[] = [
  {
    id: 'ev-1',
    title: 'Smart India Hackathon 2024 (Internal)',
    date: 'Oct 15, 2024',
    time: '9:00 AM - 6:00 PM',
    location: 'Main Auditorium, Block A',
    category: 'Hackathon',
    description: 'The internal selection round for SIH 2024. Teams must solve problem statements provided by ministries and industries.',
    imageUrl: 'https://images.unsplash.com/photo-1504384308090-c54be3855833?auto=format&fit=crop&q=80&w=600',
    registrationLink: '#',
    status: 'upcoming'
  },
  {
    id: 'ev-2',
    title: 'Google Cloud Study Jam',
    date: 'Oct 20, 2024',
    time: '2:00 PM - 4:00 PM',
    location: 'Computer Lab 3, Block D',
    category: 'Workshop',
    description: 'Hands-on session on Generative AI on Google Cloud. Earn badges and goodies upon completion.',
    imageUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=600',
    registrationLink: '#',
    status: 'upcoming'
  },
  {
    id: 'ev-3',
    title: 'Freshers Day: "Novato Fiesta"',
    date: 'Nov 05, 2024',
    time: '5:00 PM onwards',
    location: 'College Ground',
    category: 'Cultural',
    description: 'A grand welcome to the batch of 2024. DJ Night, Dance Performances, and Dinner included.',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=600',
    registrationLink: '#',
    status: 'upcoming'
  },
  {
    id: 'ev-4',
    title: 'Seminar on Career in Cyber Security',
    date: 'Sep 28, 2024',
    time: '11:00 AM',
    location: 'Seminar Hall 1',
    category: 'Seminar',
    description: 'Expert talk by Mr. Rajesh Kumar from Palo Alto Networks about the future of CyberSec jobs.',
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=600',
    registrationLink: '#',
    status: 'completed'
  }
];

// --- Exam Preparation Utilities ---
import { ExamPrep, Subject, StudyTask } from '../types';

// Generate study schedule with spaced repetition
export const generateStudySchedule = (subjects: Subject[], examDate: Date): StudyTask[] => {
  const tasks: StudyTask[] = [];
  const today = new Date();
  const daysUntilExam = Math.floor((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  subjects.forEach((subject) => {
    const remainingTopics = subject.totalTopics - subject.completedTopics;
    const topicsPerDay = Math.ceil(remainingTopics / Math.max(daysUntilExam, 1));
    
    // Generate tasks with spaced repetition
    for (let i = 0; i < remainingTopics; i++) {
      const dayOffset = Math.floor(i / topicsPerDay);
      const scheduledDate = new Date(today);
      scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
      
      // Prioritize weak topics
      const isWeakTopic = subject.weakTopics.includes(`Topic ${i + subject.completedTopics + 1}`);
      
      tasks.push({
        id: `task-${subject.id}-${i}`,
        subjectId: subject.id,
        topic: `Topic ${i + subject.completedTopics + 1}`,
        scheduledDate,
        completed: false,
        duration: 60,
        priority: isWeakTopic ? 'high' : dayOffset < daysUntilExam / 3 ? 'medium' : 'low'
      });
    }
    
    // Add revision tasks for weak topics (spaced repetition)
    subject.weakTopics.forEach((weakTopic, idx) => {
      const revisionDate = new Date(today);
      revisionDate.setDate(revisionDate.getDate() + Math.floor(daysUntilExam * 0.7) + idx);
      
      tasks.push({
        id: `revision-${subject.id}-${idx}`,
        subjectId: subject.id,
        topic: `Revision: ${weakTopic}`,
        scheduledDate: revisionDate,
        completed: false,
        duration: 45,
        priority: 'high'
      });
    });
  });
  
  return tasks.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
};

// Calculate predicted readiness based on completion and time remaining
export const calculateReadiness = (examPrep: ExamPrep): number => {
  const totalTasks = examPrep.studyPlan.length;
  const completedTasks = examPrep.studyPlan.filter(t => t.completed).length;
  const today = new Date();
  const daysUntilExam = Math.floor((examPrep.examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Base readiness on completion percentage
  const completionScore = (completedTasks / totalTasks) * 100;
  
  // Adjust based on time remaining
  const timeScore = daysUntilExam > 0 ? Math.min(100, (daysUntilExam / 30) * 20) : 0;
  
  // Penalize if there are many weak topics
  const weakTopicCount = examPrep.subjects.reduce((sum, s) => sum + s.weakTopics.length, 0);
  const weakTopicPenalty = Math.min(weakTopicCount * 5, 30);
  
  return Math.max(0, Math.min(100, completionScore + timeScore - weakTopicPenalty));
};

// Mock test recommendations based on weak topics
export const getMockTestRecommendations = (subjects: Subject[]): string[] => {
  const recommendations: string[] = [];
  
  subjects.forEach((subject) => {
    if (subject.weakTopics.length > 0) {
      recommendations.push(`Practice test for ${subject.name}: Focus on ${subject.weakTopics.slice(0, 2).join(', ')}`);
    }
    
    const completionPercentage = (subject.completedTopics / subject.totalTopics) * 100;
    if (completionPercentage >= 80) {
      recommendations.push(`Full mock test for ${subject.name}`);
    }
  });
  
  return recommendations;
};

// Calculate stress level based on workload and time
export const calculateStressLevel = (examPrep: ExamPrep): 'low' | 'medium' | 'high' => {
  const today = new Date();
  const daysUntilExam = Math.floor((examPrep.examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const remainingTasks = examPrep.studyPlan.filter(t => !t.completed).length;
  const tasksPerDay = remainingTasks / Math.max(daysUntilExam, 1);
  
  if (tasksPerDay > 8 || daysUntilExam < 3) {
    return 'high';
  } else if (tasksPerDay > 4 || daysUntilExam < 7) {
    return 'medium';
  }
  return 'low';
};
