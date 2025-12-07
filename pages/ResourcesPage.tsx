
import React, { useState, useEffect } from 'react';
import { resources, getSubjects } from '../lib/data';
import { Resource, ResourceType } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Folder, 
  FileText, 
  Download, 
  ChevronRight, 
  Book, 
  Presentation, 
  HelpCircle, 
  FileQuestion,
  Home,
  ArrowLeft,
  FolderOpen,
  Sparkles,
  ExternalLink,
  Eye,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdUnit from '../components/AdUnit';
import AccessGate from '../components/AccessGate';

// Defined specific folder types for the UI state
type ViewState = 'SEMESTERS' | 'SUBJECTS' | 'SUBJECT_ROOT' | 'UNIT_CONTENTS' | 'FILES';

const ResourcesPage: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation State
  const [branch, setBranch] = useState<'CS_IT_DS' | 'AIML_ECE_CYS'>('CS_IT_DS');
  const [semester, setSemester] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ResourceType | null>(null);
  
  // File Action States
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [pendingResource, setPendingResource] = useState<Resource | null>(null);

  useEffect(() => {
    if (user && user.branch) {
      setBranch(user.branch);
    }
  }, [user]);

  useEffect(() => {
    if (selectedResource) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedResource]);

  const handleResourceClick = (res: Resource) => {
    if (!user) {
      setPendingResource(res);
      setShowAccessGate(true);
    } else {
      openResource(res);
    }
  };

  const openResource = (res: Resource) => {
    if (res.driveFileId) {
      setSelectedResource(res);
    } else {
      window.open(res.downloadUrl, '_blank');
    }
  };

  useEffect(() => {
    if (user && pendingResource) {
      openResource(pendingResource);
      setPendingResource(null);
    }
  }, [user, pendingResource]);

  const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  const subjectFolders = [
    { id: '1', label: 'Unit 1', type: 'unit' },
    { id: '2', label: 'Unit 2', type: 'unit' },
    { id: '3', label: 'Unit 3', type: 'unit' },
    { id: '4', label: 'Unit 4', type: 'unit' },
    { id: '5', label: 'Unit 5', type: 'unit' },
    { id: 'PYQ', label: 'PYQs', type: 'exam' },
    { id: 'MidPaper', label: 'Mid Exam Papers', type: 'exam' },
  ];

  const unitFolders = [
    { type: 'ImpQ', label: 'Important Questions', icon: HelpCircle, color: 'text-orange-500 bg-orange-500/10' },
    { type: 'Note', label: 'Class Notes', icon: Book, color: 'text-emerald-500 bg-emerald-500/10' },
    { type: 'PPT', label: 'Teacher PPTs', icon: Presentation, color: 'text-blue-500 bg-blue-500/10' },
  ];

  const getCurrentView = (): ViewState => {
    if (!semester) return 'SEMESTERS';
    if (!subject) return 'SUBJECTS';
    if (!selectedFolder) return 'SUBJECT_ROOT';
    
    const isUnit = ['1', '2', '3', '4', '5'].includes(selectedFolder);
    if (isUnit && !selectedCategory) return 'UNIT_CONTENTS';
    
    return 'FILES';
  };

  const currentView = getCurrentView();

  const getFilteredResources = () => {
    return resources.filter(r => {
      const matchBasic = r.branch === branch && 
                         r.semester === semester && 
                         r.subject === subject && 
                         r.status === 'approved';
      
      if (!matchBasic) return false;

      if (['PYQ', 'MidPaper'].includes(selectedFolder || '')) {
        return r.type === selectedFolder;
      } else {
        return r.unit === selectedFolder && r.type === selectedCategory;
      }
    });
  };

  const getEmbedUrl = (res: Resource) => {
    if (!res.driveFileId) return '';
    const isPresentation = res.type === 'PPT' || res.downloadUrl.includes('docs.google.com/presentation');
    if (isPresentation) {
      return `https://docs.google.com/presentation/d/${res.driveFileId}/embed?start=false&loop=false&delayms=3000`;
    }
    return `https://drive.google.com/file/d/${res.driveFileId}/preview`;
  };

  const getDownloadUrl = (res: Resource) => {
    if (res.downloadUrl && res.downloadUrl !== '#') return res.downloadUrl;
    return `https://drive.google.com/u/0/uc?id=${res.driveFileId}&export=download`;
  };

  const resetToHome = () => { setSemester(null); setSubject(null); setSelectedFolder(null); setSelectedCategory(null); setSelectedResource(null); };
  const resetToSemester = () => { setSubject(null); setSelectedFolder(null); setSelectedCategory(null); setSelectedResource(null); };
  const resetToSubject = () => { setSelectedFolder(null); setSelectedCategory(null); setSelectedResource(null); };
  const resetToFolder = () => { setSelectedCategory(null); setSelectedResource(null); };
  const resetToFiles = () => { setSelectedResource(null); };

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const getFolderLabel = (id: string) => {
    if (id === 'PYQ') return 'PYQs';
    if (id === 'MidPaper') return 'Mid Papers';
    return `Unit ${id}`;
  };

  const getCategoryLabel = (type: ResourceType) => {
    return unitFolders.find(f => f.type === type)?.label || type;
  };

  const branches = [
    { id: 'CS_IT_DS', label: 'CS / IT / DS' },
    { id: 'AIML_ECE_CYS', label: 'AIML / ECE / CYS' }
  ];

  return (
    <>
      <div className="min-h-screen pt-24 pb-12 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        <AdUnit className="mb-6" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Academic Resources</h1>
            <p className="text-muted-foreground">Select your branch group to explore subjects</p>
          </div>
          
          <div className="flex items-center gap-2 p-1 bg-muted rounded-xl w-full md:w-auto">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => { setBranch(b.id as any); resetToHome(); }}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  branch === b.id 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide mb-6 pb-2">
          <button onClick={resetToHome} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">{branches.find(b => b.id === branch)?.label}</span>
          </button>
          
          {semester && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToSemester} className={`hover:text-foreground transition-colors ${currentView === 'SUBJECTS' ? 'text-primary font-semibold' : ''}`}>
                Sem {semester}
              </button>
            </>
          )}

          {subject && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToSubject} className={`hover:text-foreground transition-colors ${currentView === 'SUBJECT_ROOT' ? 'text-primary font-semibold' : ''}`}>
                {subject.length > 15 ? subject.substring(0, 15) + '...' : subject}
              </button>
            </>
          )}

          {selectedFolder && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToFolder} className={`hover:text-foreground transition-colors ${currentView === 'UNIT_CONTENTS' ? 'text-primary font-semibold' : ''}`}>
                {getFolderLabel(selectedFolder)}
              </button>
            </>
          )}

          {selectedCategory && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToFiles} className={`hover:text-foreground transition-colors ${currentView === 'FILES' ? 'text-primary font-semibold' : ''}`}>
                {getCategoryLabel(selectedCategory)}
              </button>
            </>
          )}
        </nav>

        <AnimatePresence mode="wait">
          
          {/* VIEW 1: SEMESTERS */}
          {currentView === 'SEMESTERS' && (
            <motion.div
              key="semesters"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {semesters.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSemester(sem)}
                  className="group relative p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all text-left overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <span className="text-6xl font-bold text-foreground">{sem}</span>
                  </div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <Folder className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Semester {sem}</h3>
                    <p className="text-sm text-muted-foreground mt-1">View Subjects</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* VIEW 2: SUBJECTS LIST */}
          {currentView === 'SUBJECTS' && (
            <motion.div
              key="subjects"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-center gap-4 mb-6">
                <button onClick={resetToHome} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <h2 className="text-xl font-bold text-foreground">Select Subject</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getSubjects(branch, semester!).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSubject(sub)}
                    className="flex items-center p-4 bg-card border border-border rounded-xl hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                  >
                    <div className="p-3 bg-secondary/10 rounded-lg text-secondary mr-4 group-hover:scale-105 transition-transform flex-shrink-0">
                      <Book className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">{sub}</span>
                    <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </button>
                ))}
              </div>
              
              <AdUnit className="mt-8" />
            </motion.div>
          )}

          {/* VIEW 3: SUBJECT ROOT */}
          {currentView === 'SUBJECT_ROOT' && (
            <motion.div
              key="subject_root"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-center gap-4 mb-6">
                <button onClick={resetToSemester} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <h2 className="text-xl font-bold text-foreground line-clamp-1">{subject}</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjectFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-xl hover:bg-muted/30 hover:border-primary/30 hover:shadow-sm transition-all group text-center relative overflow-hidden"
                  >
                     <div className={`absolute top-0 left-0 w-full h-1 ${folder.type === 'unit' ? 'bg-primary/50' : 'bg-secondary/50'}`}></div>
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${folder.type === 'unit' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                      <FolderOpen className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-foreground mb-1">{folder.label}</h3>
                    <p className="text-xs text-muted-foreground">{folder.type === 'unit' ? 'Notes, PPTs, Imp Qs' : 'Exam Papers'}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* VIEW 4: UNIT CONTENTS */}
          {currentView === 'UNIT_CONTENTS' && (
            <motion.div
              key="unit_contents"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
               <div className="flex items-center gap-4 mb-6">
                <button onClick={resetToSubject} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <h2 className="text-xl font-bold text-foreground">Unit {selectedFolder} Materials</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {unitFolders.map((cat) => (
                  <button
                    key={cat.type}
                    onClick={() => setSelectedCategory(cat.type as any)}
                    className="flex items-center p-5 bg-card border border-border rounded-xl hover:bg-muted/30 hover:border-border transition-all text-left group"
                  >
                    <div className={`p-4 rounded-full mr-4 ${cat.color} group-hover:scale-110 transition-transform`}>
                      <cat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{cat.label}</h3>
                      <p className="text-sm text-muted-foreground">View files</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* VIEW 5: FILES LIST */}
          {currentView === 'FILES' && (
            <motion.div
              key="files"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-center gap-4 mb-6">
                <button onClick={() => {
                  if (['PYQ', 'MidPaper'].includes(selectedFolder || '')) resetToSubject();
                  else resetToFolder();
                }} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <h2 className="text-xl font-bold text-foreground">
                  {['PYQ', 'MidPaper'].includes(selectedFolder || '') 
                    ? getFolderLabel(selectedFolder!) 
                    : getCategoryLabel(selectedCategory!)}
                </h2>
              </div>

              {getFilteredResources().length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {getFilteredResources().map((res) => (
                    <div
                      key={res.id}
                      onClick={() => handleResourceClick(res)}
                      className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-sm transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="p-3 bg-muted rounded-lg text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-base">
                            {res.title}
                          </h4>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                            {res.unit && <span className="bg-muted px-2 py-0.5 rounded">Unit {res.unit}</span>}
                            <span className="truncate">{res.subject}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        className="p-3 bg-muted rounded-lg text-muted-foreground hover:bg-primary hover:text-white transition-colors flex-shrink-0 ml-2"
                        title={user ? (res.driveFileId ? "Preview" : "Download") : "Login to Access"}
                        onClick={(e) => {
                           e.stopPropagation();
                           handleResourceClick(res);
                        }}
                      >
                         {!user ? <Lock className="w-5 h-5" /> : (res.driveFileId ? <Eye className="w-5 h-5" /> : <Download className="w-5 h-5" />)}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-2xl">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Coming Soon</h3>
                  <p className="text-muted-foreground">We are currently working on this section.</p>
                </div>
              )}
              
              <AdUnit className="mt-8" />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ACCESS GATE MODAL */}
      <AccessGate 
        isOpen={showAccessGate} 
        onClose={() => setShowAccessGate(false)} 
        resourceTitle={pendingResource?.title}
      />

      {/* FULL SCREEN OVERLAY PREVIEW */}
      <AnimatePresence>
        {selectedResource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col"
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 h-16">
              <button 
                onClick={resetToFiles} 
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              
              <div className="flex-1 text-center px-4 hidden sm:block">
                 <span className="text-sm font-medium text-white truncate block max-w-md mx-auto">{selectedResource.title}</span>
              </div>
              
              <div className="flex items-center gap-2">
                 <a 
                  href={getDownloadUrl(selectedResource)}
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 w-full h-full bg-zinc-900 relative">
               {selectedResource.driveFileId ? (
                <iframe
                  src={getEmbedUrl(selectedResource)}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="autoplay; fullscreen"
                  title="File Preview"
                  sandbox="allow-forms allow-scripts allow-popups allow-same-origin allow-presentation"
                ></iframe>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <FileQuestion className="w-16 h-16 mb-4 opacity-50" />
                  <p>Preview not available for this file.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ResourcesPage;
