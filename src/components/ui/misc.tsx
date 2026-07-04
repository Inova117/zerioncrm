import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}

export function PageLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-surface-400">
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-300 bg-surface-50/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-surface-300">{icon}</div>}
      <h3 className="text-sm font-semibold text-surface-700">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-surface-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  right,
}: {
  children: ReactNode;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-surface-800">{children}</h2>
        {hint && <p className="text-xs text-surface-400">{hint}</p>}
      </div>
      {right}
    </div>
  );
}
