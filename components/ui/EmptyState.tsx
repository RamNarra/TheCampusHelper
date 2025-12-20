import * as React from 'react';
import { cn } from '../../lib/utils';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('py-10 text-center', className)}>
      {icon ? (
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/30 text-foreground">
          {icon}
        </div>
      ) : null}
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
