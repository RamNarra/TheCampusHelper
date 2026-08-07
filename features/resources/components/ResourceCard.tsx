import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Eye, Download, Sparkles, CheckCircle2, Brain, HelpCircle, ArrowUpRight } from 'lucide-react';
import { Resource } from '../../../types';
import { useNavigate } from 'react-router-dom';

interface ResourceCardProps {
  resource: Resource;
  onPreview: (res: Resource) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onPreview }) => {
  const navigate = useNavigate();

  const handleAiAction = (action: 'summarize' | 'quiz' | 'impq') => {
    if (action === 'quiz') {
      navigate(`/quiz?topic=${encodeURIComponent(resource.title)}&subject=${encodeURIComponent(resource.subject)}`);
    } else if (action === 'summarize') {
      navigate(`/study-assistant?q=${encodeURIComponent(`Summarize the core concepts of ${resource.title} for ${resource.subject}`)}`);
    } else {
      navigate(`/study-assistant?q=${encodeURIComponent(`Give me top 5 exam questions for ${resource.subject} - ${resource.title}`)}`);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all flex flex-col justify-between group"
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <span>{resource.unit || resource.type}</span>
          </div>

          {resource.verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Faculty Verified
            </span>
          )}
        </div>

        {/* Title & Subject */}
        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5 leading-snug">
          {resource.title}
        </h3>
        <p className="text-xs font-medium text-muted-foreground mb-4">
          {resource.subject} • Sem {resource.semester} ({resource.branch})
        </p>

        {/* Tags */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {resource.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded-md bg-muted text-[11px] text-muted-foreground font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        {/* Views & Downloads Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/60 mb-4">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-muted-foreground/70" /> {resource.views || 120} views
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5 text-muted-foreground/70" /> {resource.downloads || 45} downloads
          </span>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => onPreview(resource)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-semibold transition-all"
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

        {/* AI Action Strip */}
        <div className="pt-2 border-t border-dashed border-border/70 flex items-center justify-between gap-1 text-[11px]">
          <span className="text-muted-foreground font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-secondary" /> AI Actions:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAiAction('summarize')}
              className="px-2 py-1 rounded-md bg-secondary/10 text-secondary hover:bg-secondary/20 font-medium transition-colors"
              title="Summarize key points"
            >
              Summarize
            </button>
            <button
              onClick={() => handleAiAction('quiz')}
              className="px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors"
              title="Generate Quiz"
            >
              Quiz
            </button>
            <button
              onClick={() => handleAiAction('impq')}
              className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-medium transition-colors"
              title="Exam Questions"
            >
              ImpQ
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
