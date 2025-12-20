import * as React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const base = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium';

const variants: Record<BadgeVariant, string> = {
  default: 'border-primary/20 bg-primary/10 text-primary',
  secondary: 'border-secondary/20 bg-secondary/10 text-secondary',
  destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
  outline: 'border-border bg-transparent text-muted-foreground',
};

export function Badge({ className, variant = 'outline', ...props }: BadgeProps) {
  return <span className={cn(base, variants[variant], className)} {...props} />;
}
