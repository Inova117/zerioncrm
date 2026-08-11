import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SALES_SCRIPT_FRIO, FRIO_PITCH_LINE } from '../../data/salesScriptFrio';
import { fillLeadVars, type ScriptLeadVars } from '../../lib/scriptUtils';
import { fillPrecios } from '../../lib/copilotSettings';

interface SalesScriptPanelProps {
  /** Datos del prospecto — resuelven las variables del guion ([SALUDO],
   *  [NOMBRE], [rubro], [CIUDAD], [EMPRESA]) en pantalla, sin LLM. */
  lead?: ScriptLeadVars;
  /** Guion específico de ESTE prospecto (lead.script). Si existe, tiene
   *  prioridad sobre el guion genérico de llamada en frío. */
  script?: string;
  /** Modo grande: tipografía y controles grandes, llena la altura disponible —
   *  para leer DURANTE la llamada. */
  large?: boolean;
}

/** Un paso del guion de llamada en frío: instrucción para el vendedor + la
 *  frase EXACTA para decir. Se muestran en scroll, uno tras otro. */
function ScriptStep({
  emoji,
  title,
  action,
  lines,
  fill,
  large,
}: {
  emoji: string;
  title: string;
  action: string;
  lines: string[];
  fill: (t: string) => string;
  large?: boolean;
}) {
  return (
    <section className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
      <p className={cn('font-semibold uppercase tracking-wide text-brand-600', large ? 'text-sm' : 'text-[11px]')}>
        {emoji} {title}
      </p>
      <p className={cn('mt-1 text-surface-500', large ? 'text-sm' : 'text-xs')}>{fill(action)}</p>
      <ul className={cn('mt-2 space-y-2', large && 'mt-3')}>
        {lines.map((line, i) => (
          <li key={i} className={cn('leading-snug text-surface-800', large ? 'text-base' : 'text-sm')}>
            {fill(line)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SalesScriptPanel({ lead, script, large = false }: SalesScriptPanelProps) {
  const hasCustom = Boolean(script?.trim());
  // El key={lead.id} del padre remonta el panel por prospecto, así el modo
  // arranca SIEMPRE en el guion correcto para el lead actual.
  const [mode, setMode] = useState<'custom' | 'frio'>(hasCustom ? 'custom' : 'frio');
  const [open, setOpen] = useState(true);

  // El texto del guion sale con las variables del prospecto resueltas
  // ([SALUDO] → "Doña Marta", [rubro] → "clínica dental"…) y los precios de
  // Ajustes ([PRECIO]/[MENSUAL]). Todo en pantalla, sin LLM.
  const fill = (t: string) => fillPrecios(fillLeadVars(t, lead));

  return (
    <div className={cn('card overflow-hidden', large ? 'flex h-full flex-col p-4' : 'p-3')}>
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        title={mode === 'custom' ? 'Guion de este prospecto — llévalo a la vista durante la llamada' : 'Guion de llamada en frío — llévalo a la vista durante la llamada'}
      >
        {open ? (
          <ChevronDown className={cn('text-brand-500', large ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : (
          <ChevronRight className={cn('text-surface-400', large ? 'h-5 w-5' : 'h-4 w-4')} />
        )}
        <BookOpen className={cn('text-brand-600', large ? 'h-5 w-5' : 'h-4 w-4')} />
        <span className={cn('font-semibold text-surface-800', large ? 'text-base' : 'text-sm')}>
          {mode === 'custom' ? 'Guion del prospecto' : 'Guion llamada en frío'}
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

              <div className={cn('rounded-xl border border-brand-100 bg-brand-50/40', large ? 'min-h-0 flex-1 overflow-y-auto p-4' : 'max-h-80 overflow-y-auto p-3')}>
                <p className={cn('whitespace-pre-wrap leading-relaxed text-surface-800', large ? 'text-base' : 'text-sm')}>
                  {fill(script ?? '')}
                </p>
              </div>

              <button
                className={cn('self-start text-surface-400 underline hover:text-surface-600', large ? 'text-sm' : 'text-[11px]')}
                onClick={() => setMode('frio')}
              >
                Ver guion genérico de frío
              </button>
            </>
          ) : (
            <>
              {/* Guion genérico de llamada en frío (por defecto) — todo en scroll */}
              <div className={cn('space-y-2', large ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'max-h-80 overflow-y-auto pr-1')}>
                {SALES_SCRIPT_FRIO.map((s) => (
                  <ScriptStep key={s.id} emoji={s.emoji} title={s.title} action={s.action} lines={s.lines} fill={fill} large={large} />
                ))}

                {/* El sistema (frío: siguiente paso) */}
                <p className={cn('rounded-lg bg-surface-50 italic leading-snug text-surface-500', large ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-[11px]')}>
                  {fill(FRIO_PITCH_LINE)}
                </p>
              </div>

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
        </div>
      )}
    </div>
  );
}
