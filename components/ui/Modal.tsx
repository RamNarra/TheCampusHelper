import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Modal({ isOpen, onClose, title, description, children, footer, className }: ModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm backdrop-brightness-50"
        onPointerDown={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl', className)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="p-5 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                {title ? <div className="text-lg font-semibold text-foreground">{title}</div> : null}
                {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="p-5">{children}</div>
        {footer ? <div className="p-5 pt-0">{footer}</div> : null}
      </div>
    </div>
  );
}
