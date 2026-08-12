import { Sun, LayoutDashboard, CalendarDays, Wallet, Map } from 'lucide-react';
import { cn } from '../../lib/utils';

export type RoadmapTabKey = 'hoy' | 'panel' | 'semanas' | 'finanzas' | 'roadmap';

const ROADMAP_TABS: { key: RoadmapTabKey; label: string; icon: typeof Sun }[] = [
  { key: 'hoy', label: 'Hoy', icon: Sun },
  { key: 'panel', label: 'Panel', icon: LayoutDashboard },
  { key: 'semanas', label: 'Semanas', icon: CalendarDays },
  { key: 'finanzas', label: 'Finanzas', icon: Wallet },
  { key: 'roadmap', label: 'Roadmap', icon: Map },
];

export function RoadmapTabs({
  active,
  onChange,
}: {
  active: RoadmapTabKey;
  onChange: (key: RoadmapTabKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROADMAP_TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'btn rounded-lg px-3.5 py-2',
            active === key
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'border border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
