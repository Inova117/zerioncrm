import { useMemo, useState } from 'react';
import { Plus, Search, KanbanSquare, LayoutList, Columns3, Flame, Clock, User as UserIcon, Upload, Download, Bot } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { KanbanBoard } from '../components/leads/KanbanBoard';
import { LeadsTable } from '../components/leads/LeadsTable';
import { PulseBar } from '../components/leads/PulseBar';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { ImportCsvModal } from '../components/leads/ImportCsvModal';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { Lead, Temperature } from '../types';
import { cn, followUpLevel } from '../lib/utils';
import { toCSV, downloadCSV } from '../lib/csv';
import { CSV_HEADERS, leadsToRows } from '../lib/leadsCsv';

type View = 'board' | 'list';

export function LeadsPage() {
  const { user, isAdmin } = useAuth();
  const {
    loading,
    leads,
    users,
    commentCounts,
    createLead,
    importLeads,
    updateLead,
    moveLead,
    commitDrag,
    removeLead,
    loadComments,
    addComment,
  } = useData();

  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [view, setView] = useState<View>('board');
  const [chips, setChips] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);

  const employees = useMemo(() => users.filter((u) => u.role === 'employee'), [users]);
  const activeEmployees = useMemo(() => employees.filter((u) => u.active), [employees]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const assignableEmployees = useMemo(() => {
    let list = activeEmployees;
    const owner = editing ? usersById.get(editing.assignedTo) : undefined;
    if (owner && !list.some((u) => u.id === owner.id)) list = [...list, owner];
    if (list.length === 0 && user) list = [user];
    return list;
  }, [activeEmployees, editing, usersById, user]);

  // When an admin is filtering by an employee, new leads (quick-add / import)
  // default to THAT employee so the created card isn't hidden by the filter. (#2)
  const defaultAssignee = isAdmin
    ? (ownerFilter !== 'all' ? ownerFilter : activeEmployees[0]?.id ?? user?.id ?? '')
    : user?.id ?? '';

  // Resolve a "Responsable" name from a CSV to a user id (round-trips owners). (#3)
  const resolveOwner = useMemo(() => {
    const byName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u.id]));
    return (name: string) => byName.get(name.trim().toLowerCase());
  }, [users]);

  // Role + owner scope (the "book of business" the pulse bar summarizes).
  const scopedLeads = useMemo(() => {
    let list = isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id);
    if (isAdmin && ownerFilter !== 'all') list = list.filter((l) => l.assignedTo === ownerFilter);
    return list;
  }, [leads, isAdmin, user, ownerFilter]);

  // Quick-filter chips + search applied on top.
  const visibleLeads = useMemo(() => {
    let list = scopedLeads;
    if (chips.has('mine')) list = list.filter((l) => l.assignedTo === user?.id);
    if (chips.has('hot')) list = list.filter((l) => l.temperature === 'caliente');
    if (chips.has('stale'))
      list = list.filter(
        (l) =>
          l.temperature !== 'cliente' &&
          l.temperature !== 'perdido' &&
          followUpLevel(l.lastContactAt) === 'stale'
      );
    if (chips.has('scraper')) list = list.filter((l) => l.source === 'scraper');
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.company.toLowerCase().includes(q) ||
          l.contactName.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q) ||
          l.channel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [scopedLeads, chips, user, query]);

  const detailLead = detail ? leads.find((l) => l.id === detail.id) ?? null : null;

  const toggleChip = (key: string) =>
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function handleMove(leadId: string, to: Temperature) {
    await moveLead(leadId, to);
  }

  async function handleQuickAdd(temperature: Temperature, company: string) {
    await createLead({
      company,
      contactName: '',
      role: '',
      email: '',
      phone: '',
      website: '',
      industry: '',
      source: 'otro',
      channel: '',
      reason: '',
      script: '',
      temperature,
      service: 'otro',
      value: 0,
      mrr: 0,
      assignedTo: defaultAssignee,
    });
  }

  function handleExport() {
    const csv = toCSV(CSV_HEADERS, leadsToRows(visibleLeads, usersById));
    downloadCSV(`prospectos-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(lead: Lead) {
    setDetail(null);
    setEditing(lead);
    setFormOpen(true);
  }

  if (!user) return null;

  const chipDefs = [
    { key: 'mine', label: 'Míos', icon: UserIcon, show: isAdmin },
    { key: 'hot', label: 'Calientes', icon: Flame, show: true },
    { key: 'stale', label: 'Sin seguimiento', icon: Clock, show: true },
    { key: 'scraper', label: 'Scraper AI', icon: Bot, show: true },
  ].filter((c) => c.show);

  return (
    <AppLayout
      title="Prospectos"
      subtitle="Arrastra cada empresa entre etapas según su temperatura."
      fullBleed
      actions={
        <>
          <button className="btn-secondary" onClick={handleExport} title="Exportar a CSV">
            <Download className="h-4 w-4" /> <span className="hidden md:inline">Exportar</span>
          </button>
          <button className="btn-secondary" onClick={() => setImportOpen(true)} title="Importar desde CSV">
            <Upload className="h-4 w-4" /> <span className="hidden md:inline">Importar</span>
          </button>
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo prospecto</span>
          </button>
        </>
      }
    >
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              className="input pl-9"
              placeholder="Buscar empresa, contacto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {isAdmin && (
            <select className="input w-auto" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="all">Todo el equipo</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-surface-300 bg-white p-0.5">
            {([
              ['board', Columns3, 'Tablero'],
              ['list', LayoutList, 'Lista'],
            ] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={label}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  view === v ? 'bg-brand-50 text-brand-700' : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <span className="ml-auto text-sm text-surface-400">
            {visibleLeads.length} prospecto{visibleLeads.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2.5 sm:px-6">
          {chipDefs.map(({ key, label, icon: Icon }) => {
            const active = chips.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleChip(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Pulse bar */}
        {!loading && leads.length > 0 && (
          <div className="px-4 pt-2.5 sm:px-6">
            <PulseBar leads={scopedLeads} />
          </div>
        )}

        {/* Content */}
        <div className={cn('min-h-0 flex-1 pt-3', view === 'list' && 'overflow-y-auto')}>
          {loading ? (
            <PageLoader />
          ) : leads.length === 0 ? (
            <div className="px-4 sm:px-6">
              <EmptyState
                icon={<KanbanSquare className="h-10 w-10" />}
                title="Aún no hay prospectos"
                description="Empieza registrando las empresas que estás contactando."
                action={
                  <button className="btn-primary" onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Nuevo prospecto
                  </button>
                }
              />
            </div>
          ) : view === 'board' ? (
            <KanbanBoard
              leads={visibleLeads}
              users={users}
              commentCounts={commentCounts}
              onOpenLead={setDetail}
              onCommit={commitDrag}
              onQuickAdd={handleQuickAdd}
            />
          ) : (
            <LeadsTable leads={visibleLeads} usersById={usersById} onOpenLead={setDetail} />
          )}
        </div>
      </div>

      {/* Create / edit */}
      <LeadFormModal
        key={`${formOpen}-${editing?.id ?? 'new'}`}
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
          else await createLead(input);
        }}
      />

      {/* Import CSV (keyed so it resets between opens — #7) */}
      <ImportCsvModal
        key={importOpen ? 'import-open' : 'import-closed'}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultAssignee={defaultAssignee}
        resolveOwner={resolveOwner}
        onImport={importLeads}
      />

      {/* Detail */}
      <LeadDetailModal
        lead={detailLead}
        open={Boolean(detailLead)}
        onClose={() => setDetail(null)}
        owner={detailLead ? usersById.get(detailLead.assignedTo) : undefined}
        usersById={usersById}
        onEdit={openEdit}
        onMove={handleMove}
        onDelete={removeLead}
        loadComments={loadComments}
        addComment={addComment}
        onSaveScript={(script) => {
          if (!detailLead) return Promise.resolve();
          return updateLead(detailLead.id, { script });
        }}
      />
    </AppLayout>
  );
}
