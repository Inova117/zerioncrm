import type { FunnelStage } from '../../types';
import { stageConfig } from '../../lib/constants';
import { cn } from '../../lib/utils';

/** Horizontal funnel: how many leads reached each stage. */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="space-y-2.5">
      {stages.map((s) => {
        const cfg = stageConfig(s.temperature);
        const width = Math.max(4, (s.count / max) * 100);
        return (
          <div key={s.temperature} className="flex items-center gap-3">
            <div className="flex w-20 shrink-0 items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
              <span className="text-xs font-medium text-surface-600">{cfg.label}</span>
            </div>
            <div className="h-7 flex-1 overflow-hidden rounded-lg bg-surface-100">
              <div
                className="flex h-full items-center justify-end rounded-lg px-2.5 text-xs font-semibold text-white transition-all"
                style={{ width: `${width}%`, backgroundColor: cfg.color }}
              >
                {s.count > 0 && s.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
