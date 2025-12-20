import * as React from 'react';
import { cn } from '../../lib/utils';

export type PageProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export function Page({ className, children, ...props }: PageProps) {
  return (
    <div className={cn('flex-1', className)} {...props}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">{children}</div>
    </div>
  );
}

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
