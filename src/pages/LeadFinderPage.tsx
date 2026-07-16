import { useMemo, useState } from 'react';
import {
  Radar, Briefcase, MapPin, Download, Globe, Sparkles, Search, Loader2,
  AlertCircle, Languages, ArrowDownWideNarrow, Save, CheckSquare, Square,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { LeadFinderCard } from '../components/leads/LeadFinderCard';
import { LeadCandidateModal } from '../components/leads/LeadCandidateModal';
import { EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { findLeads } from '../services/leadFinderService';
import type { CandidateLead } from '../services/leadFinderService';
import type { Lead } from '../types';
import { cn, nowISO } from '../lib/utils';
import { toCSV, downloadCSV } from '../lib/csv';
import { CSV_HEADERS, leadsToRows } from '../lib/leadsCsv';

/** Wrap a candidate as a pseudo-Lead so the card can render it. */
function toLead(c: CandidateLead): Lead {
  const { tempId, ...rest } = c;
  return {
    ...rest,
    id: tempId,
    position: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    lastContactAt: rest.lastContactAt ?? null,
    meetingAt: rest.meetingAt ?? null,
  };
}

export function LeadFinderPage() {
  const { user, isAdmin } = useAuth();
  const { users, importLeads } = useData();

  // Search form
  const [bizType, setBizType] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(25);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [deep, setDeep] = useState(true); // rich (email + redes) por defecto
  const [assignee, setAssignee] = useState<string>(user?.id ?? '');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results (candidates — NOT saved until the user picks them)
  const [candidates, setCandidates] = useState<CandidateLead[]>([]);
  const [meta, setMeta] = useState<{ found: number; duplicates: number; noWebsite: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<CandidateLead | null>(null);
  const [searched, setSearched] = useState(false);

  // Browsing
  const [onlyNoWeb, setOnlyNoWeb] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<'noweb' | 'rating' | 'reviews'>('noweb');

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeEmployees = useMemo(
    () => users.filter((u) => u.role === 'employee' && u.active),
    [users]
  );

  const shown = useMemo(() => {
    let list = candidates;
    if (onlyNoWeb) list = list.filter((c) => !c.website.trim());
    if (minRating > 0) list = list.filter((c) => (c.enrichment?.rating ?? 0) >= minRating);
    const rating = (c: CandidateLead) => c.enrichment?.rating ?? 0;
    const reviews = (c: CandidateLead) => c.enrichment?.reviewCount ?? 0;
    const noWeb = (c: CandidateLead) => (c.website.trim() ? 0 : 1);
    const sorted = [...list];
    if (sort === 'noweb') sorted.sort((a, b) => noWeb(b) - noWeb(a) || rating(b) - rating(a));
    else if (sort === 'rating') sorted.sort((a, b) => rating(b) - rating(a));
    else if (sort === 'reviews') sorted.sort((a, b) => reviews(b) - reviews(a));
    return sorted;
  }, [candidates, onlyNoWeb, minRating, sort]);

  const noWebCount = useMemo(() => candidates.filter((c) => !c.website.trim()).length, [candidates]);
  const selectableIds = useMemo(
    () => shown.filter((c) => !savedIds.has(c.tempId)).map((c) => c.tempId),
    [shown, savedIds]
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!bizType.trim() || !location.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await findLeadsGuarded();
      setCandidates(res.candidates);
      setMeta({ found: res.found, duplicates: res.duplicates, noWebsite: res.noWebsite });
      setSelected(new Set());
      setSavedIds(new Set());
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la búsqueda.');
    } finally {
      setRunning(false);
    }
  }

  // Split out so the try/catch above stays readable.
  function findLeadsGuarded() {
    return findLeads({
      businessType: bizType.trim(),
      location: location.trim(),
      limit: count,
      language,
      deep,
      assignedTo: isAdmin ? assignee || user!.id : user!.id,
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...selectableIds]);
    });
  }

  async function saveCandidates(cands: CandidateLead[]) {
    if (!cands.length || saving) return;
    setSaving(true);
    try {
      const inputs = cands.map(({ tempId: _t, ...input }) => input);
      await importLeads(inputs);
      setSavedIds((prev) => new Set([...prev, ...cands.map((c) => c.tempId)]));
      setSelected((prev) => {
        const next = new Set(prev);
        cands.forEach((c) => next.delete(c.tempId));
        return next;
      });
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csv = toCSV(CSV_HEADERS, leadsToRows(shown.map(toLead), usersById));
    downloadCSV(`lead-finder-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  if (!user) return null;

  return (
    <AppLayout
      title="Lead Finder"
      subtitle="Busca en Google Maps (200M+ negocios), elige los que te sirven y guárdalos en el CRM."
      actions={
        candidates.length > 0 ? (
          <button className="btn-secondary" onClick={handleExport} title="Exportar a CSV">
            <Download className="h-4 w-4" /> <span className="hidden md:inline">Exportar</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Search agent */}
        <form onSubmit={runSearch} className="card p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <Field icon={<Briefcase className="h-3.5 w-3.5" />} label="Tipo de negocio">
              <input className="input" placeholder="Peluquerías, restaurantes, dentistas…" value={bizType} onChange={(e) => setBizType(e.target.value)} />
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Ubicación">
              <input className="input" placeholder="Ciudad, TX / CDMX / Guadalajara" value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
            <Field label="Cantidad">
              <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
            <button type="submit" className="btn-primary h-[42px] whitespace-nowrap" disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {running ? 'Buscando…' : 'Buscar leads'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-surface-500">
            <div className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5" />
              <span>Idioma</span>
              <select className="input h-8 w-auto py-1 text-xs" value={language} onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2" title="Visita el sitio de cada negocio para extraer email y redes. Más completo pero más lento.">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
              <span>Incluir email y redes <span className="text-surface-400">(más lento)</span></span>
            </label>
            {isAdmin && activeEmployees.length > 0 && (
              <div className="flex items-center gap-2">
                <span>Asignar a</span>
                <select className="input h-8 w-auto py-1 text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value={user.id}>Yo ({user.name})</option>
                  {activeEmployees.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {running && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-surface-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando en Google Maps… puede tardar 1–2 min según la cantidad.
            </p>
          )}
          {error && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </form>

        {/* Candidates */}
        {candidates.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-10 w-10" />}
            title={searched ? 'No encontramos negocios nuevos' : 'Busca y elige tus leads'}
            description={
              searched
                ? 'Prueba otra ciudad o categoría. Los que ya tienes en el CRM no se repiten.'
                : 'Escribe un tipo de negocio y una ubicación arriba, y dale Buscar. Verás los resultados aquí para elegir cuáles guardar.'
            }
          />
        ) : (
          <>
            {/* Selection bar */}
            <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-surface-200 bg-white/90 px-3 py-2 backdrop-blur">
              <button onClick={toggleAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-700 hover:text-brand-700">
                {allSelected ? <CheckSquare className="h-4 w-4 text-brand-600" /> : <Square className="h-4 w-4" />}
                Seleccionar todos
              </button>
              <span className="text-sm text-surface-400">
                {selectedCount > 0 ? `${selectedCount} seleccionado${selectedCount === 1 ? '' : 's'}` : `${candidates.length} encontrados`}
                {meta && ` · ${noWebCount} sin sitio web`}
                {meta && meta.duplicates > 0 && ` · ${meta.duplicates} ya en el CRM`}
              </span>

              <div className="ml-auto flex items-center gap-2">
                <ArrowDownWideNarrow className="h-3.5 w-3.5 text-surface-400" />
                <select className="input h-8 w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} title="Ordenar">
                  <option value="noweb">Sin web primero</option>
                  <option value="rating">Mejor rating</option>
                  <option value="reviews">Más reseñas</option>
                </select>
                <select className="input h-8 w-auto py-1 text-xs" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} title="Rating mínimo">
                  <option value={0}>Todo rating</option>
                  <option value={4}>4.0+ ★</option>
                  <option value={4.5}>4.5+ ★</option>
                </select>
                <button
                  onClick={() => setOnlyNoWeb((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    onlyNoWeb ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Solo sin sitio web
                </button>
                <button
                  className="btn-primary py-1.5"
                  onClick={() => saveCandidates(shown.filter((c) => selected.has(c.tempId)))}
                  disabled={selectedCount === 0 || saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar {selectedCount > 0 ? `(${selectedCount})` : ''}
                </button>
              </div>
            </div>

            {shown.length === 0 ? (
              <EmptyState icon={<Globe className="h-10 w-10" />} title="Sin resultados con esos filtros" description="Ajusta el rating o quita el filtro de sin-web." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((c) => (
                  <LeadFinderCard
                    key={c.tempId}
                    lead={toLead(c)}
                    onOpen={() => setPreview(c)}
                    selectable
                    selected={selected.has(c.tempId)}
                    saved={savedIds.has(c.tempId)}
                    onToggleSelect={() => toggleSelect(c.tempId)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <LeadCandidateModal
        candidate={preview}
        open={Boolean(preview)}
        saved={preview ? savedIds.has(preview.tempId) : false}
        onClose={() => setPreview(null)}
        onSave={(c) => saveCandidates([c])}
      />
    </AppLayout>
  );
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-surface-400">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
