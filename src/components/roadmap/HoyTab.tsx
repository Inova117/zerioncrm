import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flame,
  KanbanSquare,
  Minus,
  Plus,
  Save,
} from 'lucide-react';
import type { RoadmapDay, RoadmapMeta } from '../../types';
import { PROCESS_STEPS, ROUTINE, dayTargets } from '../../data/roadmapDefaults';
import { todayInPlan, todayKey } from '../../lib/roadmapCalc';
import { cn } from '../../lib/utils';

interface HoyTabProps {
  meta: RoadmapMeta;
  days: RoadmapDay[];
  saveDay: (day: RoadmapDay) => Promise<void>;
  saveMeta: (meta: RoadmapMeta) => Promise<void>;
}

const fmtDay = (d: string) => format(parseISO(d), "d 'de' MMMM", { locale: es });

/** Stepper numérico chico (para contactos/demos/webs/AaaS del día).
 *  Usa delta + actualización funcional: clics rápidos seguidos nunca leen
 *  estado viejo (stale closure). */
function Stepper({
  label,
  value,
  target,
  onStep,
}: {
  label: string;
  value: number;
  target: number;
  onStep: (delta: number) => void;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null;
  return (
    <div className="rounded-lg border border-surface-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-600">{label}</span>
        {pct !== null && (
          <span
            className={cn(
              'text-[11px] font-semibold',
              value >= target ? 'text-emerald-600' : value > 0 ? 'text-amber-600' : 'text-surface-400'
            )}
          >
            {pct >= 100 ? '✓ meta' : `${pct}% de ${target}`}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn-ghost rounded-lg p-1.5 text-surface-400"
          onClick={() => onStep(-1)}
          aria-label={`Restar ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-xl font-semibold text-surface-900">{value}</span>
        <button
          type="button"
          className="btn-ghost rounded-lg p-1.5 text-surface-400"
          onClick={() => onStep(1)}
          aria-label={`Sumar ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const clamp0 = (n: number) => Math.max(0, n);

/** Hoy: rutina, captura del día, pitch y proceso de venta. */
export function HoyTab({ meta, days, saveDay, saveMeta }: HoyTabProps) {
  const today = todayKey();
  const inPlan = todayInPlan(meta);
  const row = days.find((d) => d.day === today);
  const targets = dayTargets(today);

  // Draft del día — se resetea si cambia la fecha o la fila cargada.
  const [draft, setDraft] = useState<RoadmapDay | null>(null);
  useEffect(() => {
    setDraft(
      row ?? { day: today, contacts: 0, demos: 0, webs: 0, aaas: 0, income: 0, content: false, notes: '' }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, row?.day]);

  const [saved, setSaved] = useState(false);
  const [pitchDraft, setPitchDraft] = useState(meta.pitch);
  const [pitchSaved, setPitchSaved] = useState(false);

  const patch = (p: Partial<RoadmapDay>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const handleSave = async () => {
    if (!draft) return;
    await saveDay(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSavePitch = async () => {
    await saveMeta({ ...meta, pitch: pitchDraft });
    setPitchSaved(true);
    setTimeout(() => setPitchSaved(false), 2500);
  };

  return (
    <div className="space-y-5">
      {!inPlan && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Hoy estás fuera de la ventana del plan (12 ago → 1 nov 2026). Puedes revisar{' '}
            <strong>Semanas</strong> y <strong>Roadmap</strong>; la captura del día queda deshabilitada.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Columna izquierda */}
        <div className="space-y-5">
          {/* Rutina diaria */}
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Flame className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-surface-800">Rutina diaria (no negociable)</h2>
                <p className="text-xs text-surface-400">Antes de que termine el día, cumple estas 6.</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {ROUTINE.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-surface-300" />
                  <span>
                    <span className="mr-1.5 font-semibold text-surface-400">{i + 1}.</span>
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Captura del día */}
          {inPlan && draft && (
            <section className="card p-4">
              <div className="mb-3 flex items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-surface-800">Tu día de hoy</h2>
                  <p className="text-xs capitalize text-surface-400">{fmtDay(today)}</p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!draft}
                >
                  <Save className="h-4 w-4" />
                  {saved ? 'Guardado ✓' : 'Guardar día'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stepper
                  label="Contactos"
                  value={draft.contacts}
                  target={targets.contacts}
                  onStep={(delta) => setDraft((d) => (d ? { ...d, contacts: clamp0(d.contacts + delta) } : d))}
                />
                <Stepper
                  label="Demos"
                  value={draft.demos}
                  target={targets.demos}
                  onStep={(delta) => setDraft((d) => (d ? { ...d, demos: clamp0(d.demos + delta) } : d))}
                />
                <Stepper
                  label="Webs vendidas"
                  value={draft.webs}
                  target={0}
                  onStep={(delta) => setDraft((d) => (d ? { ...d, webs: clamp0(d.webs + delta) } : d))}
                />
                <Stepper
                  label="AaaS vendidos"
                  value={draft.aaas}
                  target={0}
                  onStep={(delta) => setDraft((d) => (d ? { ...d, aaas: clamp0(d.aaas + delta) } : d))}
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Ingreso del día ($)</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={draft.income}
                    onChange={(e) => patch({ income: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => patch({ content: !draft.content })}
                    className={cn(
                      'btn w-full justify-start rounded-lg border',
                      draft.content
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-surface-200 bg-white text-surface-500 hover:bg-surface-50'
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {draft.content ? 'Contenido publicado ✓' : '¿Publicaste contenido (reel)?'}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="label">Notas del día</label>
                <textarea
                  rows={3}
                  className="input resize-none"
                  placeholder="Qué pasó hoy, a quién llamaste, qué aprendiste…"
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>
            </section>
          )}

          {/* Acceso rápido al Kanban */}
          <Link
            to="/leads"
            className="card flex items-center gap-3 p-4 text-sm font-medium text-surface-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <KanbanSquare className="h-4 w-4" />
            </span>
            <span className="flex-1">Tus prospectos de hoy viven en el Kanban</span>
            <span className="text-xs text-surface-400">Abrir Prospectos →</span>
          </Link>
        </div>

        {/* Columna derecha */}
        <div className="space-y-5">
          {/* Pitch */}
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Flame className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-surface-800">Elevator pitch AaaS</h2>
                <p className="text-xs text-surface-400">Apréndelo de memoria. Edítalo cuando lo mejores.</p>
              </div>
            </div>
            <textarea
              rows={5}
              className="input resize-none leading-relaxed"
              value={pitchDraft}
              onChange={(e) => setPitchDraft(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <button type="button" className="btn-secondary" onClick={handleSavePitch}>
                <Save className="h-4 w-4" />
                {pitchSaved ? 'Guardado ✓' : 'Guardar pitch'}
              </button>
            </div>
          </section>

          {/* Proceso de venta */}
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-surface-800">Proceso de venta (6 pasos)</h2>
            </div>
            <ol className="space-y-3">
              {PROCESS_STEPS.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-surface-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
