import { useMemo, useState } from 'react';
import { Search, Building2 } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { CompanyDetailModal } from '../components/companies/CompanyDetailModal';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { Avatar } from '../components/ui/Avatar';
import { TemperatureBadge } from '../components/ui/TemperatureBadge';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { groupCompanies } from '../lib/companies';
import type { CompanyGroup } from '../lib/companies';
import type { Lead, Temperature } from '../types';
import { colorFromString, initials, fmtMoney, fromNow } from '../lib/utils';

export function CompaniesPage() {
  const { user, isAdmin } = useAuth();
  const { loading, leads, contacts, users, updateLead, moveLead, removeLead, loadComments, addComment } =
    useData();

  const [query, setQuery] = useState('');
  const [companyOpen, setCompanyOpen] = useState<CompanyGroup | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeEmployees = useMemo(
    () => users.filter((u) => u.role === 'employee' && u.active),
    [users]
  );
  const assignableEmployees = useMemo(() => {
    let list = activeEmployees;
    const owner = editing ? usersById.get(editing.assignedTo) : undefined;
    if (owner && !list.some((u) => u.id === owner.id)) list = [...list, owner];
    if (list.length === 0 && user) list = [user];
    return list;
  }, [activeEmployees, editing, usersById, user]);

  // Employees see only their own opportunities; admin sees everyone.
  const scopedLeads = useMemo(
    () => (isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id)),
    [leads, isAdmin, user]
  );

  const companies = useMemo(() => groupCompanies(scopedLeads, contacts), [scopedLeads, contacts]);
  const visible = useMemo(() => {
    if (!query.trim()) return companies;
    const q = query.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q));
  }, [companies, query]);

  // Keep open modals synced with latest data.
  const detailLead = detail ? leads.find((l) => l.id === detail.id) ?? null : null;
  const companyLive = companyOpen ? companies.find((c) => c.key === companyOpen.key) ?? null : null;

  function openLeadFromCompany(lead: Lead) {
    setCompanyOpen(null);
    setDetail(lead);
  }
  function openEdit(lead: Lead) {
    setDetail(null);
    setEditing(lead);
    setFormOpen(true);
  }

  if (!user) return null;

  return (
    <AppLayout title="Empresas" subtitle="Tus cuentas: todas las oportunidades y contactos por cliente.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9"
            placeholder="Buscar empresa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="ml-auto text-sm text-surface-400">
          {visible.length} empresa{visible.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <PageLoader />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="Aún no hay empresas"
          description="Cuando registres prospectos, se agruparán aquí por empresa."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 text-center font-medium">Oport.</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">MRR</th>
                <th className="px-3 py-2 text-center font-medium">Contactos</th>
                <th className="px-3 py-2 font-medium">Resp.</th>
                <th className="px-3 py-2 font-medium">Últ. contacto</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.key}
                  onClick={() => setCompanyOpen(c)}
                  className="cursor-pointer border-b border-surface-100 last:border-0 hover:bg-surface-50"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                        style={{ backgroundColor: colorFromString(c.name) }}
                      >
                        {initials(c.name) || '·'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-surface-800">{c.name}</p>
                        {c.industry && <p className="truncate text-xs text-surface-400">{c.industry}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-medium text-surface-700">{c.leads.length}</td>
                  <td className="px-3 py-2.5">
                    <TemperatureBadge temperature={c.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-surface-700">
                    {fmtMoney(c.totalValue)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">
                    {c.totalMrr > 0 ? `${fmtMoney(c.totalMrr)}/mes` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center text-surface-500">{c.contacts.length}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex -space-x-1.5">
                      {c.ownerIds.slice(0, 3).map((id) => {
                        const u = usersById.get(id);
                        return u ? <Avatar key={id} name={u.name} color={u.avatarColor} size="sm" /> : null;
                      })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-surface-500">
                    {fromNow(c.lastContactAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CompanyDetailModal
        group={companyLive}
        open={Boolean(companyLive)}
        onClose={() => setCompanyOpen(null)}
        usersById={usersById}
        onOpenLead={openLeadFromCompany}
      />

      <LeadDetailModal
        lead={detailLead}
        open={Boolean(detailLead)}
        onClose={() => setDetail(null)}
        owner={detailLead ? usersById.get(detailLead.assignedTo) : undefined}
        usersById={usersById}
        onEdit={openEdit}
        onMove={(id: string, to: Temperature) => moveLead(id, to)}
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
