import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Crosshair,
  Globe,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Prospecto, ProspectoSegment, ProspectoTemperatura } from '../types';
import { prospectosService, type ProspectoInput } from '../services/prospectosService';
import {
  TEMP_CONFIG,
  SEGMENTS,
  segmentLabel,
  contactRoutes,
  bestRoute,
  filterProspectos,
  uniqueCities,
  mensajeFrio,
} from '../lib/prospectoUtils';
import { cn, colorFromString } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { EmptyState, PageLoader, SectionTitle } from '../components/ui/misc';

const inputCls =
  'rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#f59e0b' : score >= 50 ? '#3b82f6' : '#64748b';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded bg-surface-200">
        <div className="h-full rounded" style={{ width: `${Math.min(100, score)}%`, background: color }} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-surface-700">{Math.round(score)}</span>
    </div>
  );
}

export function ProspectosPage() {
  const { user } = useAuth();
  const ownerId = user?.id ?? '';

  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [segment, setSegment] = useState<ProspectoSegment | 'all'>('all');
  const [city, setCity] = useState('all');
  const [temp, setTemp] = useState<ProspectoTemperatura | 'all'>('all');
  const [objetivo, setObjetivo] = useState<'all' | 'si' | 'no'>('all');

  const [selected, setSelected] = useState<Prospecto | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await prospectosService.listFor(ownerId);
      setProspectos(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ownerId) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const filtered = useMemo(
    () =>
      filterProspectos(prospectos, {
        q,
        segment,
        city: city === 'all' ? undefined : city,
        temperatura: temp,
        objetivo: objetivo === 'all' ? undefined : objetivo === 'si',
      }),
    [prospectos, q, segment, city, temp, objetivo]
  );

  const cities = useMemo(() => uniqueCities(prospectos), [prospectos]);
  const kpis = useMemo(() => {
    const by = (t: ProspectoTemperatura) => prospectos.filter((p) => p.temperatura === t).length;
    return {
      total: prospectos.length,
      prioritario: by('prioritario'),
      caliente: by('caliente'),
      tibio: by('tibio'),
      frio: by('frio'),
      objetivo: prospectos.filter((p) => p.objetivo).length,
    };
  }, [prospectos]);

  const onSave = async (input: ProspectoInput) => {
    await prospectosService.save(ownerId, input);
    setShowAdd(false);
    await reload();
  };

  const onDelete = async (id: string) => {
    await prospectosService.remove(id);
    setSelected(null);
    await reload();
  };

  const onToggleObj = async (p: Prospecto) => {
    const updated = await prospectosService.toggleObjetivo(p.id, !p.objetivo);
    setProspectos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setSelected((s) => (s && s.id === updated.id ? updated : s));
  };

  if (loading) return <PageLoader label="Cargando tu minero…" />;

  return (
    <div className="space-y-5">
      <SectionTitle
        hint="Tu lista personal de empresas objetivo · separada del pipeline del equipo · solo vos la ves"
        right={
          <div className="flex items-center gap-2">
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Nuevo prospecto
            </button>
          </div>
        }
      >
        Minero de Prospectos
      </SectionTitle>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Prospectos" value={kpis.total} />
        <Kpi label="Prioritarios" value={kpis.prioritario} color="#ef4444" />
        <Kpi label="Calientes" value={kpis.caliente} color="#f59e0b" />
        <Kpi label="Tibios" value={kpis.tibio} color="#3b82f6" />
        <Kpi label="Fríos" value={kpis.frio} color="#64748b" />
        <Kpi label="Objetivo (sí)" value={kpis.objetivo} color="#10b981" />
      </div>

      {/* Búsqueda + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            className={cn(inputCls, 'w-full pl-9')}
            placeholder="Buscar por nombre, ciudad, nicho…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className={inputCls} value={segment} onChange={(e) => setSegment(e.target.value as ProspectoSegment | 'all')}>
          <option value="all">Todos los nichos</option>
          {SEGMENTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select className={inputCls} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="all">Todas las ciudades</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className={inputCls} value={temp} onChange={(e) => setTemp(e.target.value as ProspectoTemperatura | 'all')}>
          <option value="all">Temperatura</option>
          {(['prioritario', 'caliente', 'tibio', 'frio'] as ProspectoTemperatura[]).map((t) => (
            <option key={t} value={t}>{TEMP_CONFIG[t].label}</option>
          ))}
        </select>
        <select className={inputCls} value={objetivo} onChange={(e) => setObjetivo(e.target.value as 'all' | 'si' | 'no')}>
          <option value="all">Objetivo (todos)</option>
          <option value="si">Sí es objetivo</option>
          <option value="no">No es objetivo</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-surface-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-surface-50 text-xs uppercase tracking-wide text-surface-500">
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Nicho</th>
                <th className="px-4 py-3 font-medium">Ciudad</th>
                <th className="px-4 py-3 font-medium">Tamaño (proxy)</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Ruta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((p) => {
                const route = bestRoute(p);
                const conf = TEMP_CONFIG[p.temperatura];
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="cursor-pointer transition hover:bg-surface-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ background: colorFromString(p.company) }}
                        >
                          {p.company.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium text-surface-800">{p.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-600">{segmentLabel(p.segment)}</td>
                    <td className="px-4 py-3 text-surface-600">{p.city}</td>
                    <td className="px-4 py-3 text-surface-500">{p.size ?? '—'}</td>
                    <td className="px-4 py-3"><ScoreBar score={p.score} /></td>
                    <td className="px-4 py-3">
                      {route ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-1 text-xs font-medium text-surface-700">
                          {route.channel === 'linkedin' ? <Crosshair className="h-3 w-3" /> : route.channel === 'web' ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {route.label}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400">sin ruta</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', conf.chip)}>{conf.label}</span>
                        {!p.objetivo && (
                          <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] font-semibold text-surface-500">NO-obj</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {route && (
                        <a
                          href={route.href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn-ghost rounded-lg px-2 py-1 text-xs"
                          title={`Abrir por ${route.label}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={<Crosshair className="h-8 w-8" />}
            title="No hay prospectos que encajen"
            description="Ajustá la búsqueda o los filtros, o agregá un prospecto nuevo."
          />
        )}
      </div>

      {/* Detalle */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected?.company ?? ''}
        subtitle={selected ? `${segmentLabel(selected.segment)} · ${selected.city} · Score ${Math.round(selected.score)}/100` : ''}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', TEMP_CONFIG[selected.temperatura].chip)}>
                {TEMP_CONFIG[selected.temperatura].label}
              </span>
              <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold text-surface-600">
                {selected.objetivo ? 'Objetivo' : 'No-objetivo'}
              </span>
              {selected.size && <span className="text-xs text-surface-500">{selected.size}</span>}
            </div>

            {selected.gap && (
              <div className="rounded-lg bg-surface-50 p-3 text-sm text-surface-700">
                <span className="font-medium text-surface-800">Por qué es oportunidad: </span>
                {selected.gap}
              </div>
            )}

            {selected.technical && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <TechStat ok={selected.technical.accessible} label="Web accesible" pos="OK" neg="Bloqueada" />
                <TechStat ok={selected.technical.https} label="HTTPS" pos="Sí" neg="No" />
                <TechStat ok={selected.technical.hasMetaDescription} label="Meta description (SEO)" pos="Sí" neg="NO — gap" />
                <TechStat ok={selected.technical.hasViewport} label="Responsive" pos="Sí" neg="No" />
              </div>
            )}

            {selected.notas && <p className="text-sm text-surface-500">{selected.notas}</p>}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Rutas de contacto</p>
              <div className="flex flex-wrap gap-2">
                {contactRoutes(selected).map((r) => (
                  <a
                    key={r.label}
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    {r.channel === 'linkedin' && <Crosshair className="h-4 w-4 text-brand-600" />}
                    {r.channel === 'email' && <Copy className="h-4 w-4" />}
                    {r.channel === 'whatsapp' && <MessageIcon />}
                    {r.channel === 'telefono' && <PhoneIcon />}
                    {r.channel === 'web' && <Globe className="h-4 w-4" />}
                    {r.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Mensaje de contacto (frío)</p>
                <button
                  className="btn-ghost flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(mensajeFrio(selected));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiado ✓' : 'Copiar'}
                </button>
              </div>
              <div className="rounded-lg bg-surface-50 p-3 text-sm leading-relaxed text-surface-700">
                {mensajeFrio(selected)}
              </div>
            </div>
          </div>
        )}
        {selected && (
          <div className="mt-5 flex items-center justify-between border-t border-surface-100 pt-4">
            <button
              className="btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={() => onDelete(selected.id)}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
            <button className="btn-secondary rounded-lg px-3 py-2 text-sm" onClick={() => onToggleObj(selected)}>
              Marcar {selected.objetivo ? 'no-objetivo' : 'objetivo'}
            </button>
          </div>
        )}
      </Modal>

      {/* Agregar */}
      <AddProspectoModal open={showAdd} onClose={() => setShowAdd(false)} onSave={onSave} ownerCityDefault="" />
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white px-4 py-3">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-surface-900" style={color ? { color } : undefined}>
          {value}
        </span>
        <span className="text-xs text-surface-400">{label}</span>
      </div>
    </div>
  );
}

function TechStat({ ok, label, pos, neg }: { ok: boolean; label: string; pos: string; neg: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2">
      <span className="text-surface-600">{label}</span>
      <span className={cn('font-semibold', ok ? 'text-emerald-600' : 'text-amber-600')}>{ok ? pos : neg}</span>
    </div>
  );
}

function MessageIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Formulario de nuevo prospecto
// ---------------------------------------------------------------------------
function AddProspectoModal({
  open,
  onClose,
  onSave,
  ownerCityDefault,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: ProspectoInput) => Promise<void>;
  ownerCityDefault: string;
}) {
  const [company, setCompany] = useState('');
  const [segment, setSegment] = useState<ProspectoSegment>('colegio');
  const [city, setCity] = useState(ownerCityDefault || 'Quito');
  const [pais, setPais] = useState('Ecuador');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telefono, setTelefono] = useState('');
  const [size, setSize] = useState('');
  const [score, setScore] = useState('60');
  const [gap, setGap] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCompany(''); setSegment('colegio'); setCity(ownerCityDefault || 'Quito'); setPais('Ecuador');
    setWebsite(''); setLinkedin(''); setEmail(''); setWhatsapp(''); setTelefono('');
    setSize(''); setScore('60'); setGap('');
  };

  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSave = company.trim().length > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        company: company.trim(),
        segment,
        city: city.trim() || 'Quito',
        pais: pais.trim() || 'Ecuador',
        website: website.trim() || undefined,
        contact: {
          linkedin: linkedin.trim() || undefined,
          email: email.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          telefono: telefono.trim() || undefined,
          web: website.trim() || undefined,
        },
        size: size.trim() || undefined,
        score: Number(score) || 0,
        gap: gap.trim() || undefined,
        source: 'manual',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo prospecto" subtitle="Cargá una empresa y el sistema busca la mejor ruta de contacto">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Empresa *" className="sm:col-span-2">
          <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de la empresa" autoFocus />
        </Field>
        <Field label="Nicho">
          <select className={cn(inputCls, 'w-full')} value={segment} onChange={(e) => setSegment(e.target.value as ProspectoSegment)}>
            {SEGMENTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Ciudad">
          <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="País">
          <input className={inputCls} value={pais} onChange={(e) => setPais(e.target.value)} />
        </Field>
        <Field label="Tamaño (proxy facturación)">
          <input className={inputCls} value={size} onChange={(e) => setSize(e.target.value)} placeholder="9 empleados · 4 sedes" />
        </Field>
        <Field label="Sitio web" className="sm:col-span-2">
          <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="LinkedIn">
          <input className={inputCls} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/company/…" />
        </Field>
        <Field label="Email">
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@…" />
        </Field>
        <Field label="WhatsApp">
          <input className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0978616162" />
        </Field>
        <Field label="Teléfono">
          <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Field>
        <Field label="Precio estimado? No — Score (0-100)">
          <input className={inputCls} type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} />
        </Field>
        <Field label="Hueco / por qué es oportunidad" className="sm:col-span-2">
          <textarea className={cn(inputCls, 'min-h-[70px] w-full resize-y')} value={gap} onChange={(e) => setGap(e.target.value)} placeholder="Sin formulario de inscripción, no aparece en Google…" />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-surface-100 pt-4">
        <button className="btn-ghost rounded-lg px-3 py-2 text-sm" onClick={onClose}>Cancelar</button>
        <button className="btn-primary rounded-lg px-4 py-2 text-sm" disabled={!canSave || saving} onClick={submit}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-surface-500">{label}</span>
      {children}
    </label>
  );
}
