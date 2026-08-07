import React from 'react';
import { motion } from 'framer-motion';
import { Award, BookOpen, CheckCircle2, TrendingUp, Sparkles, User, AlertCircle, FileText, Bookmark, ArrowRight, Clock } from 'lucide-react';
import { StudentProfileDoc } from '../../../core/firebase/students';
import { Link } from 'react-router-dom';
import { resources } from '../../../lib/data';

interface AcademicProfileProps {
  student: StudentProfileDoc;
}

export const AcademicProfile: React.FC<AcademicProfileProps> = ({ student }) => {
  const sem1 = student.semesters?.sem1;
  const recommendedMaterials = resources.slice(0, 3);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Animated Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/15 via-secondary/10 to-primary/5 border border-primary/20 p-8 sm:p-10 shadow-xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verified SNIST Academic Profile</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{student.name}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-2 text-base font-medium flex items-center gap-3">
              <span>Roll: <strong className="text-foreground">{student.rollNumber}</strong></span>
              <span>•</span>
              <span>Branch: <strong className="text-foreground">{student.branch}</strong></span>
              <span>•</span>
              <span>Batch: <strong className="text-foreground">{student.batch}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-4 bg-card/80 backdrop-blur border border-border/80 px-6 py-4 rounded-2xl shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current CGPA</p>
              <p className="text-3xl font-black text-primary">{student.overall.cgpa.toFixed(2)}</p>
            </div>
            <div className="h-10 w-[1px] bg-border" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Backlogs</p>
              <p className={`text-3xl font-black ${student.overall.totalBacklogs === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {student.overall.totalBacklogs}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Academic Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-muted-foreground">Latest SGPA (Sem 1)</span>
            <Award className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-extrabold text-foreground">{sem1?.sgpa.toFixed(2) || 'N/A'}</p>
          <p className="text-xs text-emerald-500 font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Passed R25 Regulations</span>
          </p>
        </div>

        <div className="p-6 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-muted-foreground">Credits Completed</span>
            <BookOpen className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-3xl font-extrabold text-foreground">{student.overall.totalCreditsEarned} / {sem1?.creditsAttempted || 21}</p>
          <p className="text-xs text-muted-foreground font-medium mt-2">Total semester credit weight</p>
        </div>

        <div className="p-6 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-muted-foreground">Total Marks</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-foreground">{sem1?.totalMarksObtained} <span className="text-base font-normal text-muted-foreground">/ 1000</span></p>
          <p className="text-xs text-emerald-500 font-medium mt-2">{sem1?.percentage.toFixed(2)}% Overall Score</p>
        </div>

        <div className="p-6 bg-card border border-border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-muted-foreground">Active Academic Status</span>
            <User className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-extrabold text-foreground">Semester 2</p>
          <p className="text-xs text-muted-foreground font-medium mt-2">Next: Mid-1 Examinations</p>
        </div>
      </div>

      {/* Continue Studying / Recommended Section */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-bold text-foreground">Continue Studying & Recommended for Sem 2</h2>
          </div>
          <Link to="/courses" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Browse All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedMaterials.map((mat) => (
            <div key={mat.id} className="p-4 bg-muted/40 border border-border/80 rounded-2xl hover:border-primary/40 transition-all flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-md bg-primary/10 inline-block mb-2">
                  {mat.unit || mat.type}
                </span>
                <h4 className="text-sm font-bold text-foreground line-clamp-1">{mat.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{mat.subject}</p>
              </div>
              <Link
                to="/courses"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
              >
                Resume Reading <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Semester 1 Subject Breakdown Table */}
      {sem1 && sem1.subjects && (
        <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Semester 1 Detailed Marksheet</h2>
              <p className="text-sm text-muted-foreground">SNIST Regulation R25 • Exam Month: January 2026</p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/60 border border-border rounded-xl text-xs font-semibold text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              <span>Official College Record</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider bg-muted/30">
                  <th className="py-3.5 px-4 font-semibold">Subject Code</th>
                  <th className="py-3.5 px-4 font-semibold">Internal</th>
                  <th className="py-3.5 px-4 font-semibold">External</th>
                  <th className="py-3.5 px-4 font-semibold">Total</th>
                  <th className="py-3.5 px-4 font-semibold">Grade</th>
                  <th className="py-3.5 px-4 font-semibold">Credits</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sem1.subjects.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-foreground">{sub.code}</td>
                    <td className="py-3.5 px-4 font-medium text-foreground">{sub.marksObtained > 0 ? sub.marksObtained : '-'}</td>
                    <td className="py-3.5 px-4 font-medium text-foreground">-</td>
                    <td className="py-3.5 px-4 font-bold text-foreground">{sub.marksObtained}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        sub.gradeLetter === 'O' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        sub.gradeLetter === 'A+' || sub.gradeLetter === 'A' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        sub.gradeLetter === 'F' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        {sub.gradeLetter}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">{sub.credits}</td>
                    <td className="py-3.5 px-4">
                      {sub.passed ? (
                        <span className="text-emerald-500 font-semibold text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold text-xs flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Backlog
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
