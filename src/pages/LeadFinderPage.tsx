import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Radar, Briefcase, MapPin, Download, Globe, Sparkles, Search, Loader2,
  AlertCircle, Languages, ArrowDownWideNarrow, Save, CheckSquare, Square, Compass,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { LeadFinderCard } from '../components/leads/LeadFinderCard';
import { LeadCandidateModal } from '../components/leads/LeadCandidateModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { EmptyState, PageLoader } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { findLeads, listDiscoveries, deleteDiscovery, discoveryToInput } from '../services/leadFinderService';
import type { Discovery, Lead, Temperature } from '../types';
import { cn, normalizePhone } from '../lib/utils';
import { toCSV, downloadCSV } from '../lib/csv';
import { CSV_HEADERS, leadsToRows } from '../lib/leadsCsv';

type Tab = 'search' | 'discovered';

/** Wrap a discovery as a pseudo-Lead so the card can render it. */
function toLead(d: Discovery): Lead {
  return {
    id: d.id,
    company: d.company,
    contactName: d.contactName,
    role: d.role,
    email: d.email,
    phone: d.phone,
    website: d.website,
    industry: d.industry,
    source: 'scraper',
    channel: d.channel,
    reason: d.reason,
    script: '',
    temperature: 'nuevo',
    service: d.service,
    value: 0,
    mrr: 0,
    position: 0,
    assignedTo: d.assignedTo,
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
    lastContactAt: null,
    meetingAt: null,
    nextActionAt: null,
    touch: 0,
    enrichment: d.enrichment ?? null,
  };
}

