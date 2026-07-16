import { useMemo, useState } from 'react';
import { Radar, Briefcase, MapPin, Download, Globe, Sparkles, Search, Loader2, CheckCircle2, AlertCircle, Languages, ArrowDownWideNarrow } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { LeadFinderCard } from '../components/leads/LeadFinderCard';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { FindLeadsResult } from '../services/leadFinderService';
import type { Lead, Temperature } from '../types';
import { cn } from '../lib/utils';
import { toCSV, downloadCSV } from '../lib/csv';
import { CSV_HEADERS, leadsToRows } from '../lib/leadsCsv';

export function LeadFinderPage() {
  const { user, isAdmin } = useAuth();
  const {
    loading,
    leads,
    users,
    findLeads,
    updateLead,
    moveLead,
    removeLead,
    loadComments,
    addComment,
  } = useData();

  // Search form
  const [bizType, setBizType] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(25);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [deep, setDeep] = useState(false);
  const [assignee, setAssignee] = useState<string>(user?.id ?? '');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FindLeadsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Browsing
  const [onlyNoWeb, setOnlyNoWeb] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<'noweb' | 'rating' | 'reviews' | 'recent'>('noweb');
  const [detail, setDetail] = useState<Lead | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeEmployees = useMemo(
    () => users.filter((u) => u.role === 'employee' && u.active),
    [users]
  );

  const scraperLeads = useMemo(() => {
    const mine = isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id);
    return mine
      .filter((l) => l.source === 'scraper')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
  }, [leads, isAdmin, user]);

  const shown = useMemo(() => {
    let list = scraperLeads;
    if (onlyNoWeb) list = list.filter((l) => !l.website.trim());
    if (minRating > 0) list = list.filter((l) => (l.enrichment?.rating ?? 0) >= minRating);

    const rating = (l: Lead) => l.enrichment?.rating ?? 0;
    const reviews = (l: Lead) => l.enrichment?.reviewCount ?? 0;
    const noWeb = (l: Lead) => (l.website.trim() ? 0 : 1);
    const sorted = [...list];
    if (sort === 'noweb') sorted.sort((a, b) => noWeb(b) - noWeb(a) || rating(b) - rating(a));
    else if (sort === 'rating') sorted.sort((a, b) => rating(b) - rating(a));
    else if (sort === 'reviews') sorted.sort((a, b) => reviews(b) - reviews(a));
    // 'recent' keeps the newest-first order from scraperLeads
    return sorted;
  }, [scraperLeads, onlyNoWeb, minRating, sort]);
  const noWebCount = useMemo(() => scraperLeads.filter((l) => !l.website.trim()).length, [scraperLeads]);
  const detailLead = detail ? leads.find((l) => l.id === detail.id) ?? null : null;

  const assignableEmployees = useMemo(() => {
    let list = activeEmployees;
    const owner = editing ? usersById.get(editing.assignedTo) : undefined;
    if (owner && !list.some((u) => u.id === owner.id)) list = [...list, owner];
    if (list.length === 0 && user) list = [user];
    return list;
  }, [activeEmployees, editing, usersById, user]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!bizType.trim() || !location.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await findLeads({
        businessType: bizType.trim(),
        location: location.trim(),
        limit: count,
        language,
        deep,
        assignedTo: isAdmin ? assignee || user!.id : user!.id,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la búsqueda.');
    } finally {
      setRunning(false);
    }
  }

  function handleExport() {
    const csv = toCSV(CSV_HEADERS, leadsToRows(shown, usersById));
    downloadCSV(`lead-finder-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  if (!user) return null;

  return (
    <AppLayout
      title="Lead Finder"
      subtitle="Busca en Google Maps (200M+ negocios) y trae los leads al CRM. Los que no tienen sitio web son tus clientes más calientes."
      actions={
        scraperLeads.length > 0 ? (
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
              <input
                className="input"
                placeholder="Peluquerías, restaurantes, dentistas…"
                value={bizType}
                onChange={(e) => setBizType(e.target.value)}
              />
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Ubicación">
              <input
                className="input"
                placeholder="Ciudad, TX / CDMX / Guadalajara"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
            <Field label="Cantidad">
              <select
                className="input"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className="btn-primary h-[42px] whitespace-nowrap" disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {running ? 'Buscando…' : 'Buscar leads'}
            </button>
          </div>

          {/* Idioma del mercado + modo profundo */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-surface-500">
            <div className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5" />
              <span>Idioma</span>
              <select
                className="input h-8 w-auto py-1 text-xs"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2" title="Visita el sitio de cada negocio para extraer email y redes. Más completo pero más lento.">
              <input
                type="checkbox"
                checked={deep}
                onChange={(e) => setDeep(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Incluir email y redes <span className="text-surface-400">(más lento)</span></span>
            </label>
          </div>

          {/* Admin: assign the found leads to a staff member */}
          {isAdmin && activeEmployees.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
              <span>Asignar a</span>
              <select
                className="input h-8 w-auto py-1 text-xs"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value={user.id}>Yo ({user.name})</option>
                {activeEmployees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
          {result && !error && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {result.inserted} lead{result.inserted === 1 ? '' : 's'} nuevo{result.inserted === 1 ? '' : 's'}
              {result.noWebsite > 0 && ` · ${result.noWebsite} sin sitio web`}
              {result.duplicates > 0 && ` · ${result.duplicates} ya existían`}
            </p>
          )}
        </form>

        {/* Results */}
        {loading ? (
          <PageLoader />
        ) : scraperLeads.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-10 w-10" />}
            title="Aún no hay leads"
            description="Escribe un tipo de negocio y una ubicación arriba, y dale Buscar. El agente traerá las empresas de Google Maps al CRM."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-surface-500">
                <span className="font-semibold text-surface-800">{scraperLeads.length}</span> lead
                {scraperLeads.length === 1 ? '' : 's'} en el CRM {' · '}
                <span className="font-semibold text-brand-600">{noWebCount}</span> sin sitio web
              </p>

              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                <select
                  className="input h-8 w-auto py-1 text-xs"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  title="Ordenar"
                >
                  <option value="noweb">Sin web primero</option>
                  <option value="rating">Mejor rating</option>
                  <option value="reviews">Más reseñas</option>
                  <option value="recent">Más recientes</option>
                </select>
              </div>

              <select
                className="input h-8 w-auto py-1 text-xs"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                title="Rating mínimo"
              >
                <option value={0}>Todo rating</option>
                <option value={4}>4.0+ ★</option>
                <option value={4.5}>4.5+ ★</option>
              </select>

              <button
                onClick={() => setOnlyNoWeb((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  onlyNoWeb
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Solo sin sitio web
              </button>
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={<Globe className="h-10 w-10" />}
                title="Todos tienen sitio web"
                description="Quita el filtro para ver todos los leads."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((lead) => (
                  <LeadFinderCard key={lead.id} lead={lead} onOpen={setDetail} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <LeadDetailModal
        lead={detailLead}
        open={Boolean(detailLead)}
        onClose={() => setDetail(null)}
        owner={detailLead ? usersById.get(detailLead.assignedTo) : undefined}
        usersById={usersById}
        onEdit={(lead) => {
          setDetail(null);
          setEditing(lead);
          setFormOpen(true);
        }}
        onMove={async (leadId: string, to: Temperature) => {
          await moveLead(leadId, to);
        }}
        onDelete={removeLead}
        loadComments={loadComments}
        addComment={addComment}
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

function Field({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
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
