
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, RotateCcw, Calculator, Info, Save, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { 
  getGradeInfo, 
  calculateSGPA, 
  calculateCGPA, 
  calculateRequiredSGPA,
  SubjectRow, 
  SemesterRow
} from '../lib/calculatorUtils';
import AdUnit from '../components/AdUnit';

const CalculatorPage: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectRow[]>([
    { id: '1', name: 'Subject 1', credits: 3, internal: 0, external: 0 },
    { id: '2', name: 'Subject 2', credits: 3, internal: 0, external: 0 },
    { id: '3', name: 'Subject 3', credits: 3, internal: 0, external: 0 },
    { id: '4', name: 'Lab 1', credits: 1.5, internal: 0, external: 0 },
  ]);

  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  
  const [currentCGPA, setCurrentCGPA] = useState<string>('');
  const [completedCredits, setCompletedCredits] = useState<string>('');
  const [nextSemCredits, setNextSemCredits] = useState<string>('20');
  const [targetCGPA, setTargetCGPA] = useState<string>('');
  const [requiredSGPA, setRequiredSGPA] = useState<number | null>(null);

  const [sgpa, setSgpa] = useState(0);
  const [cgpa, setCgpa] = useState(0);
  const [activeTab, setActiveTab] = useState<'sgpa' | 'cgpa' | 'target'>('target');

  useEffect(() => {
    const savedData = localStorage.getItem('campus_helper_calc_data');
    if (savedData) {
      try {
        const { savedSubjects, savedSemesters, savedTarget } = JSON.parse(savedData);
        if (savedSubjects) setSubjects(savedSubjects);
        if (savedSemesters) setSemesters(savedSemesters);
        if (savedTarget) {
            setCurrentCGPA(savedTarget.currentCGPA || '');
            setCompletedCredits(savedTarget.completedCredits || '');
            setTargetCGPA(savedTarget.targetCGPA || '');
        }
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
  }, []);

  useEffect(() => {
    setSgpa(calculateSGPA(subjects));
    setCgpa(calculateCGPA(semesters));
  }, [subjects, semesters, currentCGPA, completedCredits, targetCGPA]);

  // Persist with a small debounce to avoid hammering localStorage on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem('campus_helper_calc_data', JSON.stringify({
          savedSubjects: subjects,
          savedSemesters: semesters,
          savedTarget: { currentCGPA, completedCredits, targetCGPA }
        }));
      } catch {
        // Ignore storage failures (private mode / quota / blocked)
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [subjects, semesters, currentCGPA, completedCredits, targetCGPA]);

  useEffect(() => {
     if (currentCGPA && completedCredits && targetCGPA && nextSemCredits) {
         const req = calculateRequiredSGPA(
             parseFloat(currentCGPA), 
             parseFloat(completedCredits), 
             parseFloat(targetCGPA), 
             parseFloat(nextSemCredits)
         );
         setRequiredSGPA(req);
     } else {
         setRequiredSGPA(null);
     }
  }, [currentCGPA, completedCredits, targetCGPA, nextSemCredits]);

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
    <div className="min-h-screen pt-24 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 pb-12">
      
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-3">
          <Calculator className="w-8 h-8 text-secondary" />
          Academic Calculator
        </h1>
        <p className="text-muted-foreground">Grade Planner & SGPA/CGPA</p>
      </div>
      
      <div className="flex justify-center mb-8">
        <div className="bg-muted p-1 rounded-xl flex gap-1 w-full max-w-lg">
           <button
            onClick={() => setActiveTab('target')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'target' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Target Planner
          </button>
          <button
            onClick={() => setActiveTab('sgpa')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sgpa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            SGPA (Semester)
          </button>
          <button
            onClick={() => setActiveTab('cgpa')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'cgpa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            CGPA (Overall)
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* TARGET PLANNER SECTION */}
        {activeTab === 'target' && (
            <motion.div
                key="target"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
            >
                <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
                    <div className="flex flex-col md:flex-row gap-10 items-start">
                        <div className="flex-1 w-full space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                   <Target className="w-6 h-6 text-primary" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">Goal Setter</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1.5 uppercase font-bold tracking-wider">Current CGPA</label>
                                    <input 
                                        type="number" 
                                        placeholder="e.g. 7.5" 
                                        className="w-full bg-muted border border-transparent focus:border-primary rounded-lg px-4 py-3 text-foreground outline-none transition-colors"
                                        value={currentCGPA}
                                        onChange={e => setCurrentCGPA(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1.5 uppercase font-bold tracking-wider">Completed Credits</label>
                                    <input 
                                        type="number" 
                                        placeholder="e.g. 60" 
                                        className="w-full bg-muted border border-transparent focus:border-primary rounded-lg px-4 py-3 text-foreground outline-none transition-colors"
                                        value={completedCredits}
                                        onChange={e => setCompletedCredits(e.target.value)}
                                    />
                                </div>
                                 <div>
                                    <label className="block text-xs text-muted-foreground mb-1.5 uppercase font-bold tracking-wider">Next Sem Credits</label>
                                    <input 
                                        type="number" 
                                        placeholder="e.g. 21" 
                                        className="w-full bg-muted border border-transparent focus:border-primary rounded-lg px-4 py-3 text-foreground outline-none transition-colors"
                                        value={nextSemCredits}
                                        onChange={e => setNextSemCredits(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-primary mb-1.5 uppercase font-bold tracking-wider">Goal CGPA</label>
                                    <input 
                                        type="number" 
                                        placeholder="e.g. 8.0" 
                                        className="w-full bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 text-foreground focus:border-primary outline-none transition-colors"
                                        value={targetCGPA}
                                        onChange={e => setTargetCGPA(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Result Card */}
                        <div className="w-full md:w-80 bg-muted/50 rounded-2xl p-8 border border-border flex flex-col items-center justify-center text-center self-stretch">
                            <h3 className="text-muted-foreground text-sm font-medium mb-4">Required SGPA (Next Sem)</h3>
                            
                            {requiredSGPA !== null ? (
                                <>
                                    <div className={`text-6xl font-bold mb-2 ${requiredSGPA > 10 ? 'text-red-500' : requiredSGPA <= 0 ? 'text-green-500' : 'text-primary'}`}>
                                        {requiredSGPA > 10 ? ">10" : requiredSGPA <= 0 ? "0" : requiredSGPA}
                                    </div>
                                    
                                    {requiredSGPA > 10 && (
                                        <div className="flex items-center gap-2 text-red-500 text-xs mt-2 bg-red-500/10 px-3 py-1.5 rounded-full">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            <span>Mathematically Impossible</span>
                                        </div>
                                    )}
                                     {requiredSGPA > 0 && requiredSGPA <= 10 && (
                                        <p className="text-muted-foreground text-sm mt-4 leading-relaxed">
                                            You need to score <span className="text-foreground font-bold">{requiredSGPA}</span> SGPA to reach your goal of <span className="text-foreground font-bold">{targetCGPA}</span> CGPA.
                                        </p>
                                     )}
                                </>
                            ) : (
                                <div className="text-muted-foreground italic text-sm">
                                    Enter details to calculate...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <AdUnit className="mt-8" />
            </motion.div>
        )}
        
        {/* SGPA Section */}
        {activeTab === 'sgpa' && (
          <motion.div
            key="sgpa"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Semester Grades</h2>
                  <p className="text-sm text-muted-foreground">Calculate SGPA based on subject marks</p>
                </div>
                <div className="text-right">
                    <span className="text-4xl font-bold text-secondary">{sgpa}</span>
                    <span className="text-sm text-muted-foreground ml-2">SGPA</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="p-4 w-1/3">Subject Name</th>
                      <th className="p-4 text-center">Credits</th>
                      <th className="p-4 text-center">Internal (40)</th>
                      <th className="p-4 text-center">External (60)</th>
                      <th className="p-4 text-center">Grade</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subjects.map((sub) => {
                      const total = (Number(sub.internal) || 0) + (Number(sub.external) || 0);
                      const gradeInfo = getGradeInfo(total);

                      return (
                        <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4 pl-6">
                            <input
                              type="text"
                              value={sub.name}
                              onChange={(e) => updateSubject(sub.id, 'name', e.target.value)}
                              placeholder="Subject Name"
                              className="w-full bg-transparent border-b border-border/50 focus:border-secondary outline-none py-1.5 text-base text-foreground placeholder-muted-foreground"
                            />
                          </td>
                          <td className="p-4">
                             <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={sub.credits}
                              onChange={(e) => updateSubject(sub.id, 'credits', parseFloat(e.target.value))}
                              className="w-full text-center bg-muted/50 border border-transparent focus:border-secondary rounded-lg py-1.5 text-foreground outline-none"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={sub.internal}
                              onChange={(e) => updateSubject(sub.id, 'internal', parseFloat(e.target.value))}
                              className={`w-full text-center bg-muted/50 border rounded-lg py-1.5 text-foreground focus:outline-none ${sub.internal > 40 || sub.internal < 0 ? 'border-red-500' : 'border-transparent focus:border-secondary'}`}
                            />
                          </td>
                          <td className="p-4">
                             <input
                              type="number"
                              min="0"
                              max="60"
                              value={sub.external}
                              onChange={(e) => updateSubject(sub.id, 'external', parseFloat(e.target.value))}
                              className={`w-full text-center bg-muted/50 border rounded-lg py-1.5 text-foreground focus:outline-none ${sub.external > 60 || sub.external < 0 ? 'border-red-500' : 'border-transparent focus:border-secondary'}`}
                            />
                          </td>
                          <td className={`p-4 text-center font-bold text-base ${gradeInfo.color}`}>
                            {gradeInfo.label}
                          </td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => removeSubject(sub.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-muted/20 border-t border-border flex justify-between items-center">
                <button
                  onClick={addSubject}
                  className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors px-3 py-2 rounded-lg hover:bg-secondary/10"
                >
                  <Plus className="w-4 h-4" />
                  Add Subject
                </button>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={resetSubjects}
                        className="text-sm text-muted-foreground hover:text-red-500 px-3 py-2"
                    >
                        Reset All
                    </button>
                     <button
                        onClick={importCurrentSgpa}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-all shadow-md"
                    >
                        <Save className="w-4 h-4" />
                        Save to CGPA
                    </button>
                </div>
              </div>
            </div>
             <AdUnit className="mt-8" />
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
             <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                <div>
                   <h2 className="text-xl font-bold text-foreground">Overall Grades</h2>
                   <p className="text-sm text-muted-foreground">Cumulative Grade Point Average</p>
                </div>
                <div className="text-right">
                    <span className="text-4xl font-bold text-primary">{cgpa}</span>
                    <span className="text-sm text-muted-foreground ml-2">CGPA</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="p-4">Semester</th>
                      <th className="p-4 text-center">Total Credits</th>
                      <th className="p-4 text-center">SGPA</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {semesters.length === 0 && (
                        <tr>
                            <td colSpan={4} className="p-10 text-center text-sm text-muted-foreground italic">
                                No semesters added. Import from SGPA or add manually.
                            </td>
                        </tr>
                    )}
                    {semesters.map((sem) => (
                      <tr key={sem.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 pl-6">
                           <input
                              type="text"
                              value={sem.name}
                              onChange={(e) => updateSemester(sem.id, 'name', e.target.value)}
                              className="w-full bg-transparent border-b border-border/50 focus:border-primary outline-none py-1.5 text-base text-foreground"
                            />
                        </td>
                        <td className="p-4">
                           <input
                              type="number"
                              min="0"
                              value={sem.credits}
                              onChange={(e) => updateSemester(sem.id, 'credits', parseFloat(e.target.value))}
                              className="w-full text-center bg-muted/50 border border-transparent focus:border-primary rounded-lg py-1.5 text-foreground outline-none"
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
                              className="w-full text-center bg-muted/50 border border-transparent focus:border-primary rounded-lg py-1.5 text-foreground outline-none"
                            />
                        </td>
                        <td className="p-4 text-center">
                            <button 
                              onClick={() => removeSemester(sem.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

               <div className="p-4 bg-muted/20 border-t border-border flex justify-between items-center">
                <button
                  onClick={addSemester}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors px-3 py-2 rounded-lg hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" />
                  Add Semester
                </button>
                 {semesters.length > 0 && (
                    <button
                        onClick={resetSemesters}
                        className="text-sm text-red-500 hover:text-red-600 transition-colors px-3 py-2"
                    >
                        Clear All
                    </button>
                 )}
              </div>
            </div>
             <AdUnit className="mt-8" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalculatorPage;