export function LeadFinderPage() {
  const { user, isAdmin } = useAuth();
  const { users, leads: allLeads, importLeads, updateLead, moveLead, removeLead, loadComments, addComment } = useData();

  const [tab, setTab] = useState<Tab>('search');

  // Search form
  const [bizType, setBizType] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(25);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [deep, setDeep] = useState(true); // rich (email + redes) por defecto
  const [assignee, setAssignee] = useState<string>(user?.id ?? '');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [searchResults, setSearchResults] = useState<Discovery[]>([]);
  const [discovered, setDiscovered] = useState<Discovery[]>([]);
  const [loadingDisc, setLoadingDisc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Discovery | null>(null);
  // Saved discoveries open the FULL lead modal (comments/contacts/stage/redes).
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Browsing
  const [onlyNoWeb, setOnlyNoWeb] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<'noweb' | 'rating' | 'reviews'>('noweb');

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeEmployees = useMemo(() => users.filter((u) => u.role === 'employee' && u.active), [users]);

  // A discovery is "saved" when a lead already matches it — by Google place_id
  // OR by phone (mirrors the Edge Function dedup), so a business saved outside
  // the Lead Finder (manual entry / CSV import) still shows green, not re-savable.
  const savedPlaceIds = useMemo(
    () => new Set(allLeads.map((l) => l.enrichment?.placeId).filter(Boolean) as string[]),
    [allLeads]
  );
  const savedPhones = useMemo(
    () => new Set(allLeads.map((l) => normalizePhone(l.phone)).filter(Boolean) as string[]),
    [allLeads]
  );
  const isSaved = useCallback(
    (d: Discovery) => {
      if (savedPlaceIds.has(d.placeId)) return true;
      const pk = normalizePhone(d.phone);
      return pk ? savedPhones.has(pk) : false;
    },
    [savedPlaceIds, savedPhones]
  );

  // The saved lead behind a discovery (matched by place_id or phone).
  const savedLeadFor = useCallback(
    (d: Discovery): Lead | undefined => {
      const pk = normalizePhone(d.phone);
      return allLeads.find(
        (l) =>
          (!!l.enrichment?.placeId && l.enrichment.placeId === d.placeId) ||
          (!!pk && normalizePhone(l.phone) === pk)
      );
    },
    [allLeads]
  );
  const detailLead = detailLeadId ? allLeads.find((l) => l.id === detailLeadId) ?? null : null;

  const assignableEmployees = useMemo(() => {
    let list = activeEmployees;
    const owner = editing ? usersById.get(editing.assignedTo) : undefined;
    if (owner && !list.some((u) => u.id === owner.id)) list = [...list, owner];
    if (list.length === 0 && user) list = [user];
    return list;
  }, [activeEmployees, editing, usersById, user]);

  // Saved → full lead modal (comments/contacts/stage). Unsaved → curate preview.
  function openDiscovery(d: Discovery) {
    const lead = savedLeadFor(d);
    if (lead) setDetailLeadId(lead.id);
    else setPreview(d);
  }

  const loadDiscoveries = useCallback(async () => {
    setLoadingDisc(true);
    try {
      setDiscovered(await listDiscoveries());
    } catch (e) {
      console.error('[lead-finder] no se pudieron cargar los descubiertos:', e);
    } finally {
      setLoadingDisc(false);
    }
  }, []);

  useEffect(() => {
    loadDiscoveries();
  }, [loadDiscoveries]);

  const activeList = tab === 'search' ? searchResults : discovered;

  const shown = useMemo(() => {
    let list = activeList;
    if (onlyNoWeb) list = list.filter((d) => !d.website.trim());
    if (minRating > 0) list = list.filter((d) => (d.enrichment?.rating ?? 0) >= minRating);
    const rating = (d: Discovery) => d.enrichment?.rating ?? 0;
    const reviews = (d: Discovery) => d.enrichment?.reviewCount ?? 0;
    const noWeb = (d: Discovery) => (d.website.trim() ? 0 : 1);
    const sorted = [...list];
    if (sort === 'noweb') sorted.sort((a, b) => noWeb(b) - noWeb(a) || rating(b) - rating(a));
    else if (sort === 'rating') sorted.sort((a, b) => rating(b) - rating(a));
    else if (sort === 'reviews') sorted.sort((a, b) => reviews(b) - reviews(a));
    return sorted;
  }, [activeList, onlyNoWeb, minRating, sort]);

  const noWebCount = useMemo(() => activeList.filter((d) => !d.website.trim()).length, [activeList]);
  const savedCount = useMemo(() => activeList.filter(isSaved).length, [activeList, isSaved]);
  const selectableIds = useMemo(() => shown.filter((d) => !isSaved(d)).map((d) => d.id), [shown, isSaved]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selectedCount = selectableIds.filter((id) => selected.has(id)).length;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!bizType.trim() || !location.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await findLeads({
        businessType: bizType.trim(),
        location: location.trim(),
        limit: count,
        language,
        deep,
        assignedTo: isAdmin ? assignee || user!.id : user!.id,
      });
      setSearchResults(res.discoveries);
      setSelected(new Set());
      setTab('search');
      await loadDiscoveries(); // the new ones are now persisted
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la búsqueda.');
    } finally {
      setRunning(false);
    }
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

  async function save(ds: Discovery[]) {
    const unsaved = ds.filter((d) => !isSaved(d));
    if (!unsaved.length || saving) return;
    setSaving(true);
    try {
      await importLeads(unsaved.map(discoveryToInput)); // reloads context leads → saved recomputes
      setSelected((prev) => {
        const next = new Set(prev);
        unsaved.forEach((d) => next.delete(d.id));
        return next;
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeDiscovery(id: string) {
    try {
      await deleteDiscovery(id);
    } catch (e) {
      console.error('[lead-finder] no se pudo borrar:', e);
      return;
    }
    setDiscovered((prev) => prev.filter((d) => d.id !== id));
    setSearchResults((prev) => prev.filter((d) => d.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (preview?.id === id) setPreview(null);
  }

  function handleExport() {
    const csv = toCSV(CSV_HEADERS, leadsToRows(shown.map(toLead), usersById));
    downloadCSV(`lead-finder-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  if (!user) return null;

  const emptyForTab =
    tab === 'search'
      ? { title: 'Busca y elige tus leads', desc: 'Escribe un tipo de negocio y una ubicación, y dale Buscar. Verás los resultados aquí para elegir cuáles guardar.' }
      : { title: 'Aún no hay descubiertos', desc: 'Los negocios que encuentres se guardan aquí aunque no los pases a leads. En verde los que ya agregaste.' };

  return (
    <AppLayout
      title="Lead Finder"
      subtitle="Busca en Google Maps (200M+ negocios), elige los que te sirven y guárdalos en el CRM."
      actions={
        activeList.length > 0 ? (
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
                {[10, 25, 50].map((n) => (<option key={n} value={n}>{n}</option>))}
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
                  {activeEmployees.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-surface-200">
          <Tab label="Resultados" icon={Search} active={tab === 'search'} count={searchResults.length} onClick={() => { setTab('search'); setSelected(new Set()); }} />
          <Tab label="Descubiertos" icon={Compass} active={tab === 'discovered'} count={discovered.length} onClick={() => { setTab('discovered'); setSelected(new Set()); }} />
        </div>

        {/* Content */}
        {tab === 'discovered' && loadingDisc ? (
          <PageLoader />
        ) : activeList.length === 0 ? (
          <EmptyState icon={<Radar className="h-10 w-10" />} title={emptyForTab.title} description={emptyForTab.desc} />
        ) : (
          <>
            {/* Toolbar */}
            <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-surface-200 bg-white/90 px-3 py-2 backdrop-blur">
              <button onClick={toggleAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-700 hover:text-brand-700" disabled={selectableIds.length === 0}>
                {allSelected ? <CheckSquare className="h-4 w-4 text-brand-600" /> : <Square className="h-4 w-4" />}
                Seleccionar todos
              </button>
              <span className="text-sm text-surface-400">
                {selectedCount > 0 ? `${selectedCount} seleccionado${selectedCount === 1 ? '' : 's'}` : `${activeList.length}`}
                {` · ${noWebCount} sin web`}
                {savedCount > 0 && <span className="text-emerald-600"> · {savedCount} en leads</span>}
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-2">
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
                <button className="btn-secondary py-1.5" onClick={() => save(shown)} disabled={selectableIds.length === 0 || saving} title="Guardar todos los no guardados de esta vista">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar todos
                </button>
                <button className="btn-primary py-1.5" onClick={() => save(shown.filter((d) => selected.has(d.id)))} disabled={selectedCount === 0 || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar {selectedCount > 0 ? `(${selectedCount})` : ''}
                </button>
              </div>
            </div>

            {shown.length === 0 ? (
              <EmptyState icon={<Globe className="h-10 w-10" />} title="Sin resultados con esos filtros" description="Ajusta el rating o quita el filtro de sin-web." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((d) => (
                  <LeadFinderCard
                    key={d.id}
                    lead={toLead(d)}
                    onOpen={() => openDiscovery(d)}
                    selectable
                    selected={selected.has(d.id)}
                    saved={isSaved(d)}
                    onToggleSelect={() => toggleSelect(d.id)}
                    onDelete={tab === 'discovered' ? () => removeDiscovery(d.id) : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Unsaved → curate preview */}
      <LeadCandidateModal
        candidate={preview}
        open={Boolean(preview)}
        saved={preview ? isSaved(preview) : false}
        onClose={() => setPreview(null)}
        onSave={(d) => save([d])}
      />

      {/* Saved → full lead modal (comentarios, contactos, etapa, redes) */}
      <LeadDetailModal
        lead={detailLead}
        open={Boolean(detailLead)}
        onClose={() => setDetailLeadId(null)}
        owner={detailLead ? usersById.get(detailLead.assignedTo) : undefined}
        usersById={usersById}
        onEdit={(lead) => {
          setDetailLeadId(null);
          setEditing(lead);
          setFormOpen(true);
        }}
        onMove={async (leadId: string, to: Temperature) => {
          await moveLead(leadId, to);
        }}
        onDelete={removeLead}
        loadComments={loadComments}
        addComment={addComment}
        onSaveScript={(script) => {
          if (!detailLead) return Promise.resolve();
          return updateLead(detailLead.id, { script });
        }}
      />

      <LeadFormModal
        key={`${formOpen}-${editing?.id ?? 'none'}`}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        employees={assignableEmployees}
        currentUserId={user.id}
        isAdmin={isAdmin}
        initial={editing}
        onSubmit={async (input) => {
          if (editing) await updateLead(editing.id, input);
        }}
      />
    </AppLayout>
  );
}

function Tab({ label, icon: Icon, active, count, onClick }: { label: string; icon: typeof Search; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-800'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count > 0 && (
        <span className={cn('rounded-full px-1.5 py-0.5 text-[11px]', active ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-500')}>
          {count}
        </span>
      )}
    </button>
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
