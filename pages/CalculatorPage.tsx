import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, RotateCcw, Calculator, ArrowDownCircle, Info, Save } from 'lucide-react';
import { 
  getGradeInfo, 
  calculateSGPA, 
  calculateCGPA, 
  SubjectRow, 
  SemesterRow, 
  isValidMarks 
} from '../lib/calculatorUtils';

const CalculatorPage: React.FC = () => {
  // --- State ---
  const [subjects, setSubjects] = useState<SubjectRow[]>([
    { id: '1', name: 'Subject 1', credits: 3, internal: 0, external: 0 },
    { id: '2', name: 'Subject 2', credits: 3, internal: 0, external: 0 },
    { id: '3', name: 'Subject 3', credits: 3, internal: 0, external: 0 },
    { id: '4', name: 'Lab 1', credits: 1.5, internal: 0, external: 0 },
  ]);

  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [sgpa, setSgpa] = useState(0);
  const [cgpa, setCgpa] = useState(0);
  const [activeTab, setActiveTab] = useState<'sgpa' | 'cgpa'>('sgpa');

  // --- Effects ---
  
  // Load from local storage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('campus_helper_calc_data');
    if (savedData) {
      try {
        const { savedSubjects, savedSemesters } = JSON.parse(savedData);
        if (savedSubjects) setSubjects(savedSubjects);
        if (savedSemesters) setSemesters(savedSemesters);
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
  }, []);

  // Save to local storage on change & Calculate Real-time
  useEffect(() => {
    localStorage.setItem('campus_helper_calc_data', JSON.stringify({ 
      savedSubjects: subjects, 
      savedSemesters: semesters 
    }));

    setSgpa(calculateSGPA(subjects));
    setCgpa(calculateCGPA(semesters));
  }, [subjects, semesters]);

  // --- Handlers: SGPA Section ---

  const updateSubject = (id: string, field: keyof SubjectRow, value: string | number) => {
    const newSubjects = subjects.map(sub => {
      if (sub.id === id) {
        return { ...sub, [field]: value };
      }
      return sub;
    });
    setSubjects(newSubjects);
  };

  const addSubject = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setSubjects([...subjects, { id: newId, name: `Subject ${subjects.length + 1}`, credits: 3, internal: 0, external: 0 }]);
  };

  const removeSubject = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  const resetSubjects = () => {
    if (window.confirm('Clear all subjects?')) {
      setSubjects([{ id: '1', name: 'Subject 1', credits: 3, internal: 0, external: 0 }]);
    }
  };

  // --- Handlers: CGPA Section ---

  const updateSemester = (id: string, field: keyof SemesterRow, value: string | number) => {
    const newSems = semesters.map(sem => {
      if (sem.id === id) {
        return { ...sem, [field]: value };
      }
      return sem;
    });
    setSemesters(newSems);
  };

  const addSemester = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setSemesters([...semesters, { id: newId, name: `Sem ${semesters.length + 1}`, sgpa: 0, credits: 20 }]);
  };

  const removeSemester = (id: string) => {
    setSemesters(semesters.filter(s => s.id !== id));
  };

  const importCurrentSgpa = () => {
    const currentTotalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
    if (currentTotalCredits === 0) return;

    const newId = Math.random().toString(36).substr(2, 9);
    setSemesters([...semesters, { 
      id: newId, 
      name: `Calculated Sem`, 
      sgpa: sgpa, 
      credits: currentTotalCredits 
    }]);
    setActiveTab('cgpa');
  };

  const resetSemesters = () => {
    if (window.confirm('Clear all semesters?')) {
      setSemesters([]);
    }
  };


  return (
    <div className="min-h-screen pt-24 px-4 max-w-5xl mx-auto sm:px-6 lg:px-8 pb-20">
      
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
          <Calculator className="w-8 h-8 text-secondary" />
          CGPA Calculator
        </h1>
        <p className="text-gray-400">Calculate your SGPA and CGPA with JNTUH grading standards</p>
      </div>

      {/* Info Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-gray-300 space-y-1">
          <p><span className="font-semibold text-white">Rule:</span> Internal Marks (40%) + External Marks (60%) = Final Marks (100%).</p>
          <p>Grades: <span className="text-green-400">O (90+)</span>, <span className="text-green-300">A+ (80+)</span>, <span className="text-blue-400">A (70+)</span>, <span className="text-blue-300">B+ (60+)</span>, <span className="text-yellow-400">B (50+)</span>, <span className="text-orange-400">C (45+)</span>, <span className="text-red-400">F (&lt;45)</span>.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-card border border-white/10 rounded-lg p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('sgpa')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'sgpa' ? 'bg-secondary text-secondary-foreground shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            SGPA (Semester)
          </button>
          <button
            onClick={() => setActiveTab('cgpa')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'cgpa' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            CGPA (Overall)
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* SGPA Section */}
        {activeTab === 'sgpa' && (
          <motion.div
            key="sgpa"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Subject Wise Entry</h2>
                  <p className="text-xs text-gray-500 mt-1">Enter marks to calculate semester Grade Points</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Current SGPA</p>
                    <p className="text-3xl font-bold text-secondary">{sgpa}</p>
                  </div>
                  <button 
                    onClick={resetSubjects}
                    className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Reset All"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="p-4 w-1/4">Subject Name</th>
                      <th className="p-4 w-24 text-center">Credits</th>
                      <th className="p-4 w-32 text-center">Internal (40)</th>
                      <th className="p-4 w-32 text-center">External (60)</th>
                      <th className="p-4 w-24 text-center">Total</th>
                      <th className="p-4 w-24 text-center">Grade</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subjects.map((sub) => {
                      const total = (Number(sub.internal) || 0) + (Number(sub.external) || 0);
                      const gradeInfo = getGradeInfo(total);
                      const hasError = !isValidMarks(sub.internal, sub.external);

                      return (
                        <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <input
                              type="text"
                              value={sub.name}
                              onChange={(e) => updateSubject(sub.id, 'name', e.target.value)}
                              placeholder="Subject Name"
                              className="w-full bg-transparent border-b border-white/10 focus:border-secondary outline-none py-1 text-white placeholder-gray-600 transition-colors"
                            />
                          </td>
                          <td className="p-4">
                             <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={sub.credits}
                              onChange={(e) => updateSubject(sub.id, 'credits', parseFloat(e.target.value))}
                              className="w-full text-center bg-white/5 border border-white/10 rounded py-1 text-white focus:border-secondary outline-none"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={sub.internal}
                              onChange={(e) => updateSubject(sub.id, 'internal', parseFloat(e.target.value))}
                              className={`w-full text-center bg-white/5 border rounded py-1 text-white focus:outline-none ${sub.internal > 40 || sub.internal < 0 ? 'border-red-500' : 'border-white/10 focus:border-secondary'}`}
                            />
                          </td>
                          <td className="p-4">
                             <input
                              type="number"
                              min="0"
                              max="60"
                              value={sub.external}
                              onChange={(e) => updateSubject(sub.id, 'external', parseFloat(e.target.value))}
                              className={`w-full text-center bg-white/5 border rounded py-1 text-white focus:outline-none ${sub.external > 60 || sub.external < 0 ? 'border-red-500' : 'border-white/10 focus:border-secondary'}`}
                            />
                          </td>
                          <td className="p-4 text-center font-medium text-white">
                            {total}
                          </td>
                          <td className={`p-4 text-center font-bold ${gradeInfo.color}`}>
                            {gradeInfo.label} <span className="text-xs font-normal text-gray-500">({gradeInfo.gp})</span>
                          </td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => removeSubject(sub.id)}
                              className="text-gray-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-white/5 border-t border-white/10 flex justify-between">
                <button
                  onClick={addSubject}
                  className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Subject
                </button>
                <div className="text-xs text-gray-500">
                  Total Credits: {subjects.reduce((sum, s) => sum + (s.credits || 0), 0)}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
               <button
                  onClick={importCurrentSgpa}
                  className="flex items-center gap-2 px-6 py-3 bg-card border border-primary/30 hover:bg-primary/10 text-primary rounded-xl transition-all shadow-lg"
               >
                 <Save className="w-4 h-4" />
                 Save SGPA to CGPA List
               </button>
            </div>
          </motion.div>
        )}

        {/* CGPA Section */}
        {activeTab === 'cgpa' && (
          <motion.div
            key="cgpa"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
             <div className="bg-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                   <h2 className="text-xl font-bold text-white">Cumulative GPA</h2>
                   <p className="text-xs text-gray-500 mt-1">Track performance across semesters</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Overall CGPA</p>
                    <p className="text-3xl font-bold text-primary">{cgpa}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Semester</th>
                      <th className="p-4 w-32 text-center">Total Credits</th>
                      <th className="p-4 w-32 text-center">SGPA (0-10)</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {semesters.length === 0 && (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500">
                                No semesters added yet. Add manually or import from SGPA tab.
                            </td>
                        </tr>
                    )}
                    {semesters.map((sem) => (
                      <tr key={sem.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                           <input
                              type="text"
                              value={sem.name}
                              onChange={(e) => updateSemester(sem.id, 'name', e.target.value)}
                              className="w-full bg-transparent border-b border-white/10 focus:border-primary outline-none py-1 text-white placeholder-gray-600"
                            />
                        </td>
                        <td className="p-4">
                           <input
                              type="number"
                              min="0"
                              value={sem.credits}
                              onChange={(e) => updateSemester(sem.id, 'credits', parseFloat(e.target.value))}
                              className="w-full text-center bg-white/5 border border-white/10 rounded py-1 text-white focus:border-primary outline-none"
                            />
                        </td>
                        <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.01"
                              value={sem.sgpa}
                              onChange={(e) => updateSemester(sem.id, 'sgpa', parseFloat(e.target.value))}
                              className="w-full text-center bg-white/5 border border-white/10 rounded py-1 text-white focus:border-primary outline-none"
                            />
                        </td>
                        <td className="p-4 text-center">
                            <button 
                              onClick={() => removeSemester(sem.id)}
                              className="text-gray-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

               <div className="p-4 bg-white/5 border-t border-white/10 flex justify-between">
                <button
                  onClick={addSemester}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Semester
                </button>
                 {semesters.length > 0 && (
                    <button
                        onClick={resetSemesters}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        Clear All
                    </button>
                 )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalculatorPage;
