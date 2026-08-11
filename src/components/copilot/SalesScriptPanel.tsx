import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SALES_SCRIPT_HORMOZI, HORMOZI_PITCH_LINE } from '../../data/salesScriptHormozi';
import { splitScriptSteps, fillLeadVars, type ScriptLeadVars } from '../../lib/scriptUtils';
import { fillPrecios } from '../../lib/copilotSettings';

interface SalesScriptPanelProps {
  /** Datos del prospecto — resuelven las variables del guion ([SALUDO],
   *  [NOMBRE], [rubro], [CIUDAD], [EMPRESA]) en pantalla, sin LLM. */
  lead?: ScriptLeadVars;
  /** Guion específico de ESTE prospecto (lead.script). Si existe, tiene
   *  prioridad sobre el guion genérico Hormozi. */
  script?: string;
  /** Modo grande: tipografía y controles grandes, llena la altura disponible —
   *  para leer DURANTE la llamada. */
  large?: boolean;
}

/** Atajo: qué sección del guion toca según la temperatura del lead. */
const SECTION_BY_TEMP: Record<string, string> = {
  nuevo: 'apertura',
  frio: 'apertura',
  tibio: 'trato-t1',
  caliente: 'precio',
  reunion: 'cierre-t2',
  'no-acepto': 'seguimiento',
};

