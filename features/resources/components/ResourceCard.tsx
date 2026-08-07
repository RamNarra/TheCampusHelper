import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Download, Sparkles, CheckCircle2, Bookmark, Flame, HelpCircle, BookOpen } from 'lucide-react';
import { Resource } from '../../../types';
import { useNavigate } from 'react-router-dom';

interface ResourceCardProps {
  resource: Resource;
  onPreview: (res: Resource) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (resId: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  onPreview,
  isBookmarked = false,
  onToggleBookmark
}) => {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(isBookmarked);

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(!saved);
    if (onToggleBookmark) {
      onToggleBookmark(resource.id);
    }
  };

  const handleAiAction = (action: 'summary' | 'quiz' | 'expected' | 'explain') => {
    if (action === 'quiz') {
      navigate(`/quiz?topic=${encodeURIComponent(resource.title)}&subject=${encodeURIComponent(resource.subject)}`);
    } else if (action === 'summary') {
      navigate(`/study-assistant?q=${encodeURIComponent(`Summarize the core concepts of ${resource.title} for ${resource.subject}`)}`);
    } else if (action === 'expected') {
      navigate(`/study-assistant?q=${encodeURIComponent(`List top 5 most expected mid/end semester exam questions for ${resource.subject} - ${resource.title}`)}`);
    } else {
      navigate(`/study-assistant?q=${encodeURIComponent(`Explain the most difficult concepts in ${resource.subject} (${resource.title}) step-by-step for a beginner`)}`);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all flex flex-col justify-between group relative overflow-hidden"
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              {resource.unit || resource.type}
            </span>
            {resource.verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
          </div>

          <button
            onClick={handleBookmarkToggle}
            className={`p-2 rounded-xl transition-all ${
              saved
                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={saved ? 'Remove Bookmark' : 'Save Bookmark'}
          >
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-amber-500' : ''}`} />
          </button>
        </div>

        {/* Title & Subject */}
        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5 leading-snug">
          {resource.title}
        </h3>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          {resource.subject} • Sem {resource.semester} ({resource.branch})
        </p>

        {/* Tags / Fuzzy Topics */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {resource.tags.slice(0, 4).map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded-md bg-muted/60 text-[11px] text-muted-foreground font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        {/* Real Stats / Badge Row */}
        {(resource.views || resource.downloads) ? (
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/60 mb-4">
            {resource.views ? (
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-muted-foreground/70" /> {resource.views} views
              </span>
            ) : null}
            {resource.downloads ? (
              <span className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5 text-muted-foreground/70" /> {resource.downloads} downloads
              </span>
            ) : null}
          </div>
        ) : (
          <div className="pt-2 border-t border-border/40 mb-3" />
        )}

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => onPreview(resource)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <a
            href={resource.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" /> Download
          </a>
        </div>

        {/* Enhanced AI Actions Grid */}
        <div className="pt-2.5 border-t border-dashed border-border/70 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-secondary" /> AI Learning Suite:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              onClick={() => handleAiAction('summary')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 font-medium transition-colors text-left"
            >
              <BookOpen className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">✨ Summary</span>
            </button>
            <button
              onClick={() => handleAiAction('quiz')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors text-left"
            >
              <HelpCircle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">📝 Quiz</span>
            </button>
            <button
              onClick={() => handleAiAction('expected')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-medium transition-colors text-left"
            >
              <Flame className="w-3 h-3 flex-shrink-0 text-amber-500" />
              <span className="truncate">🔥 Expected Qs</span>
            </button>
            <button
              onClick={() => handleAiAction('explain')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-medium transition-colors text-left"
            >
              <Sparkles className="w-3 h-3 flex-shrink-0 text-emerald-500" />
              <span className="truncate">🧠 Explain</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
