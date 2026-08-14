// ============================================================================
// ProspectionReport — informe del nicho tras una búsqueda del Lead Finder.
// KPIs, tabla ordenada por oportunidad, fichas top 5 con mensaje frío listo
// (guion co-diseñado) y export a JSON (shape del kit prospeccion-clientes).
// ============================================================================
import { useMemo, useState } from 'react';
import { Copy, Download, Flame, Gauge, Globe, Lock, MessageCircle, RefreshCw, Save, SearchX } from 'lucide-react';
import type { Discovery } from '../../types';
import { coldMessage, digitalLevel, issuesOf, nichoStats, opportunityScore } from '../../lib/prospecting';
import type { DigitalLevel } from '../../lib/prospecting';
import { waLink, webLink } from '../../lib/utils';
interface Props {
  discoveries: Discovery[];
  analyzing: boolean;
  /** Guardar un discovery como lead (reutiliza el flujo existente). */
  onSave: (d: Discovery) => void;
  /** Re-disparar el análisis técnico de las webs pendientes. */
  onReanalyze?: () => void;
}

const SCORE_COLORS: Record<DigitalLevel, string> = {
  critico: '#ff5d5d',
  alto: '#ff9f43',
  medio: '#ffd93d',
  bajo: '#4aa8ff',
};

const LEVEL_LABEL: Record<DigitalLevel, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
};

function scoreColor(score: number): string {
  return SCORE_COLORS[digitalLevel(score)];
}

