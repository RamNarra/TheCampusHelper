import * as React from 'react';
import { cn } from '../../lib/utils';

export type AlertVariant = 'default' | 'destructive';

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
  description?: string;
};

const variants: Record<AlertVariant, string> = {
  default: 'border-border bg-muted/40 text-foreground',
  destructive: 'border-destructive/30 bg-destructive/10 text-foreground',
};

export function Alert({ className, variant = 'default', title, description, children, ...props }: AlertProps) {
  return (
    <div
      className={cn('rounded-xl border p-4', variants[variant], className)}
      role={variant === 'destructive' ? 'alert' : 'status'}
      {...props}
    >
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      {children ? <div className={cn(title || description ? 'mt-3' : undefined)}>{children}</div> : null}
    </div>
  );
}
