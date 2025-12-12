import React, { useState, useEffect, useCallback } from 'react';
import { resources as staticResources, getSubjects } from '../lib/data';
import { Resource, ResourceType, RecommendationResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { api, extractDriveId } from '../services/firebase';
import { awardXP, unlockAchievement, XP_REWARDS } from '../services/gamification';
import { 
  Folder, FileText, Download, ChevronRight, Book, Presentation, HelpCircle, 
  FileQuestion, Home, ArrowLeft, FolderOpen, Sparkles, ExternalLink, Eye, 
  Lock, Plus, Loader2, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AccessGate from '../components/AccessGate';
import { 
  buildUserPreferences, 
  getHybridRecommendations 
} from '../lib/recommendationService';

type ViewState = 'SEMESTERS' | 'SUBJECTS' | 'SUBJECT_ROOT' | 'UNIT_CONTENTS' | 'FILES';

const ResourcesPage: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation State
  const [branch, setBranch] = useState<'CS_IT_DS' | 'AIML_ECE_CYS'>('CS_IT_DS');
  const [semester, setSemester] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ResourceType | null>(null);
  
  // Data State
  const [dynamicResources, setDynamicResources] = useState<Resource[]>([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(true);
  
  // Recommendation State
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  
  // UI State
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [pendingResource, setPendingResource] = useState<Resource | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Upload State
  const [uploadName, setUploadName] = useState('');
  const [uploadLink, setUploadLink] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (user && user.branch) {
      setBranch(user.branch);
    }
  }, [user]);

  // Real-time Fetch
  useEffect(() => {
    const unsubscribe = api.onResourcesChanged((fetched) => {
      setDynamicResources(fetched);
      setIsResourcesLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadRecommendations = useCallback(async () => {
    if (!user?.uid) return;
    
    setIsLoadingRecommendations(true);
    try {
      const [userInteractions, allInteractions] = await Promise.all([
        api.getUserInteractions(user.uid),
        api.getAllInteractions()
      ]);
      
      const allResources = [...dynamicResources, ...staticResources];
      const userPrefs = buildUserPreferences(
        userInteractions, 
        user.studyPattern || 'mixed',
        user.uid
      );
      
      const recs = getHybridRecommendations(
        user.uid,
        userPrefs,
        userInteractions,
        allInteractions,
        allResources,
        6
      );
      
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [user, dynamicResources]);

  // Load recommendations when user is logged in and not browsing a specific semester
  useEffect(() => {
    if (user?.uid && !semester) {
      loadRecommendations();
    }
  }, [user, semester, loadRecommendations]);

  const trackInteraction = async (
    resourceId: string, 
    type: 'view' | 'download',
    resource: Resource
  ) => {
    if (!user?.uid) return;
    
    try {
      await api.trackInteraction({
        userId: user.uid,
        resourceId,
        interactionType: type,
        subject: resource.subject,
        resourceType: resource.type,
        semester: resource.semester,
        branch: resource.branch
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  };

  const handleResourceClick = async (res: Resource) => {
    if (!user) {
      setPendingResource(res);
      setShowAccessGate(true);
    } else {
      await trackInteraction(res.id, 'view', res);
      openResource(res);
    }
  };

  const openResource = async (res: Resource) => {
    if (res.driveFileId) {
      setSelectedResource(res);
    } else {
      window.open(res.downloadUrl, '_blank');
    }
    
    // Award XP for viewing resource
    if (user) {
      await awardXP(user.uid, XP_REWARDS.RESOURCE_VIEW, 'Viewed a resource');
      
      // Only try to unlock 'first_resource' if not already unlocked
      if (!user.achievementIds?.includes('first_resource')) {
        await unlockAchievement(user.uid, 'first_resource');
      }
      
      // Track total resources viewed for resource_master achievement
      // Note: This requires a resourcesViewed counter field in the user profile
      // TODO: Implement resource view counter and unlock resource_master at 50 views
    }
  };

  // --- UPLOAD LOGIC ---
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setIsUploading(true);

    try {
        // 1. Validate Context
        if (!semester || !subject || !selectedFolder) throw new Error("Please navigate to a specific folder first.");
        if (!uploadName.trim()) throw new Error("Resource name is required.");
        if (!uploadLink.trim()) throw new Error("Link is required.");

        // 2. Validate Category
        const isExamFolder = ['PYQ', 'MidPaper'].includes(selectedFolder);
        if (!isExamFolder && !selectedCategory) {
            throw new Error("Please select a category (Notes, PPT, etc.)");
        }

        // 3. Prepare Object
        const finalType = isExamFolder ? (selectedFolder as ResourceType) : selectedCategory!;
        const driveId = extractDriveId(uploadLink);

        const newResource: Omit<Resource, 'id'> = {
            title: uploadName,
            subject: subject,
            branch: branch,
            semester: semester,
            unit: selectedFolder,
            type: finalType,
            downloadUrl: uploadLink,
            driveFileId: driveId || undefined,
            status: 'approved' // Auto-approve for admins
        };

        // 4. Send to Firebase (Protected by Timeout)
        await api.addResource(newResource);

        // 5. Award XP for contribution
        if (user) {
          await awardXP(user.uid, XP_REWARDS.RESOURCE_UPLOAD, 'Uploaded a resource');
          
          // Only try to unlock 'contributor' if not already unlocked
          if (!user.achievementIds?.includes('contributor')) {
            await unlockAchievement(user.uid, 'contributor');
          }
        }

        // 6. Success State
        setUploadName('');
        setUploadLink('');
        setShowUploadModal(false);

    } catch (err: any) {
        console.error("Upload error:", err);
        setUploadError(err.message || "Failed to upload resource. Please try again.");
    } finally {
        setIsUploading(false);
    }
  };

  // --- VIEW HELPERS ---
  const getCurrentView = (): ViewState => {
    if (!semester) return 'SEMESTERS';
    if (!subject) return 'SUBJECTS';
    if (!selectedFolder) return 'SUBJECT_ROOT';
    if (['PYQ', 'MidPaper'].includes(selectedFolder)) return 'FILES';
    if (!selectedCategory) return 'UNIT_CONTENTS';
    return 'FILES';
  };

  const currentView = getCurrentView();

  const getFilteredResources = () => {
    return [...dynamicResources, ...staticResources].filter(r => {
      if (r.branch !== branch || r.semester !== semester || r.subject !== subject) return false;
      
      if (['PYQ', 'MidPaper'].includes(selectedFolder || '')) {
         return r.unit === selectedFolder || r.type === selectedFolder;
      }
      return r.unit === selectedFolder && r.type === selectedCategory;
    });
  };

  // --- UI CONSTANTS ---
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

  const resetToHome = () => { setSemester(null); setSubject(null); setSelectedFolder(null); setSelectedCategory(null); };
  const resetToSemester = () => { setSubject(null); setSelectedFolder(null); setSelectedCategory(null); };
  const resetToSubject = () => { setSelectedFolder(null); setSelectedCategory(null); };
  const resetToFolder = () => { setSelectedCategory(null); };

  const getFolderLabel = (id: string) => {
      if (id === 'PYQ') return 'PYQs';
      if (id === 'MidPaper') return 'Mid Papers';
      return `Unit ${id}`;
  };

  return (
    <div className="min-h-screen pt-24 pb-12 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Resources</h1>
                <p className="text-muted-foreground">Select branch and semester</p>
            </div>
            <div className="flex bg-muted p-1 rounded-xl h-fit">
                <button onClick={() => setBranch('CS_IT_DS')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${branch === 'CS_IT_DS' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>CS / IT / DS</button>
                <button onClick={() => setBranch('AIML_ECE_CYS')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${branch === 'AIML_ECE_CYS' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>AIML / ECE</button>
            </div>
        </div>

        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 pb-2 border-b border-border/50 overflow-x-auto">
            <button onClick={resetToHome}><Home className="w-4 h-4" /></button>
            {semester && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={resetToSemester}>Sem {semester}</button></>}
            {subject && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={resetToSubject} className="truncate max-w-[150px]">{subject}</button></>}
            {selectedFolder && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={resetToFolder}>{getFolderLabel(selectedFolder)}</button></>}
            {selectedCategory && <><ChevronRight className="w-4 h-4 opacity-50" /><span>{selectedCategory}</span></>}
        </nav>

        <AnimatePresence mode="wait">
            {currentView === 'SEMESTERS' && (
                <>
                    {/* Recommendations Section */}
                    {user && recommendations.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="mb-8"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-bold text-foreground">Recommended for You</h2>
                                <span className="text-xs text-muted-foreground">Based on your activity</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {recommendations.map((rec, idx) => (
                                    <motion.div
                                        key={rec.resource.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        onClick={() => handleResourceClick(rec.resource)}
                                        className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 cursor-pointer group relative overflow-hidden"
                                    >
                                        <div className="absolute top-2 right-2">
                                            <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                                                <TrendingUp className="w-3 h-3" />
                                                {rec.reason === 'collaborative' && 'Popular'}
                                                {rec.reason === 'content-based' && 'Matched'}
                                                {rec.reason === 'time-based' && 'Timely'}
                                                {rec.reason === 'popular' && 'Trending'}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-muted rounded-lg">
                                                <FileText className="w-5 h-5 text-foreground" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                                                    {rec.resource.title}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {rec.resource.subject}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    <span>Sem {rec.resource.semester}</span>
                                                    <span>•</span>
                                                    <span>{rec.resource.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {isLoadingRecommendations && user && (
                        <div className="flex items-center gap-2 text-muted-foreground mb-8">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Loading personalized recommendations...</span>
                        </div>
                    )}

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {semesters.map(sem => (
                            <button key={sem} onClick={() => setSemester(sem)} className="p-6 bg-card border border-border rounded-xl hover:border-primary transition-all text-left">
                                <span className="text-xl font-bold block mb-1">Semester {sem}</span>
                                <span className="text-sm text-muted-foreground">View Subjects</span>
                            </button>
                        ))}
                    </motion.div>
                </>
            )}

            {currentView === 'SUBJECTS' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {getSubjects(branch, semester!).map(sub => (
                        <button key={sub} onClick={() => setSubject(sub)} className="p-4 bg-card border border-border rounded-xl hover:border-primary transition-all text-left flex items-center justify-between group">
                            <span className="font-medium">{sub}</span>
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                </motion.div>
            )}

            {currentView === 'SUBJECT_ROOT' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {subjectFolders.map(folder => (
                        <button key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`p-6 bg-card border border-border rounded-xl hover:shadow-lg transition-all text-center flex flex-col items-center gap-3 relative overflow-hidden ${folder.type === 'unit' ? 'hover:border-primary/50' : 'hover:border-secondary/50'}`}>
                            <div className={`absolute top-0 w-full h-1 ${folder.type === 'unit' ? 'bg-primary' : 'bg-secondary'}`} />
                            <FolderOpen className={`w-8 h-8 ${folder.type === 'unit' ? 'text-primary' : 'text-secondary'}`} />
                            <span className="font-bold">{folder.label}</span>
                        </button>
                    ))}
                </motion.div>
            )}

            {currentView === 'UNIT_CONTENTS' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {unitFolders.map(cat => (
                        <button key={cat.type} onClick={() => setSelectedCategory(cat.type as any)} className="p-6 bg-card border border-border rounded-xl hover:bg-muted/50 transition-all flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${cat.color}`}><cat.icon className="w-6 h-6" /></div>
                            <div className="text-left">
                                <h3 className="font-bold">{cat.label}</h3>
                                <p className="text-xs text-muted-foreground">Browse files</p>
                            </div>
                        </button>
                    ))}
                </motion.div>
            )}

            {currentView === 'FILES' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold">Files</h2>
                        {user?.role === 'admin' && (
                            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
                                <Plus className="w-4 h-4" /> Add Resource
                            </button>
                        )}
                    </div>

                    {isResourcesLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : getFilteredResources().length > 0 ? (
                        <div className="grid gap-3">
                            {getFilteredResources().map(res => (
                                <div key={res.id} onClick={() => handleResourceClick(res)} className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 cursor-pointer flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-muted rounded-lg"><FileText className="w-5 h-5 text-foreground" /></div>
                                        <div>
                                            <h4 className="font-medium group-hover:text-primary transition-colors">{res.title}</h4>
                                            <p className="text-xs text-muted-foreground">{res.subject}</p>
                                        </div>
                                    </div>
                                    {res.driveFileId ? <Eye className="w-5 h-5 text-muted-foreground" /> : <ExternalLink className="w-5 h-5 text-muted-foreground" />}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-muted-foreground">
                            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            <p>No resources found here yet.</p>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>

        {/* UPLOAD MODAL */}
        <AnimatePresence>
            {showUploadModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isUploading && setShowUploadModal(false)} />
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-card w-full max-w-md p-6 rounded-2xl border border-border shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Upload Resource</h2>
                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <input 
                                type="text" 
                                placeholder="Display Name (e.g. Unit 1 Notes)" 
                                value={uploadName}
                                onChange={e => setUploadName(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-4 py-2 outline-none focus:border-primary"
                            />
                            <input 
                                type="url" 
                                placeholder="Drive Link or URL" 
                                value={uploadLink}
                                onChange={e => setUploadLink(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-4 py-2 outline-none focus:border-primary"
                            />
                            
                            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                                Using context: {branch} &gt; {semester} &gt; {subject} <br/>
                                Target: {selectedFolder} {selectedCategory ? `> ${selectedCategory}` : ''}
                            </div>

                            {uploadError && <div className="text-red-500 text-sm">{uploadError}</div>}

                            <button disabled={isUploading} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 flex justify-center">
                                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload"}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <AccessGate isOpen={showAccessGate} onClose={() => setShowAccessGate(false)} resourceTitle={pendingResource?.title} />

        {selectedResource && (
             <div className="fixed inset-0 z-[200] bg-black flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 text-white">
                    <button onClick={() => setSelectedResource(null)} className="flex items-center gap-2 hover:text-gray-300"><ArrowLeft className="w-4 h-4" /> Back</button>
                    <span className="font-bold truncate max-w-md">{selectedResource.title}</span>
                    <a 
                        href={selectedResource.downloadUrl || `https://drive.google.com/u/0/uc?id=${selectedResource.driveFileId}&export=download`} 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={() => {
                            // Track interaction asynchronously without blocking the download
                            trackInteraction(selectedResource.id, 'download', selectedResource);
                        }}
                        className="bg-primary px-4 py-2 rounded-lg text-sm hover:bg-primary/90"
                    >
                        Download
                    </a>
                </div>
                <div className="flex-1 bg-zinc-900">
                    <iframe src={`https://drive.google.com/file/d/${selectedResource.driveFileId}/preview`} className="w-full h-full border-0" allow="autoplay" title="Preview" />
                </div>
             </div>
        )}
    </div>
  );
};

export default ResourcesPage;
