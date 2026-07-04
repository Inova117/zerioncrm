import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: string; // tailwind text color class for the icon chip
  accentBg?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'text-brand-600',
  accentBg = 'bg-brand-50',
}: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{label}</p>
        {icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accentBg, accent)}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-surface-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-surface-400">{hint}</p>}
    </div>
  );
}
