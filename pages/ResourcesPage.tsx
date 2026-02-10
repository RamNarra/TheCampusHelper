import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { resources as staticResources, getSubjects } from '../lib/data';
import { BranchKey, Resource, ResourceType } from '../types';
import { useAuth } from '../context/AuthContext';
import { isProfileComplete } from '../lib/profileCompleteness';
import { api } from '../services/firebase';
import { awardXP, unlockAchievement, XP_REWARDS } from '../services/gamification';
import { isAtLeastRole, normalizeRole } from '../lib/rbac';
import { 
  FileText, ChevronRight, Book, Presentation, HelpCircle,
  Home, ArrowLeft, FolderOpen, Sparkles, ExternalLink, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AccessGate from '../components/AccessGate';
import { safeExternalHttpUrl } from '../lib/utils';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type ViewState = 'SEMESTERS' | 'SUBJECTS' | 'SUBJECT_ROOT' | 'UNIT_CONTENTS' | 'FILES';

const ResourcesPage: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation State
  const branch: BranchKey = (user?.branch ?? 'CSE') as BranchKey;
  const [semester, setSemester] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ResourceType | null>(null);
  
  // Data State
  const [dynamicResources, setDynamicResources] = useState<Resource[]>([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(true);
  
  // UI State
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [pendingResource, setPendingResource] = useState<Resource | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Preview State
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfWidth, setPdfWidth] = useState<number>(0);
  
  // Upload State
  const [uploadName, setUploadName] = useState('');
  const [uploadLink, setUploadLink] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [lastSubmittedResource, setLastSubmittedResource] = useState<Resource | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    resource: Resource | null;
  }>({ open: false, x: 0, y: 0, resource: null });

  const isStaff = isAtLeastRole(normalizeRole(user?.role), 'moderator');

  const branchMatches = useCallback((resourceBranch: BranchKey): boolean => {
    return resourceBranch === branch;
  }, [branch]);

  useEffect(() => {
    if (!contextMenu.open) return;
    const close = () => setContextMenu({ open: false, x: 0, y: 0, resource: null });
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [contextMenu.open]);

  const openContextMenu = (e: React.MouseEvent, res: Resource) => {
    e.preventDefault();
    e.stopPropagation();

    const padding = 8;
    const maxX = window.innerWidth - padding;
    const maxY = window.innerHeight - padding;
    const x = Math.min(e.clientX || padding, maxX);
    const y = Math.min(e.clientY || padding, maxY);
    setContextMenu({ open: true, x, y, resource: res });
  };

  const canDeleteResource = (res: Resource) => {
    if (!user?.uid) return false;
    if (isStaff) return true;
    return res.ownerId === user.uid && (res.status || 'approved') === 'pending';
  };

  const deleteResourceFromMenu = async (res: Resource) => {
    if (!canDeleteResource(res)) return;
    const ok = window.confirm('Delete this resource?');
    if (!ok) return;
    try {
      await api.deleteResource(res.id);
      setContextMenu({ open: false, x: 0, y: 0, resource: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Delete failed:', err);
      window.alert(message || 'Delete failed');
    }
  };

  // Real-time Fetch
  useEffect(() => {
    // Queries must be constrained so they cannot include unreadable docs (e.g. pending resources for non-owners).
    setIsResourcesLoading(true);

    // Signed-out users: show approved resources (public).
    if (!user?.uid) {
      const unsub = api.onApprovedResourcesChanged((fetched) => {
        setDynamicResources(fetched);
        setIsResourcesLoading(false);
      });
      return () => unsub();
    }

    // Staff can see everything (including pending).
    if (isStaff) {
      const unsub = api.onAllResourcesChanged((fetched) => {
        setDynamicResources(fetched);
        setIsResourcesLoading(false);
      });
      return () => unsub();
    }

    // Regular users: show approved resources + their own pending submissions.
    let approved: Resource[] = [];
    let mine: Resource[] = [];

    const commit = () => {
      const map = new Map<string, Resource>();
      for (const r of approved) map.set(r.id, r);
      for (const r of mine) map.set(r.id, r);
      setDynamicResources(Array.from(map.values()));
      setIsResourcesLoading(false);
    };

    const unsubApproved = api.onApprovedResourcesChanged((list) => {
      approved = list;
      commit();
    });
    const unsubMine = api.onMyPendingResourcesChanged(user.uid, (list) => {
      mine = list;
      commit();
    });

    return () => {
      unsubApproved();
      unsubMine();
    };
  }, [user?.uid, isStaff]);

  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      // Keep some padding for scrollbars and mobile safe area.
      setPdfWidth(Math.max(0, Math.floor(rect.width)));
    };

    compute();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => compute()) : null;
    ro?.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [selectedResource]);

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
    // Always use the in-app preview overlay.
    setSelectedResource(res);
    setPdfNumPages(0);
    setPdfPage(1);
    setPdfLoadError(null);
    
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

  const getDownloadUrl = (res: Resource): string => {
    return safeExternalHttpUrl(res.downloadUrl) ?? 'about:blank';
  };

  const inferPreviewKind = (res: Resource): 'pdf' | 'pptx' | 'other' => {
    const mime = (res.mimeType || '').toLowerCase();
    if (mime === 'application/pdf') return 'pdf';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'pptx';

    const url = (safeExternalHttpUrl(res.downloadUrl) || '').toLowerCase();
    if (url.endsWith('.pdf') || url.includes('.pdf?') || url.includes('.pdf#')) return 'pdf';
    if (url.endsWith('.pptx') || url.includes('.pptx?') || url.includes('.pptx#')) return 'pptx';
    if (url.endsWith('.ppt') || url.includes('.ppt?') || url.includes('.ppt#')) return 'pptx';
    return 'other';
  };

  const getPptxEmbedUrl = (res: Resource): string | null => {
    const url = safeExternalHttpUrl(res.downloadUrl);
    if (!url) return null;
    // Office viewer can render PPT/PPTX if the URL is publicly accessible.
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  };

  // --- UPLOAD LOGIC ---
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess(null);
    setIsUploading(true);

    try {
        // 1. Validate Context
        if (!user?.uid) throw new Error('Please sign in to upload a resource.');
        if (!isProfileComplete(user)) throw new Error('Please complete your profile before uploading.');
        if (!semester || !subject || !selectedFolder) throw new Error("Please navigate to a specific folder first.");
        if (!uploadName.trim()) throw new Error("Resource name is required.");
        if (!uploadLink.trim() && !uploadFile) throw new Error("Please paste a link or upload a file.");

        const maxBytes = 20 * 1024 * 1024; // 20MB
        if (uploadFile && uploadFile.size > maxBytes) {
          throw new Error('File is too large (max 20MB).');
        }

        const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        const isPptx = (f: File) =>
          f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          f.name.toLowerCase().endsWith('.pptx');

        if (uploadFile && !(isPdf(uploadFile) || isPptx(uploadFile))) {
          throw new Error('Only PDF and PPTX files are allowed for now.');
        }

        // 2. Validate Category
        const isExamFolder = ['PYQ', 'MidPaper'].includes(selectedFolder);
        if (!isExamFolder && !selectedCategory) {
            throw new Error("Please select a category (Notes, PPT, etc.)");
        }

        // 3. Prepare Object
        const finalType = isExamFolder ? (selectedFolder as ResourceType) : selectedCategory!;

        const resourceId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
          ? (globalThis.crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        let finalUrl = uploadLink.trim();
        let mimeType: string | undefined;
        let originalFileName: string | undefined;
        let fileSizeBytes: number | undefined;
        let storagePath: string | undefined;

        if (uploadFile) {
          const uploaded = await api.uploadResourceFile({ uid: user.uid, resourceId, file: uploadFile });
          finalUrl = uploaded.downloadUrl;
          storagePath = uploaded.storagePath;
          mimeType = uploadFile.type || undefined;
          originalFileName = uploadFile.name || undefined;
          fileSizeBytes = uploadFile.size || undefined;
        } else {
          const safe = safeExternalHttpUrl(finalUrl);
          if (!safe) throw new Error('Please provide a valid http(s) URL.');
          finalUrl = safe;
        }

        const newResource: Omit<Resource, 'id'> = {
          title: uploadName.trim(),
            subject: subject,
            branch: branch,
            semester: semester,
            unit: selectedFolder,
            type: finalType,
            downloadUrl: finalUrl,
            mimeType,
            originalFileName,
            fileSizeBytes,
            storagePath,
          ownerId: user.uid,
          // Client submits as pending; staff approves via moderation tools.
          status: 'pending'
        };

        // 4. Send to Firebase (Protected by Timeout)
        const createdId = await api.addResource(newResource, { id: resourceId });
        const createdResource: Resource = { id: createdId, ...newResource };
        setLastSubmittedResource(createdResource);

        setUploadSuccess('Your resource has been submitted for approval. Once approved, it will be visible on the website.');

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
        setUploadFile(null);

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

  const filteredResources = useMemo(() => {
    return [...dynamicResources, ...staticResources].filter(r => {
      if (!branchMatches(r.branch) || r.semester !== semester || r.subject !== subject) return false;

      if (['PYQ', 'MidPaper'].includes(selectedFolder || '')) {
        return r.unit === selectedFolder || r.type === selectedFolder;
      }
      return r.unit === selectedFolder && r.type === selectedCategory;
    });
  }, [dynamicResources, branchMatches, semester, subject, selectedFolder, selectedCategory]);

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
    <div className="pt-6 pb-10 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Resources</h1>
                <p className="text-muted-foreground">Select semester</p>
            </div>
        </div>

        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 pb-2 border-b border-border/50 overflow-x-auto">
          <button onClick={resetToHome} aria-label="Home" title="Home"><Home className="w-4 h-4" /></button>
            {semester && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={resetToSemester}>Sem {semester}</button></>}
            {subject && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={resetToSubject} className="truncate max-w-[150px]">{subject}</button></>}
            {selectedFolder && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={resetToFolder}>{getFolderLabel(selectedFolder)}</button></>}
            {selectedCategory && <><ChevronRight className="w-4 h-4 opacity-50" /><span>{selectedCategory}</span></>}
        </nav>

        <AnimatePresence mode="wait">
            {currentView === 'SEMESTERS' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {semesters.map(sem => (
                  <button key={sem} onClick={() => setSemester(sem)} className="p-6 bg-card border border-border rounded-xl hover:border-primary transition-all text-left">
                    <span className="text-xl font-bold block mb-1">Semester {sem}</span>
                    <span className="text-sm text-muted-foreground">View Subjects</span>
                  </button>
                ))}
              </motion.div>
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
                      {user && isProfileComplete(user) && (
                            <Button
                              onClick={() => {
                                setUploadError('');
                                setUploadSuccess(null);
                                setLastSubmittedResource(null);
                                setShowUploadModal(true);
                              }}
                              size="md"
                            >
                                <Plus className="w-4 h-4" /> Add Resource
                            </Button>
                        )}
                    </div>

                    {isResourcesLoading ? (
                        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
                    ) : filteredResources.length > 0 ? (
                        <div className="grid gap-3">
                        {filteredResources.map(res => (
                                <div
                                  key={res.id}
                                  onClick={() => handleResourceClick(res)}
                                  onContextMenu={(e) => openContextMenu(e, res)}
                                  className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 cursor-pointer flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-muted rounded-lg"><FileText className="w-5 h-5 text-foreground" /></div>
                                        <div>
                                            <h4 className="font-medium group-hover:text-primary transition-colors">{res.title}</h4>
                                            <p className="text-xs text-muted-foreground">{res.subject}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {user?.uid && res.ownerId === user.uid && (res.status || 'approved') === 'pending' ? (
                                        <span className="text-xs px-2 py-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-300">
                                          Pending
                                        </span>
                                      ) : null}
                                        <ExternalLink className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                      <EmptyState
                        icon={<Sparkles className="h-6 w-6 text-primary" />}
                        title="No resources found here yet."
                      />
                    )}
                </motion.div>
            )}
        </AnimatePresence>

        {/* UPLOAD MODAL */}
        <AnimatePresence>
            {showUploadModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-sm backdrop-brightness-50" onClick={() => !isUploading && setShowUploadModal(false)} />
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-card w-full max-w-md p-6 rounded-2xl border border-border shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Upload Resource</h2>
                        {uploadSuccess ? (
                          <div className="space-y-4">
                            <Alert description={uploadSuccess} />
                            {lastSubmittedResource ? (
                              <Button
                                type="button"
                                onClick={() => {
                                  setShowUploadModal(false);
                                  handleResourceClick(lastSubmittedResource);
                                }}
                                variant="secondary"
                                className="w-full"
                                size="lg"
                              >
                                Preview my upload
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              onClick={() => setShowUploadModal(false)}
                              className="w-full"
                              size="lg"
                            >
                              Done
                            </Button>
                          </div>
                        ) : (
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
                                  placeholder="PDF/PPTX URL (https://...)" 
                                  value={uploadLink}
                                  onChange={e => {
                                    setUploadLink(e.target.value);
                                    if (e.target.value) setUploadFile(null);
                                  }}
                                  className="w-full bg-muted border border-border rounded-lg px-4 py-2 outline-none focus:border-primary"
                              />

                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="h-px flex-1 bg-border" />
                                <span>OR</span>
                                <div className="h-px flex-1 bg-border" />
                              </div>

                              <input
                                type="file"
                                accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                aria-label="Upload file"
                                title="Upload file"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  if (f) {
                                    const maxBytes = 20 * 1024 * 1024;
                                    if (f.size > maxBytes) {
                                      setUploadError('File is too large (max 20MB).');
                                      e.target.value = '';
                                      setUploadFile(null);
                                      return;
                                    }
                                  }
                                  setUploadFile(f);
                                  if (f && !uploadName.trim()) {
                                    const base = f.name.replace(/\.[^/.]+$/, '');
                                    const pretty = base.replace(/[_-]+/g, ' ').trim();
                                    if (pretty) setUploadName(pretty);
                                  }
                                  if (f) setUploadLink('');
                                }}
                                className="w-full bg-muted border border-border rounded-lg px-4 py-2 outline-none focus:border-primary"
                              />
                              <div className="text-xs text-muted-foreground -mt-2">
                                Accepted: PDF, PPTX{uploadFile ? ` · Selected: ${uploadFile.name}` : ''}
                              </div>
                              
                              <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                                  Using context: {branch} &gt; {semester} &gt; {subject} <br/>
                                  Target: {selectedFolder} {selectedCategory ? `> ${selectedCategory}` : ''}
                              </div>

                              {uploadError ? <Alert variant="destructive" description={uploadError} /> : null}

                                <Button disabled={isUploading} className="w-full" size="lg">
                                  {isUploading ? (
                                    <>
                                      <Spinner size="md" className="border-t-primary-foreground" />
                                      <span>Uploading…</span>
                                    </>
                                  ) : (
                                    'Upload'
                                  )}
                              </Button>
                          </form>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Right-click context menu */}
        <AnimatePresence>
          {contextMenu.open && contextMenu.resource && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.08 }}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              className="fixed z-[180] min-w-[200px] -translate-y-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted/60 transition-colors"
                onClick={() => {
                  const r = contextMenu.resource;
                  setContextMenu({ open: false, x: 0, y: 0, resource: null });
                  if (r) handleResourceClick(r);
                }}
              >
                Open / Preview
              </button>
              {canDeleteResource(contextMenu.resource) ? (
                <button
                  className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => {
                    const r = contextMenu.resource;
                    if (r) deleteResourceFromMenu(r);
                  }}
                >
                  Delete
                </button>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        <AccessGate isOpen={showAccessGate} onClose={() => setShowAccessGate(false)} resourceTitle={pendingResource?.title} />

        {selectedResource && (
             <div className="fixed inset-0 z-[200] bg-background flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-border bg-card text-foreground">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedResource(null)} className="gap-2">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <span className="font-semibold truncate max-w-md">{selectedResource.title}</span>
                    <a 
                      href={getDownloadUrl(selectedResource)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                        onClick={() => {
                            // Track interaction asynchronously without blocking the download
                            trackInteraction(selectedResource.id, 'download', selectedResource);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        Download
                    </a>
                </div>
                <div className="flex-1 bg-background overflow-hidden">
                  {(() => {
                    const kind = inferPreviewKind(selectedResource);
                    const url = safeExternalHttpUrl(selectedResource.downloadUrl);
                    if (!url) {
                      return (
                        <div className="w-full h-full flex items-center justify-center p-8 text-center text-muted-foreground">
                          <div className="max-w-lg">
                            <div className="font-semibold">Preview unavailable</div>
                            <div className="text-sm text-muted-foreground mt-2">
                              This resource doesn’t have a valid preview link. Use Download to open it.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (kind === 'pptx') {
                      const embed = getPptxEmbedUrl(selectedResource);
                      if (!embed) {
                        return (
                          <div className="w-full h-full flex items-center justify-center p-8 text-center text-muted-foreground">
                            <div className="max-w-lg">
                              <div className="font-semibold">Preview unavailable</div>
                              <div className="text-sm text-muted-foreground mt-2">
                                This PPTX can’t be embedded. Use Download to open it.
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <iframe
                          src={embed}
                          className="w-full h-full border-0"
                          allow="autoplay; fullscreen"
                          title="PPTX Preview"
                        />
                      );
                    }

                    if (kind === 'pdf') {
                      return (
                        <div ref={pdfContainerRef} className="w-full h-full overflow-auto">
                          <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">PDF</span>
                              {pdfNumPages > 0 ? (
                                <span className="tabular-nums">Page {pdfPage} / {pdfNumPages}</span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={pdfPage <= 1}
                                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                              >
                                Prev
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={pdfNumPages <= 0 || pdfPage >= pdfNumPages}
                                onClick={() => setPdfPage((p) => Math.min(pdfNumPages || p + 1, p + 1))}
                              >
                                Next
                              </Button>
                            </div>
                          </div>

                          <div className="px-4 py-6 flex justify-center">
                            <div className="w-full max-w-5xl">
                              {pdfLoadError ? (
                                <div className="rounded-xl border border-border bg-card p-6 text-center">
                                  <div className="font-semibold">Preview failed</div>
                                  <div className="text-sm text-muted-foreground mt-2">{pdfLoadError}</div>
                                  <div className="mt-4">
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                    >
                                      Open in new tab
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <Document
                                  file={{ url }}
                                  loading={
                                    <div className="flex justify-center py-10">
                                      <Spinner size="lg" />
                                    </div>
                                  }
                                  onLoadSuccess={(info) => {
                                    setPdfNumPages(info.numPages);
                                    setPdfPage(1);
                                  }}
                                  onLoadError={(err) => {
                                    const msg = err instanceof Error ? err.message : 'Unable to load PDF preview.';
                                    setPdfLoadError(msg);
                                  }}
                                >
                                  <Page
                                    pageNumber={pdfPage}
                                    width={Math.min(pdfWidth ? pdfWidth - 32 : 900, 1100)}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                  />
                                </Document>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="w-full h-full flex items-center justify-center p-8 text-center text-muted-foreground">
                        <div className="max-w-lg">
                          <div className="font-semibold">Preview unavailable</div>
                          <div className="text-sm text-muted-foreground mt-2">
                            Only PDF and PPTX previews are supported. Use Download to open this resource.
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
             </div>
        )}
    </div>
  );
};

export default ResourcesPage;
