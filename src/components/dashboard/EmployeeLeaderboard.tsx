import type { EmployeeStats } from '../../types';
import { Avatar } from '../ui/Avatar';
import { cn, pct } from '../../lib/utils';

export function EmployeeLeaderboard({ stats }: { stats: EmployeeStats[] }) {
  if (stats.length === 0) {
    return <p className="py-6 text-center text-sm text-surface-400">Aún no hay staff.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
            <th className="px-2 py-2 font-medium">Staff</th>
            <th className="px-2 py-2 text-center font-medium">Contactadas</th>
            <th className="px-2 py-2 text-center font-medium">Tibios+</th>
            <th className="px-2 py-2 text-center font-medium">Calientes</th>
            <th className="px-2 py-2 text-center font-medium">Reuniones</th>
            <th className="px-2 py-2 text-center font-medium">Clientes</th>
            <th className="px-2 py-2 text-center font-medium">Tareas</th>
            <th className="px-2 py-2 text-right font-medium">Conversión</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const taskPct = pct(s.tasksDone, s.tasksTotal);
            return (
              <tr key={s.user.id} className="border-b border-surface-100 last:border-0">
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.user.name} color={s.user.avatarColor} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-surface-800">{s.user.name}</p>
                      <p className="truncate text-xs text-surface-400">{s.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-center font-medium text-surface-700">{s.contacted}</td>
                <td className="px-2 py-3 text-center text-amber-600">{s.tibio}</td>
                <td className="px-2 py-3 text-center text-red-600">{s.caliente}</td>
                <td className="px-2 py-3 text-center text-violet-600">{s.reuniones}</td>
                <td className="px-2 py-3 text-center font-semibold text-emerald-600">{s.clientes}</td>
                <td className="px-2 py-3 text-center text-surface-500">
                  {s.tasksDone}/{s.tasksTotal}
                  <span className="ml-1 text-xs text-surface-400">({taskPct}%)</span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-200">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          s.conversionRate >= 20 ? 'bg-cliente' : 'bg-brand-500'
                        )}
                        style={{ width: `${Math.min(100, s.conversionRate)}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs font-semibold text-surface-600">
                      {s.conversionRate}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