export function SalesScriptPanel({ lead, script, large = false }: SalesScriptPanelProps) {
  const hasCustom = Boolean(script?.trim());
  // El key={lead.id} del padre remonta el panel por prospecto, así el modo
  // arranca SIEMPRE en el guion correcto para el lead actual.
  const [mode, setMode] = useState<'custom' | 'hormozi'>(hasCustom ? 'custom' : 'hormozi');
  const [open, setOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(
    () => (lead?.temperature ? SECTION_BY_TEMP[lead.temperature] ?? 'apertura' : 'apertura')
  );
  const [activeStep, setActiveStep] = useState(0);

  const sections = useMemo(() => SALES_SCRIPT_HORMOZI, []);
  const steps = useMemo(() => splitScriptSteps(script ?? ''), [script]);

  // El texto del guion sale con las variables del prospecto resueltas
  // ([SALUDO] → "Doña Marta", [rubro] → "clínica dental"…) y los precios de
  // Ajustes ([PRECIO]/[MENSUAL]). Todo en pantalla, sin LLM.
  const fill = (t: string) => fillPrecios(fillLeadVars(t, lead));

  const current = sections.find((s) => s.id === activeId) ?? sections[0]!;
  const currentIdx = Math.max(0, sections.findIndex((s) => s.id === current.id));
  const step = steps[activeStep] ?? '';
  const total = mode === 'custom' ? steps.length : sections.length;
  const atStart = mode === 'custom' ? activeStep === 0 : currentIdx === 0;
  const atEnd = mode === 'custom' ? activeStep >= steps.length - 1 : currentIdx >= sections.length - 1;

  const prev = () => {
    if (mode === 'custom') setActiveStep((i) => Math.max(0, i - 1));
    else setActiveId(sections[Math.max(0, currentIdx - 1)]!.id);
  };
  const next = () => {
    if (mode === 'custom') setActiveStep((i) => Math.min(steps.length - 1, i + 1));
    else setActiveId(sections[Math.min(sections.length - 1, currentIdx + 1)]!.id);
  };

  const chipClass = (active: boolean) =>
    cn(
      'flex items-center justify-center rounded-lg font-semibold transition-colors',
      large ? 'h-10 w-10 text-sm' : 'h-7 min-w-7 px-1.5 text-[11px]',
      active ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
    );

  return (
    <div className={cn('card overflow-hidden', large ? 'flex h-full flex-col p-4' : 'p-3')}>
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        title={mode === 'custom' ? 'Guion de este prospecto — llévalo a la vista durante la llamada' : 'Guion de venta Hormozi — llévalo a la vista durante la llamada'}
      >
        {open ? (
          <ChevronDown className={cn('text-brand-500', large ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : (
          <ChevronRight className={cn('text-surface-400', large ? 'h-5 w-5' : 'h-4 w-4')} />
        )}
        <BookOpen className={cn('text-brand-600', large ? 'h-5 w-5' : 'h-4 w-4')} />
        <span className={cn('font-semibold text-surface-800', large ? 'text-base' : 'text-sm')}>
          {mode === 'custom' ? 'Guion del prospecto' : 'Guion Hormozi'}
        </span>
        <span className={cn('ml-auto text-surface-400', large ? 'text-xs' : 'text-[10px]')}>
          paso {mode === 'custom' ? activeStep + 1 : current.step}/{mode === 'custom' ? steps.length : 9}
        </span>
      </button>

      {open && (
        <div className={cn('mt-2 space-y-2', large && 'flex min-h-0 flex-1 flex-col')}>
          {mode === 'custom' && hasCustom ? (
            <>
              {/* Guion escrito para ESTE cliente: prioridad total durante la llamada */}
              <p className={cn('rounded-lg bg-brand-50/60 italic leading-snug text-brand-700', large ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-[11px]')}>
                Escrito para este prospecto — prioridad sobre el guion genérico.
              </p>

              {steps.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {steps.map((_, i) => (
                    <button key={i} onClick={() => setActiveStep(i)} className={chipClass(activeStep === i)} title={`Paso ${i + 1}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              <div className={cn('rounded-xl border border-brand-100 bg-brand-50/40', large ? 'min-h-0 flex-1 overflow-y-auto p-4' : 'p-3')}>
                <p className={cn('whitespace-pre-wrap leading-relaxed text-surface-800', large ? 'text-base' : 'text-sm')}>
                  {fill(step)}
                </p>
              </div>

              <button
                className={cn('self-start text-surface-400 underline hover:text-surface-600', large ? 'text-sm' : 'text-[11px]')}
                onClick={() => setMode('hormozi')}
              >
                Ver guion genérico Hormozi
              </button>
            </>
          ) : (
            <>
              {/* Guion genérico Hormozi (por defecto) */}
              <div className="flex flex-wrap gap-1.5">
                {sections.map((s) => (
                  <button key={s.id} onClick={() => setActiveId(s.id)} className={chipClass(activeId === s.id)} title={s.title}>
                    {s.step}
                  </button>
                ))}
              </div>

              <div className={cn('rounded-xl border border-brand-100 bg-brand-50/40', large ? 'min-h-0 flex-1 overflow-y-auto p-4' : 'p-3')}>
                <p className={cn('font-semibold uppercase tracking-wide text-brand-600', large ? 'text-sm' : 'text-[11px]')}>
                  {current.emoji} Paso {current.step} — {current.title}
                </p>
                <p className={cn('mt-1 text-surface-500', large ? 'text-sm' : 'text-xs')}>{fill(current.action)}</p>
                <ul className={cn('mt-2 space-y-2', large && 'mt-3')}>
                  {current.lines.map((line, i) => (
                    <li key={i} className={cn('leading-snug text-surface-800', large ? 'text-base' : 'text-sm')}>
                      {fill(line)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* El destino (Hormozi) */}
              <p className={cn('rounded-lg bg-surface-50 italic leading-snug text-surface-500', large ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-[11px]')}>
                {fill(HORMOZI_PITCH_LINE)}
              </p>

              {hasCustom && (
                <button
                  className={cn('self-start text-surface-400 underline hover:text-surface-600', large ? 'text-sm' : 'text-[11px]')}
                  onClick={() => setMode('custom')}
                >
                  Volver al guion de este prospecto
                </button>
              )}
            </>
          )}

          {/* Navegación anterior/siguiente — controles grandes para la llamada */}
          {total > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <button
                className={cn('btn-secondary flex items-center justify-center gap-1', large ? 'flex-1 py-3 text-base' : 'py-1.5 text-xs')}
                onClick={prev}
                disabled={atStart}
              >
                <ChevronLeft className={large ? 'h-5 w-5' : 'h-4 w-4'} /> Anterior
              </button>
              <span className={cn('shrink-0 text-surface-400', large ? 'text-sm' : 'text-xs')}>
                {(mode === 'custom' ? activeStep : currentIdx) + 1} / {total}
              </span>
              <button
                className={cn('btn-secondary flex items-center justify-center gap-1', large ? 'flex-1 py-3 text-base' : 'py-1.5 text-xs')}
                onClick={next}
                disabled={atEnd}
              >
                Siguiente <ChevronRight className={large ? 'h-5 w-5' : 'h-4 w-4'} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
