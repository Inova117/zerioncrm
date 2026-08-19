import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { salesScriptFrio, FRIO_PITCH_LINE } from '../../data/salesScriptFrio';
import { SALES_SCRIPT_AGENT, AGENT_PITCH_LINE } from '../../data/salesScriptAgente';
import { fillLeadVars, type ScriptLeadVars } from '../../lib/scriptUtils';
import { fillPrecios } from '../../lib/copilotSettings';
import { leadOfferLine } from '../../lib/leadService';

type Mode = 'custom' | 'web' | 'aaas';

const SERVICE_LABEL: Record<'web' | 'aaas', { title: string; chip: string }> = {
  web: { title: 'Guion llamada en frío', chip: '🌐 Página web' },
  aaas: { title: 'Guion AI agent', chip: '🤖 AI agent' },
};

interface SalesScriptPanelProps {
  /** Datos del prospecto — resuelven las variables del guion ([SALUDO],
   *  [NOMBRE], [rubro], [CIUDAD], [EMPRESA]) en pantalla, sin LLM. */
  lead?: ScriptLeadVars;
  /** Guion específico de ESTE prospecto (lead.script). Si existe, tiene
   *  prioridad sobre el guion por servicio. */
  script?: string;
  /** Variante de apertura A/B de la llamada (la prueba A/B). Determina el paso
   *  1 del guion web. Se registra en `outcome.apertura` para comparar. */
  apertura?: 'A' | 'B';
  /** Cambia la variante A/B desde el panel (toggle). */
  onAperturaChange?: (v: 'A' | 'B') => void;
  /** Modo grande: tipografía y controles grandes, llena la altura disponible —
   *  para leer DURANTE la llamada. */
  large?: boolean;
}

/** Un paso del guion: instrucción para el vendedor + la frase EXACTA para
 *  decir. Se muestran en scroll, uno tras otro. */
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

export function SalesScriptPanel({ lead, script, apertura = 'A', onAperturaChange, large = false }: SalesScriptPanelProps) {
  const hasCustom = Boolean(script?.trim());
  // Por defecto: guion propio si existe; si no, la línea de oferta del lead
  // decide el guion (web vs AI agent) — regla de prospección (leadOfferLine).
  const [mode, setMode] = useState<Mode>(hasCustom ? 'custom' : leadOfferLine(lead));
  const [open, setOpen] = useState(true);

  // El texto del guion sale con las variables del prospecto resueltas
  // ([SALUDO] → "Doña Marta", [rubro] → "clínica dental"…) y los precios de
  // Ajustes ([PRECIO]/[MENSUAL] para web, [SETUP]/[RETENER] para el agente).
  const fill = (t: string) => fillPrecios(fillLeadVars(t, lead));

  const service: 'web' | 'aaas' = mode === 'aaas' ? 'aaas' : 'web';
  const sections = service === 'aaas' ? SALES_SCRIPT_AGENT : salesScriptFrio(apertura);
  const pitchLine = service === 'aaas' ? AGENT_PITCH_LINE : FRIO_PITCH_LINE;

  const headerTitle =
    mode === 'custom' ? 'Guion del prospecto' : SERVICE_LABEL[service].title;

  return (
    <div className={cn('card overflow-hidden', large ? 'flex h-full flex-col p-4' : 'p-3')}>
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        title={mode === 'custom' ? 'Guion de este prospecto — llévalo a la vista durante la llamada' : 'Guion de venta por servicio — llévalo a la vista durante la llamada'}
      >
        {open ? (
          <ChevronDown className={cn('text-brand-500', large ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : (
          <ChevronRight className={cn('text-surface-400', large ? 'h-5 w-5' : 'h-4 w-4')} />
        )}
        <BookOpen className={cn('text-brand-600', large ? 'h-5 w-5' : 'h-4 w-4')} />
        <span className={cn('font-semibold text-surface-800', large ? 'text-base' : 'text-sm')}>
          {headerTitle}
        </span>
        {mode !== 'custom' && (
          <span className={cn('ml-auto rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700', large ? 'text-xs' : 'text-[10px]')}>
            {SERVICE_LABEL[service].chip}
          </span>
        )}
      </button>

      {open && (
        <div className={cn('mt-2 space-y-2', large && 'flex min-h-0 flex-1 flex-col')}>
          {mode === 'custom' && hasCustom ? (
            <>
              {/* Guion escrito para ESTE cliente: prioridad total durante la llamada */}
              <p className={cn('rounded-lg bg-brand-50/60 italic leading-snug text-brand-700', large ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-[11px]')}>
                Escrito para este prospecto — prioridad sobre el guion por servicio.
              </p>

              <div className={cn('rounded-xl border border-brand-100 bg-brand-50/40', large ? 'min-h-0 flex-1 overflow-y-auto p-4' : 'max-h-80 overflow-y-auto p-3')}>
                <p className={cn('whitespace-pre-wrap leading-relaxed text-surface-800', large ? 'text-base' : 'text-sm')}>
                  {fill(script ?? '')}
                </p>
              </div>

              <button
                className={cn('self-start text-surface-400 underline hover:text-surface-600', large ? 'text-sm' : 'text-[11px]')}
                onClick={() => setMode(leadOfferLine(lead))}
              >
                Ver guion por servicio
              </button>
            </>
          ) : (
            <>
              {/* Selector del servicio (el agente es proxy — corregible a mano) */}
              <div className="flex items-center gap-1.5">
                {(['web', 'aaas'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setMode(s)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      service === s ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                    )}
                  >
                    {SERVICE_LABEL[s].chip}
                  </button>
                ))}
              </div>

              {/* Toggle A/B de la apertura — SOLO para el guion web. La variante
                  se registra en outcome.apertura para el split del dashboard. */}
              {service === 'web' && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('shrink-0 font-semibold text-surface-400', large ? 'text-xs' : 'text-[10px]')}>
                    Apertura
                  </span>
                  {(['A', 'B'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => onAperturaChange?.(v)}
                      title={`Variante ${v} de la apertura — el resto del guion es el mismo`}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                        apertura === v ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                      )}
                    >
                      Apertura {v}
                    </button>
                  ))}
                </div>
              )}

              {/* Guion por servicio — todo en scroll */}
              <div className={cn('space-y-2', large ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'max-h-80 overflow-y-auto pr-1')}>
                {sections.map((s) => (
                  <ScriptStep key={s.id} emoji={s.emoji} title={s.title} action={s.action} lines={s.lines} fill={fill} large={large} />
                ))}

                {/* El sistema (frío: siguiente paso) */}
                <p className={cn('rounded-lg bg-surface-50 italic leading-snug text-surface-500', large ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-[11px]')}>
                  {fill(pitchLine)}
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
