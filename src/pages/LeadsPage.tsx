import { useMemo, useState } from 'react';
import { Plus, Search, KanbanSquare } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { KanbanBoard } from '../components/leads/KanbanBoard';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { Lead, Temperature } from '../types';

export function LeadsPage() {
  const { user, isAdmin } = useAuth();
  const {
    loading,
    leads,
    users,
    createLead,
    updateLead,
    moveLead,
    commitDrag,
    removeLead,
    loadComments,
    addComment,
  } = useData();

  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);

  const employees = useMemo(() => users.filter((u) => u.role === 'employee'), [users]);
  // Only active employees are assignable (deactivated can't log in). (bug #15)
  const activeEmployees = useMemo(() => employees.filter((u) => u.active), [employees]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Options for the assignee dropdown: active employees, plus the current owner
  // when editing (even if now inactive) so it isn't blank (#11); fall back to the
  // admin themselves when there are no active employees (#19).
  const assignableEmployees = useMemo(() => {
    let list = activeEmployees;
    const owner = editing ? usersById.get(editing.assignedTo) : undefined;
    if (owner && !list.some((u) => u.id === owner.id)) list = [...list, owner];
    if (list.length === 0 && user) list = [user];
    return list;
  }, [activeEmployees, editing, usersById, user]);

  // Employees only see their own leads; admin sees everyone (with a filter).
  const visibleLeads = useMemo(() => {
    let list = isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id);
    if (isAdmin && ownerFilter !== 'all') list = list.filter((l) => l.assignedTo === ownerFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.company.toLowerCase().includes(q) ||
          l.contactName.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, isAdmin, user, ownerFilter, query]);

  // Keep the open detail modal in sync with the latest data.
  const detailLead = detail ? leads.find((l) => l.id === detail.id) ?? null : null;

  async function handleMove(leadId: string, to: Temperature) {
    await moveLead(leadId, to);
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

  return (
    <AppLayout
      title="Prospectos"
      subtitle="Arrastra cada empresa entre etapas según su temperatura."
      fullBleed
      actions={
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo prospecto</span>
        </button>
      }
    >
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
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
            <select
              className="input w-auto"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="all">Todo el equipo</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto text-sm text-surface-400">
            {visibleLeads.length} prospecto{visibleLeads.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Board */}
        <div className="min-h-0 flex-1">
          {loading ? (
            <PageLoader />
          ) : leads.length === 0 ? (
            // Onboarding empty state only when there are truly no leads — not when a
            // filter/search simply hides them (that just shows empty columns). (bug #12)
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
          ) : (
            <KanbanBoard
              leads={visibleLeads}
              users={users}
              onOpenLead={setDetail}
              onCommit={commitDrag}
            />
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
      />
    </AppLayout>
  );
}
