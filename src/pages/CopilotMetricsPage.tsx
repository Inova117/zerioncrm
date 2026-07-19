// ============================================================================
// Métricas de llamadas — el dashboard que dice si el copilot FUNCIONA.
//
// No es un reporte de vanidad: es el embudo con el que se gestiona un equipo
// de venta (contacto → oferta → hora amarrada → cierre → cash). Cada tasa se
// mide contra la etapa ANTERIOR, así el número señala QUÉ eslabón arreglar.
//
// Decisiones de visualización:
//  • El embudo es UN flujo que se estrecha, no 5 categorías compitiendo →
//    un solo tono (la longitud de barra carga la magnitud). El último paso usa
//    el verde de "cliente" del CRM: es un cambio de estado, no más de lo mismo.
//  • El A/B de aperturas y las objeciones se leen mejor como TABLA que como
//    gráfico: son pocos números y lo que importa es compararlos exactos.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PhoneCall, Clock, Trophy, DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { StatCard } from '../components/dashboard/StatCard';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { listRecentCopilotCalls, type CopilotCallRecord } from '../services/copilotService';
import { computeMetrics, type FunnelStep } from '../services/copilotMetrics';
import { BATTLECARDS } from '../data/salesPlaybook';
import { fmtMoney, cn } from '../lib/utils';

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
] as const;

// Un solo tono que se profundiza a medida que el embudo se estrecha; el cierre
// toma el verde de "cliente" del CRM (mismo idioma que el Kanban).
const STEP_COLOR: Record<FunnelStep['key'], string> = {
  llamadas: '#a5b4fc',
  contacto: '#818cf8',
  oferta: '#6366f1',
  hora: '#4f46e5',
  cierre: '#10b981',
};