export function ProspectionReport({ discoveries, analyzing, onSave, onReanalyze }: Props) {
  const stats = useMemo(() => nichoStats(discoveries), [discoveries]);
  const sorted = useMemo(
    () => [...discoveries].sort((a, b) => opportunityScore(b, 'web') - opportunityScore(a, 'web')),
    [discoveries]
  );
  const top = sorted.slice(0, 5);
  const pending = useMemo(
    () => sorted.filter((d) => d.website.trim() && !d.enrichment?.technical).length,
    [sorted]
  );
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard no disponible */
    }
  }

  function exportJson() {
    const first = discoveries[0];
    const payload = {
      meta: {
        nicho: first?.industry ?? 'prospección',
        ciudad: first?.enrichment?.city ?? 'zona',
        servicio_ofrecido: 'Diseño web',
        fecha_analisis: new Date().toISOString().slice(0, 10),
        total_prospectos: sorted.length,
      },
      prospectos: sorted.map((d) => ({
        nombre: d.company,
        web: d.website || null,
        telefono: d.phone || null,
        email: d.email || null,
        score: opportunityScore(d, 'web'),
        nivel_digital: digitalLevel(opportunityScore(d, 'web')),
        problemas: issuesOf(d),
        mensaje: coldMessage(d),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospeccion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!discoveries.length) return null;

  const kpis = [
    { icon: <Globe className="h-4 w-4" />, label: 'Encontrados', value: String(stats.total) },
    { icon: <SearchX className="h-4 w-4" />, label: 'Sin web', value: `${stats.withoutWebsite} (${stats.total ? Math.round((stats.withoutWebsite / stats.total) * 100) : 0}%)` },
    { icon: <Lock className="h-4 w-4" />, label: 'Certificado roto', value: String(stats.httpsBroken) },
    { icon: <Gauge className="h-4 w-4" />, label: 'Sin SEO básico', value: String(stats.seoMissing) },
    { icon: <Flame className="h-4 w-4" />, label: 'Score promedio', value: String(stats.avgScore) },
    { icon: <Flame className="h-4 w-4 fill-current" />, label: 'Oportunidades', value: `${stats.hot} 🔥` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-surface-900">Informe del nicho</h3>
          <p className="text-xs text-surface-500">
            Oportunidad por presencia digital · ordenado de mayor a menor
          </p>
        </div>
        <div className="flex items-center gap-2">
          {analyzing && (
            <span className="badge bg-brand-50 text-brand-600">
              <RefreshCw className="h-3 w-3 animate-spin" /> Analizando webs…
            </span>
          )}
          {pending > 0 && !analyzing && onReanalyze && (
            <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={onReanalyze}>
              <RefreshCw className="h-3 w-3" /> {pending} webs sin analizar
            </button>
          )}
          <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={exportJson}>
            <Download className="h-3 w-3" /> Exportar JSON
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="card flex items-center gap-2.5 p-3">
            <span className="text-surface-400">{k.icon}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight text-surface-900">{k.value}</p>
              <p className="truncate text-[11px] text-surface-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-surface-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-surface-500">
          Prospectos por oportunidad
        </div>
        <div className="divide-y divide-surface-100">
          {sorted.map((d) => {
            const score = opportunityScore(d, 'web');
            const level = digitalLevel(score);
            const color = scoreColor(score);
            const issues = issuesOf(d);
            const msg = coldMessage(d);
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="truncate text-sm font-semibold text-surface-900">{d.company}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-surface-500">
                    {d.website ? (
                      <a href={webLink(d.website)} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-brand-600 hover:underline">
                        <Globe className="h-3 w-3" /> web
                      </a>
                    ) : (
                      <span className="text-surface-400">sin web</span>
                    )}
                    {d.phone && <span>· {d.phone}</span>}
                  </div>
                  {issues.slice(0, 2).map((i) => (
                    <p key={i} className="mt-1 truncate text-[11px] text-surface-400">{i}</p>
                  ))}
                </div>
                <div className="flex w-32 shrink-0 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-100">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
                  </div>
                  <span className="w-7 text-right text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
                </div>
                <span
                  className="badge shrink-0 text-[11px] font-medium"
                  style={{ backgroundColor: `${color}1a`, color }}
                >
                  {LEVEL_LABEL[level]}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    className="btn-secondary px-2 py-1.5 text-xs"
                    title="Copiar mensaje"
                    onClick={() => copy(msg, d.id)}
                  >
                    {copied === d.id ? '✓' : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {d.phone && (
                    <a
                      className="btn-secondary px-2 py-1.5 text-xs"
                      title="Enviar por WhatsApp"
                      href={waLink(d.phone, msg)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button className="btn-primary px-2 py-1.5 text-xs" title="Guardar como lead" onClick={() => onSave(d)}>
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top fichas con mensaje */}
      <div>
        <h3 className="mb-2 text-base font-semibold text-surface-900">Top {top.length} — mensajes listos para enviar</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {top.map((d) => {
            const score = opportunityScore(d, 'web');
            const level = digitalLevel(score);
            const color = scoreColor(score);
            const msg = coldMessage(d);
            return (
              <div key={d.id} className="card flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-surface-900">{d.company}</p>
                  <span className="badge shrink-0 text-[11px] font-medium" style={{ backgroundColor: `${color}1a`, color }}>
                    {LEVEL_LABEL[level]} · {score}
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-surface-500">
                  {issuesOf(d).slice(0, 3).map((i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-surface-300">·</span> {i}
                    </li>
                  ))}
                </ul>
                <textarea readOnly value={msg} rows={4} className="w-full rounded-lg border border-surface-200 bg-surface-50 p-2.5 text-xs leading-relaxed text-surface-700" />
                <div className="flex items-center gap-2">
                  <button className="btn-secondary flex-1 px-2 py-1.5 text-xs" onClick={() => copy(msg, `top-${d.id}`)}>
                    {copied === `top-${d.id}` ? '✓ Copiado' : <span className="flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Copiar</span>}
                  </button>
                  {d.phone && (
                    <a className="btn-primary flex-1 px-2 py-1.5 text-xs" href={waLink(d.phone, msg)} target="_blank" rel="noreferrer">
                      <span className="flex items-center justify-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</span>
                    </a>
                  )}
                  <button className="btn-secondary px-2 py-1.5 text-xs" title="Guardar como lead" onClick={() => onSave(d)}>
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
