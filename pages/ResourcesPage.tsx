
import React, { useState, useEffect } from 'react';
import { resources as staticResources, getSubjects } from '../lib/data';
import { Resource, ResourceType } from '../types';
import { useAuth } from '../context/AuthContext';
import { resourceService, extractDriveId } from '../services/firebase';
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
  Lock,
  Plus,
  Link as LinkIcon,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdUnit from '../components/AdUnit';
import AccessGate from '../components/AccessGate';

type ViewState = 'SEMESTERS' | 'SUBJECTS' | 'SUBJECT_ROOT' | 'UNIT_CONTENTS' | 'FILES';

const ResourcesPage: React.FC = () => {
  const { user } = useAuth();
  
  const [branch, setBranch] = useState<'CS_IT_DS' | 'AIML_ECE_CYS'>('CS_IT_DS');
  const [semester, setSemester] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ResourceType | null>(null);
  
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [pendingResource, setPendingResource] = useState<Resource | null>(null);

  // Dynamic Resources State
  const [dynamicResources, setDynamicResources] = useState<Resource[]>([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(true);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadLink, setUploadLink] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (user && user.branch) {
      setBranch(user.branch);
    }
  }, [user]);

  // Fetch Resources from Firestore (REAL-TIME LISTENER)
  useEffect(() => {
    setIsResourcesLoading(true);
    
    // Subscribe to updates
    const unsubscribe = resourceService.subscribeToResources((fetchedResources) => {
      setDynamicResources(fetchedResources);
      setIsResourcesLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!uploadName || !uploadLink) {
      setUploadError("Please provide both name and link.");
      return;
    }

    if (!semester || !subject || !selectedFolder || !selectedCategory) {
      setUploadError("Missing context. Please navigate to a specific folder.");
      return;
    }

    const driveId = extractDriveId(uploadLink);
    if (!driveId) {
        setUploadError("Could not detect a valid Google Drive ID from the link.");
        return;
    }

    setIsUploading(true);
    try {
        const newResource: Omit<Resource, 'id'> = {
            title: uploadName,
            subject: subject,
            branch: branch,
            semester: semester,
            unit: selectedFolder,
            type: selectedCategory,
            downloadUrl: uploadLink,
            driveFileId: driveId,
            status: 'approved'
        };

        // We just add to DB. The subscribeToResources listener in useEffect will update the UI automatically.
        await resourceService.addResource(newResource);
        
        // Reset and close
        setUploadName('');
        setUploadLink('');
        setShowUploadModal(false);
    } catch (err) {
        console.error(err);
        setUploadError("Failed to save resource. Check console for details.");
    } finally {
        setIsUploading(false);
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
    { id: 'MidPaper', label: 'Mid Exams', type: 'exam' },
  ];

  const unitFolders = [
    { type: 'ImpQ', label: 'Important Qs', icon: HelpCircle, color: 'text-orange-500 bg-orange-500/10' },
    { type: 'Note', label: 'Notes', icon: Book, color: 'text-emerald-500 bg-emerald-500/10' },
    { type: 'PPT', label: 'PPTs', icon: Presentation, color: 'text-blue-500 bg-blue-500/10' },
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
    // Merge static and dynamic resources
    // In a production app, you might want to fully move to dynamic resources eventually
    const allResources = [...staticResources, ...dynamicResources];
    
    return allResources.filter(r => {
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
    const isPresentation = res.type === 'PPT' || (res.downloadUrl && res.downloadUrl.includes('docs.google.com/presentation'));
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
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
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
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Resources</h1>
            <p className="text-muted-foreground mt-1">Select your branch and semester to access materials</p>
          </div>
          
          <div className="flex bg-muted p-1 rounded-xl">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => { setBranch(b.id as any); resetToHome(); }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
        <nav className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide mb-8 pb-2 border-b border-border/50">
          <button onClick={resetToHome} className="flex items-center gap-2 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
            <Home className="w-4 h-4" />
          </button>
          
          {semester && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToSemester} className={`hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted ${currentView === 'SUBJECTS' ? 'text-primary font-semibold' : ''}`}>
                Sem {semester}
              </button>
            </>
          )}

          {subject && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToSubject} className={`hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted ${currentView === 'SUBJECT_ROOT' ? 'text-primary font-semibold' : ''}`}>
                {subject.length > 25 ? subject.substring(0, 25) + '...' : subject}
              </button>
            </>
          )}

          {selectedFolder && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToFolder} className={`hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted ${currentView === 'UNIT_CONTENTS' ? 'text-primary font-semibold' : ''}`}>
                {getFolderLabel(selectedFolder)}
              </button>
            </>
          )}

          {selectedCategory && (
            <>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
              <button onClick={resetToFiles} className={`hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted ${currentView === 'FILES' ? 'text-primary font-semibold' : ''}`}>
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
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              {semesters.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSemester(sem)}
                  className="group relative p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-lg transition-all text-left overflow-hidden min-h-[160px]"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <span className="text-8xl font-bold text-foreground">{sem}</span>
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <Folder className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">Semester {sem}</h3>
                      <p className="text-sm text-muted-foreground mt-1">View Subjects</p>
                    </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getSubjects(branch, semester!).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSubject(sub)}
                    className="flex items-center p-5 bg-card border border-border rounded-xl hover:bg-muted/50 hover:border-primary/30 transition-all text-left group shadow-sm hover:shadow-md"
                  >
                    <div className="p-3 bg-secondary/10 rounded-lg text-secondary mr-4 group-hover:scale-105 transition-transform flex-shrink-0">
                      <Book className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">{sub}</span>
                    <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </button>
                ))}
              </div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {subjectFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-xl hover:bg-muted/30 hover:border-primary/30 hover:shadow-lg transition-all group text-center relative overflow-hidden h-40"
                  >
                     <div className={`absolute top-0 left-0 w-full h-1.5 ${folder.type === 'unit' ? 'bg-primary/50' : 'bg-secondary/50'}`}></div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${folder.type === 'unit' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-base text-foreground mb-1">{folder.label}</h3>
                    <p className="text-xs text-muted-foreground leading-tight">{folder.type === 'unit' ? 'Notes & Materials' : 'Question Papers'}</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {unitFolders.map((cat) => (
                  <button
                    key={cat.type}
                    onClick={() => setSelectedCategory(cat.type as any)}
                    className="flex items-center p-6 bg-card border border-border rounded-xl hover:bg-muted/30 hover:border-border transition-all text-left group shadow-sm hover:shadow-md"
                  >
                    <div className={`p-4 rounded-xl mr-5 ${cat.color} group-hover:scale-110 transition-transform`}>
                      <cat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{cat.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Browse files</p>
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
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-foreground">
                      Files for <span className="text-primary">{getCategoryLabel(selectedCategory!)}</span>
                  </h3>
                  
                  {user?.role === 'admin' && (
                      <button 
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium shadow-md"
                      >
                          <Plus className="w-4 h-4" />
                          Add Resource
                      </button>
                  )}
              </div>

              {isResourcesLoading ? (
                  <div className="flex justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
              ) : getFilteredResources().length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {getFilteredResources().map((res) => (
                    <div
                      key={res.id}
                      onClick={() => handleResourceClick(res)}
                      className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="p-3 bg-muted rounded-lg text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate">
                            {res.title}
                          </h4>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                            {res.unit && <span className="bg-muted px-2 py-0.5 rounded-md">Unit {res.unit}</span>}
                            <span className="truncate">{res.subject}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        className="p-2.5 bg-muted rounded-lg text-muted-foreground hover:bg-primary hover:text-white transition-colors flex-shrink-0 ml-3"
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
                <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-xl">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Coming Soon</h3>
                  <p className="text-sm text-muted-foreground">We are constantly updating our database.</p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
        
        <AdUnit className="mt-8" />
      </div>

      {/* ACCESS GATE MODAL */}
      <AccessGate 
        isOpen={showAccessGate} 
        onClose={() => setShowAccessGate(false)} 
        resourceTitle={pendingResource?.title}
      />

      {/* ADMIN UPLOAD MODAL */}
      <AnimatePresence>
          {showUploadModal && (
              <div className="fixed inset-0 z-[160] flex items-center justify-center px-4">
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    onClick={() => setShowUploadModal(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
                  />
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl"
                  >
                      <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl font-bold text-foreground">Upload Resource</h2>
                          <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground hover:text-foreground">
                              <X className="w-5 h-5" />
                          </button>
                      </div>

                      <form onSubmit={handleUploadSubmit} className="space-y-4">
                          <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display Name</label>
                              <div className="relative">
                                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <input 
                                      type="text" 
                                      value={uploadName}
                                      onChange={(e) => setUploadName(e.target.value)}
                                      placeholder="e.g. Unit 1 Class Notes"
                                      className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground focus:border-primary outline-none transition-all"
                                  />
                              </div>
                          </div>
                          
                          <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Drive Link</label>
                              <div className="relative">
                                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <input 
                                      type="url" 
                                      value={uploadLink}
                                      onChange={(e) => setUploadLink(e.target.value)}
                                      placeholder="https://drive.google.com/file/d/..."
                                      className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground focus:border-primary outline-none transition-all"
                                  />
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                  Supports 'View', 'Preview', and 'Edit' links. We will extract the ID automatically.
                              </p>
                          </div>

                          <div className="bg-muted/50 p-3 rounded-lg border border-border text-xs text-muted-foreground space-y-1">
                              <p><span className="font-semibold">Context:</span> {branch} &gt; {semester} &gt; {subject}</p>
                              <p><span className="font-semibold">Target:</span> {getFolderLabel(selectedFolder!)} &gt; {getCategoryLabel(selectedCategory!)}</p>
                          </div>

                          {uploadError && (
                              <p className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{uploadError}</p>
                          )}

                          <button
                              type="submit"
                              disabled={isUploading}
                              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload & Publish"}
                          </button>
                      </form>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

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
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 h-18">
              <button 
                onClick={resetToFiles} 
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              
              <div className="flex-1 text-center px-4 hidden sm:block">
                 <span className="text-base font-medium text-white truncate block max-w-xl mx-auto">{selectedResource.title}</span>
              </div>
              
              <div className="flex items-center gap-2">
                 <a 
                  href={getDownloadUrl(selectedResource)}
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
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