/** Texto legible de una objeción a partir del id de su battlecard. */
const OBJ_LABEL = new Map(BATTLECARDS.map((c) => [c.id, c.objection]));

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div className="space-y-2">
      {/* El % vive en UNA sola columna, con encabezado que dice contra qué se mide. */}
      <div className="flex items-center gap-3 pb-1">
        <span className="w-32 shrink-0" />
        <span className="flex-1" />
        <span className="w-20 shrink-0 text-right text-[10px] uppercase tracking-wide text-surface-400">
          del paso previo
        </span>
      </div>
      {steps.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <div className="w-32 shrink-0">
            <p className="truncate text-xs font-medium text-surface-700">{s.label}</p>
            <p className="truncate text-[10px] text-surface-400">{s.hint}</p>
          </div>
          <div className="h-8 flex-1 overflow-hidden rounded-lg bg-surface-100">
            <div
              className="flex h-full items-center justify-end rounded-lg px-2 text-xs font-semibold text-white transition-all"
              style={{
                width: s.count === 0 ? '0%' : `${Math.max(8, (s.count / max) * 100)}%`,
                backgroundColor: STEP_COLOR[s.key],
              }}
            >
              {s.count > 0 && s.count}
            </div>
          </div>
          <span
            className={cn(
              'w-20 shrink-0 text-right text-sm font-semibold',
              s.rate == null
                ? 'text-surface-300'
                : s.rate < 40
                  ? 'text-amber-600'
                  : 'text-surface-700'
            )}
          >
            {s.rate != null ? `${s.rate}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CopilotMetricsPage() {
  const [days, setDays] = useState<number>(30);
  const [calls, setCalls] = useState<CopilotCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      setCalls(await listRecentCopilotCalls(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las llamadas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const m = useMemo(() => computeMetrics(calls), [calls]);
  const t1Rate = m.total > 0 ? Math.round((m.funnel[3].count / m.total) * 100) : 0;

  // El A/B solo se lee cuando hay muestra suficiente: declararlo evita que una
  // ventaja de 2 llamadas se lea como conclusión.
  const abListo = m.aperturas.every((a) => a.llamadas >= 15);
  const ganadora =
    abListo && m.aperturas[0].horaRate != null && m.aperturas[1].horaRate != null
      ? m.aperturas[0].horaRate === m.aperturas[1].horaRate
        ? null
        : m.aperturas[0].horaRate > m.aperturas[1].horaRate
          ? 'A'
          : 'B'
      : null;

  return (
    <AppLayout
      title="Métricas de llamadas"
      subtitle="Tu embudo real con el copilot: dónde se caen las llamadas y cuánto cobras."
    >
      <div className="space-y-5">
        {/* Filtros arriba de todo, en una sola fila */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-surface-100 p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  days === r.days
                    ? 'bg-surface-0 text-surface-900 shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load(days)}
            className="btn-secondary text-xs"
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
          </button>
        </div>

        {loading ? (
          <PageLoader />
        ) : error ? (
          <EmptyState title="No se pudo cargar" description={error} />
        ) : m.total === 0 ? (
          <EmptyState
            title="Todavía no hay llamadas medidas"
            description={
              m.sinDatos > 0
                ? `Hay ${m.sinDatos} llamada(s) guardada(s) antes de que existiera este panel, sin datos estructurados. Las llamadas que hagas desde ahora sí se miden aquí.`
                : 'Marca con el copilot y guarda la llamada al colgar: aquí verás tu embudo, tu tasa de cierre y el cash cobrado.'
            }
          />
        ) : (
          <>
            {/* Los cuatro números que importan */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Llamadas"
                value={m.total}
                hint={`${m.minutos} min al teléfono`}
                icon={<PhoneCall className="h-4 w-4" />}
              />
              <StatCard
                label="Hora amarrada"
                value={`${t1Rate}%`}
                hint={`${m.funnel[3].count} de ${m.total} · el toque 1 ganado`}
                icon={<Clock className="h-4 w-4" />}
              />
              <StatCard
                label="Cierres"
                value={m.funnel[4].count}
                hint={m.ticketPromedio > 0 ? `Ticket ${fmtMoney(m.ticketPromedio)}` : 'Aún sin cobros'}
                icon={<Trophy className="h-4 w-4" />}
                accent="text-emerald-600"
                accentBg="bg-emerald-50"
              />
              <StatCard
                label="Cash cobrado"
                value={fmtMoney(m.cashCollected)}
                hint={m.cashPorHora != null ? `${fmtMoney(m.cashPorHora)} por hora al teléfono` : undefined}
                icon={<DollarSign className="h-4 w-4" />}
                accent="text-emerald-600"
                accentBg="bg-emerald-50"
              />
            </div>

            {m.sinDatos > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {m.sinDatos} llamada(s) del período quedaron fuera del cálculo: son anteriores a este
                panel y no guardaron datos estructurados.
              </p>
            )}

            {/* El embudo */}
            <div className="card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-surface-800">Tu embudo de llamada</h2>
                <p className="text-xs text-surface-400">
                  Cada % es la conversión de ESE eslabón, no del total. Arregla el primero que esté roto.
                </p>
              </div>
              <Funnel steps={m.funnel} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* A/B de aperturas */}
              <div className="card p-5">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-surface-800">Prueba A/B de aperturas</h2>
                  <p className="text-xs text-surface-400">
                    {ganadora
                      ? `Con esta muestra, la apertura ${ganadora} amarra más horas.`
                      : abListo
                        ? 'Empate por ahora: sigue marcando.'
                        : 'Necesitas al menos 15 llamadas por variante para leer esto.'}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
                      <th className="py-2 font-medium">Apertura</th>
                      <th className="py-2 text-center font-medium">Llam.</th>
                      <th className="py-2 text-center font-medium">Oferta</th>
                      <th className="py-2 text-center font-medium">Hora</th>
                      <th className="py-2 text-right font-medium">% hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.aperturas.map((a) => (
                      <tr key={a.apertura} className="border-b border-surface-100 last:border-0">
                        <td className="py-2.5 font-medium text-surface-800">
                          {a.apertura}
                          <span className="ml-1.5 text-xs font-normal text-surface-400">
                            {a.apertura === 'A' ? 'honestidad radical' : 'la maestra'}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-surface-600">{a.llamadas}</td>
                        <td className="py-2.5 text-center text-surface-600">{a.oferta}</td>
                        <td className="py-2.5 text-center text-surface-600">{a.hora}</td>
                        <td
                          className={cn(
                            'py-2.5 text-right font-semibold',
                            ganadora === a.apertura ? 'text-emerald-600' : 'text-surface-700'
                          )}
                        >
                          {a.horaRate != null ? `${a.horaRate}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Objeciones */}
              <div className="card p-5">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-surface-800">Objeciones que más suenan</h2>
                  <p className="text-xs text-surface-400">
                    "Superada" = la llamada igual terminó con hora amarrada o cierre.
                  </p>
                </div>
                {m.objeciones.length === 0 ? (
                  <p className="py-4 text-center text-sm text-surface-400">
                    Ninguna objeción detectada todavía.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
                        <th className="py-2 font-medium">Objeción</th>
                        <th className="py-2 text-center font-medium">Veces</th>
                        <th className="py-2 text-right font-medium">Superada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.objeciones.slice(0, 8).map((o) => (
                        <tr key={o.id} className="border-b border-surface-100 last:border-0">
                          <td className="py-2.5 pr-2 text-surface-700">
                            {OBJ_LABEL.get(o.id) ?? o.id}
                          </td>
                          <td className="py-2.5 text-center text-surface-600">{o.veces}</td>
                          <td
                            className={cn(
                              'py-2.5 text-right font-semibold',
                              o.superadaRate != null && o.superadaRate >= 50
                                ? 'text-emerald-600'
                                : 'text-surface-500'
                            )}
                          >
                            {o.superadaRate != null ? `${o.superadaRate}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-surface-400">
              La matemática del dolor (ticket y clientes perdidos) se capturó en {m.conMatematica} de{' '}
              {m.total} llamadas — sin esos números el precio no se puede anclar a la pérdida.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
