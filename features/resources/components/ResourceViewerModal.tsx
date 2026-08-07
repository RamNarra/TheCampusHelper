import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Download, Maximize2, Minimize2, FileText, AlertCircle } from 'lucide-react';
import { parseResourceEmbed } from '../utils/embedHelper';
import { Resource } from '../../../types';

interface ResourceViewerModalProps {
  resource: Resource | null;
  onClose: () => void;
}

export const ResourceViewerModal: React.FC<ResourceViewerModalProps> = ({ resource, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!resource) return null;

  const embedInfo = parseResourceEmbed(resource.downloadUrl, resource.driveFileId, resource.title);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
            isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[85vh]'
          }`}
        >
          {/* Top Bar */}
          <div className="px-6 py-4 border-b border-border bg-card/90 backdrop-blur flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">{resource.title}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{resource.subject}</span>
                  <span>•</span>
                  <span>Branch: {resource.branch}</span>
                  <span>•</span>
                  <span>Sem {resource.semester}</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={embedInfo.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </a>

              <a
                href={resource.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Open original link in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Embed Container */}
          <div className="flex-1 bg-neutral-900/90 relative overflow-hidden flex items-center justify-center">
            {embedInfo.embedType === 'direct-image' ? (
              <img
                src={embedInfo.previewUrl}
                alt={resource.title}
                className="max-w-full max-h-full object-contain p-4"
              />
            ) : (
              <iframe
                src={embedInfo.previewUrl}
                className="w-full h-full border-0"
                title={resource.title}
                allow="autoplay"
                allowFullScreen
              />
            )}
          </div>

          {/* Footer note */}
          <div className="px-6 py-2.5 bg-card border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-primary" />
              Preview powered by Sreenidhi Google Drive & Office Viewer.
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider">{resource.type} Material</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
