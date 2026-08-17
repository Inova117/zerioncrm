import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, Clock, Flag, Square } from 'lucide-react';
import type { CashMove, RoadmapActivity, RoadmapActivityStatus, RoadmapClient, RoadmapDay, RoadmapPhase } from '../../types';
import { ICP_TEXT, LISTA_MIX, MARKETING_CHANNELS, PLAN_WEEKS, REPARTO_LEGEND, weekRange } from '../../data/roadmapDefaults';
import { cashBalance, gateCheck, gateKindForWeek, todayKey, totals } from '../../lib/roadmapCalc';
import { cn } from '../../lib/utils';

interface RoadmapTabProps {
  activities: RoadmapActivity[];
  days: RoadmapDay[];
  clients: RoadmapClient[];
  cash: CashMove[];
  setActivityStatus: (id: string, status: RoadmapActivityStatus) => Promise<void>;
}

const fmtShort = (d: string) => format(parseISO(d), 'd MMM', { locale: es });

const PHASE_BADGE: Record<RoadmapPhase, string> = {
  Estrategia: 'bg-indigo-50 text-indigo-700',
  Oferta: 'bg-pink-50 text-pink-700',
  Producto: 'bg-violet-50 text-violet-700',
  Ventas: 'bg-brand-50 text-brand-700',
  Contenido: 'bg-orange-50 text-orange-700',
  Control: 'bg-amber-50 text-amber-700',
  Sistema: 'bg-teal-50 text-teal-700',
  Escala: 'bg-emerald-50 text-emerald-700',
};

const NEXT_STATUS: Record<RoadmapActivityStatus, RoadmapActivityStatus> = {
  pendiente: 'hecho',
  hecho: 'cancelado',
  cancelado: 'pendiente',
};

function StatusIcon({ status }: { status: RoadmapActivityStatus }) {
  if (status === 'hecho') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === 'cancelado') return <AlertCircle className="h-5 w-5 text-surface-300" />;
  return <Square className="h-5 w-5 text-surface-300" />;
}

/** Roadmap: 16 actividades por semana con estado, fases y gates computados. */
export function RoadmapTab({ activities, days, clients, cash, setActivityStatus }: RoadmapTabProps) {
  const t = totals(days, clients);
  const cashNet = cashBalance(cash).net;
  const today = todayKey();
  const done = activities.filter((a) => a.status === 'hecho').length;
  const pctDone = activities.length > 0 ? Math.round((done / activities.length) * 100) : 0;

  const gateVerdict = (a: RoadmapActivity): boolean | null => {
    const kind = gateKindForWeek(a.week);
    if (!kind) return null;
    // Sin ningún dato aún → neutral (no asustar el día 1 con un ❌ falso).
    const noData = t.demos === 0 && t.income === 0 && t.webs === 0 && t.aaas === 0 && clients.length === 0 && cashNet === 0;
    if (noData) return null;
    return gateCheck(kind, t, cashNet);
  };

  return (
    <div className="space-y-5">
      {/* Progreso */}
      <section className="card p-4">
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold text-surface-800">
            Progreso del plan: {done}/{activities.length} actividades
          </p>
          <p className="font-medium text-surface-500">{pctDone}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pctDone}%` }} />
        </div>
        <p className="mt-2 text-xs text-surface-400">
          Clic en el cuadro para marcar hecho · otro clic para cancelar · otro para volver. Las filas con 🚩 son gates: su veredicto se calcula solo.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
          {REPARTO_LEGEND.map((r) => (
            <span key={r.key} className="flex items-center gap-1">
              <span>{r.emoji}</span> {r.label}
            </span>
          ))}
        </div>
      </section>

      {/* Estrategia y canales */}
      <section className="card p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-surface-800">ICP (un solo perfil)</h3>
            <p className="mt-1 text-sm text-surface-600">{ICP_TEXT}</p>
            <p className="mt-2 text-xs text-surface-400">
              <strong className="text-surface-500">Lista de 100:</strong> {LISTA_MIX}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-800">Marketing (en orden)</h3>
            <ol className="mt-1 space-y-1.5 text-sm">
              {MARKETING_CHANNELS.map((c, i) => (
                <li key={c.canal} className="text-surface-600">
                  <span className="mr-1 font-semibold text-surface-400">{i + 1}.</span>
                  <strong className="text-surface-700">{c.canal}.</strong> {c.detalle}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Semanas */}
      {Array.from({ length: PLAN_WEEKS }, (_, i) => i + 1).map((week) => {
        const rows = activities.filter((a) => a.week === week).sort((a, b) => a.sort - b.sort);
        if (rows.length === 0) return null;
        const { desde, hasta } = weekRange(week);
        return (
          <section key={week} className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">S{week}</span>
              <span className="text-xs text-surface-400">
                {fmtShort(desde)} – {fmtShort(hasta)}
              </span>
            </div>
            <ul className="divide-y divide-surface-100">
              {rows.map((a) => {
                const verdict = gateVerdict(a);
                const overdue = a.status === 'pendiente' && a.dueDate != null && a.dueDate < today;
                return (
                  <li key={a.id} className="flex items-start gap-3 py-2.5">
                    <button
                      type="button"
                      className="mt-0.5 shrink-0"
                      title="Cambiar estado"
                      onClick={() => setActivityStatus(a.id, NEXT_STATUS[a.status])}
                    >
                      <StatusIcon status={a.status} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm',
                          a.status === 'hecho' ? 'text-surface-400 line-through' : 'text-surface-800',
                          a.isGate && 'font-semibold'
                        )}
                      >
                        {a.isGate && <Flag className="mr-1.5 inline h-3.5 w-3.5 text-amber-500" />}
                        {a.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-surface-400">
                        <span className={cn('badge', PHASE_BADGE[a.phase])}>{a.phase}</span>
                        <span title={REPARTO_LEGEND.find((r) => r.key === a.reparto)?.label}>
                          {REPARTO_LEGEND.find((r) => r.key === a.reparto)?.emoji ?? '🟩'}
                        </span>
                        <span>· {a.responsible}</span>
                        {a.hours > 0 && <span>· {a.hours}h</span>}
                        {a.dueDate && (
                          <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-caliente')}>
                            <Clock className="h-3 w-3" />
                            {overdue ? 'vence' : 'límite'} {fmtShort(a.dueDate)}
                          </span>
                        )}
                        {verdict !== null && (
                          <span
                            className={cn(
                              'badge',
                              verdict ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            )}
                          >
                            {verdict ? '✓ GATE superado' : '✕ GATE no superado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
