import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SALES_SCRIPT_HORMOZI, HORMOZI_PITCH_LINE } from '../../data/salesScriptHormozi';

interface SalesScriptPanelProps {
  /** Etapa actual del lead (para resaltar la sección más probable). */
  temperature?: string;
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

export function SalesScriptPanel({ temperature }: SalesScriptPanelProps) {
  const [open, setOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(
    () => (temperature ? SECTION_BY_TEMP[temperature] ?? 'apertura' : 'apertura')
  );

  const sections = useMemo(() => SALES_SCRIPT_HORMOZI, []);

  const current = sections.find((s) => s.id === activeId) ?? sections[0]!;

  return (
    <div className="card overflow-hidden p-3">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        title="Guion de venta Hormozi — llévalo a la vista durante la llamada"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-brand-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-surface-400" />
        )}
        <BookOpen className="h-4 w-4 text-brand-600" />
        <span className="text-sm font-semibold text-surface-800">Guion Hormozi</span>
        <span className="ml-auto text-[10px] text-surface-400">paso {current.step}/9</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Navegación por pasos */}
          <div className="flex flex-wrap gap-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={cn(
                  'flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold transition-colors',
                  activeId === s.id ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                )}
                title={s.title}
              >
                {s.step}
              </button>
            ))}
          </div>

          {/* Sección activa */}
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
              {current.emoji} Paso {current.step} — {current.title}
            </p>
            <p className="mt-1 text-xs text-surface-500">{current.action}</p>
            <ul className="mt-2 space-y-1.5">
              {current.lines.map((line, i) => (
                <li key={i} className="text-sm leading-snug text-surface-800">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* El destino (Hormozi) */}
          <p className="rounded-lg bg-surface-50 px-2.5 py-1.5 text-[11px] italic leading-snug text-surface-500">
            {HORMOZI_PITCH_LINE}
          </p>
        </div>
      )}
    </div>
  );
}