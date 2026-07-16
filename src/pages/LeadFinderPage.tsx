import { useMemo, useState } from 'react';
import { Radar, Briefcase, MapPin, Download, Globe, Sparkles } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { LeadFinderCard } from '../components/leads/LeadFinderCard';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { Lead, Temperature } from '../types';
import { cn } from '../lib/utils';
import { toCSV, downloadCSV } from '../lib/csv';
import { CSV_HEADERS, leadsToRows } from '../lib/leadsCsv';

const norm = (s: string) => s.trim().toLowerCase();

export function LeadFinderPage() {
  const { user, isAdmin } = useAuth();
  const {
    loading,
    leads,
    users,
    updateLead,
    moveLead,
    removeLead,
    loadComments,
    addComment,
  } = useData();

  const [bizType, setBizType] = useState('');
  const [location, setLocation] = useState('');
  const [onlyNoWeb, setOnlyNoWeb] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeEmployees = useMemo(
    () => users.filter((u) => u.role === 'employee' && u.active),
    [users]
  );

  // Only scraper-sourced leads live in the Lead Finder; scope by role.
  const scraperLeads = useMemo(() => {
    const mine = isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id);
    return mine.filter((l) => l.source === 'scraper');
  }, [leads, isAdmin, user]);

  // Suggestions for the two filter boxes.
  const bizOptions = useMemo(
    () => [...new Set(scraperLeads.map((l) => l.industry).filter(Boolean))].sort(),
    [scraperLeads]
  );
  const cityOptions = useMemo(
    () =>
      [...new Set(scraperLeads.map((l) => l.enrichment?.city).filter(Boolean) as string[])].sort(),
    [scraperLeads]
  );

  const results = useMemo(() => {
    let list = scraperLeads;
    if (bizType.trim()) list = list.filter((l) => norm(l.industry).includes(norm(bizType)));
    if (location.trim())
      list = list.filter((l) => norm(l.enrichment?.city ?? '').includes(norm(location)));
    if (onlyNoWeb) list = list.filter((l) => !l.website.trim());
    return list;
  }, [scraperLeads, bizType, location, onlyNoWeb]);

  const noWebCount = useMemo(() => results.filter((l) => !l.website.trim()).length, [results]);
  const detailLead = detail ? leads.find((l) => l.id === detail.id) ?? null : null;

  const assignableEmployees = useMemo(() => {
    let list = activeEmployees;
    const owner = editing ? usersById.get(editing.assignedTo) : undefined;
    if (owner && !list.some((u) => u.id === owner.id)) list = [...list, owner];
    if (list.length === 0 && user) list = [user];
    return list;
  }, [activeEmployees, editing, usersById, user]);

  function handleExport() {
    const csv = toCSV(CSV_HEADERS, leadsToRows(results, usersById));
    downloadCSV(`lead-finder-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  if (!user) return null;

  const hasAny = scraperLeads.length > 0;

  return (
    <AppLayout
      title="Lead Finder"
      subtitle="Empresas locales que trae el scraper de Google Maps. Las que no tienen sitio web son tus clientes más calientes."
      actions={
        hasAny ? (
          <button className="btn-secondary" onClick={handleExport} title="Exportar a CSV">
            <Download className="h-4 w-4" /> <span className="hidden md:inline">Exportar</span>
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <PageLoader />
      ) : !hasAny ? (
        <EmptyState
          icon={<Radar className="h-10 w-10" />}
          title="Aún no llegan leads del scraper"
          description="Corre el ZerionScraperAI (p. ej. peluquerías en tu ciudad). Cada run empuja las empresas encontradas aquí, listas para llamar."
        />
      ) : (
        <div className="space-y-4">
          {/* Search boxes — business type + location */}
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <FilterBox
              icon={<Briefcase className="h-3.5 w-3.5" />}
              label="Tipo de negocio"
              placeholder="Peluquerías, restaurantes…"
              value={bizType}
              onChange={setBizType}
              listId="biz-options"
              options={bizOptions}
            />
            <FilterBox
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Ubicación"
              placeholder="Ciudad"
              value={location}
              onChange={setLocation}
              listId="city-options"
              options={cityOptions}
            />
          </div>

          {/* Counters + no-website toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-surface-500">
              <span className="font-semibold text-surface-800">{results.length}</span> resultado
              {results.length === 1 ? '' : 's'}
              {' · '}
              <span className="font-semibold text-brand-600">{noWebCount}</span> sin sitio web
            </p>
            <button
              onClick={() => setOnlyNoWeb((v) => !v)}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                onlyNoWeb
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-surface-200 text-surface-500 hover:bg-surface-50'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Solo sin sitio web
            </button>
          </div>

          {/* Cards */}
          {results.length === 0 ? (
            <EmptyState
              icon={<Globe className="h-10 w-10" />}
              title="Sin resultados"
              description="Ajusta el tipo de negocio o la ubicación."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((lead) => (
                <LeadFinderCard key={lead.id} lead={lead} onOpen={setDetail} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail modal (reused from Prospectos) */}
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

      {/* Edit form */}
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

function FilterBox({
  icon,
  label,
  placeholder,
  value,
  onChange,
  listId,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  listId: string;
  options: string[];
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 shadow-card focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-surface-400">
        {icon}
        {label}
      </div>
      <input
        className="mt-0.5 w-full border-0 bg-transparent p-0 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
