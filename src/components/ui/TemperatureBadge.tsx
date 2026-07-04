import type { Temperature } from '../../types';
import { stageConfig } from '../../lib/constants';
import { cn } from '../../lib/utils';

export function TemperatureBadge({
  temperature,
  className,
}: {
  temperature: Temperature;
  className?: string;
}) {
  const s = stageConfig(temperature);
  return (
    <span className={cn('badge', s.soft, s.text, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}
