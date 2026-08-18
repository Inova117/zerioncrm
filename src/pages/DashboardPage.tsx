import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Building2,
  Flame,
  MessageCircle,
  Send,
  Trophy,
  TrendingUp,
  DollarSign,
  Handshake,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { StatCard } from '../components/dashboard/StatCard';
import { Funnel } from '../components/dashboard/Funnel';
import { SourceChart } from '../components/dashboard/SourceChart';
import { EmployeeLeaderboard } from '../components/dashboard/EmployeeLeaderboard';
import { ProspectionDecisionsCard } from '../components/dashboard/ProspectionDecisionsCard';
import { PageLoader } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { cumulativeFunnel, totals, employeeStats } from '../services/metricsService';
import { fmtMoney, taskIsCurrent } from '../lib/utils';
import { taskDone } from '../lib/objectives';
import { dailyActivityService } from '../services/dailyActivityService';
import type { DailyActivity } from '../types';
import { dayKey, weekDays, activityTotals } from '../lib/dailyActivityUtils';

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { loading, leads: allLeads, tasks, users } = useData();

  const scopedLeads = useMemo(
    () => (isAdmin ? allLeads : allLeads.filter((l) => l.assignedTo === user?.id)),
    [allLeads, isAdmin, user]
  );

  const t = useMemo(() => totals(scopedLeads), [scopedLeads]);
  const funnel = useMemo(() => cumulativeFunnel(scopedLeads), [scopedLeads]);
  const stats = useMemo(() => employeeStats(users, allLeads, tasks), [users, allLeads, tasks]);

  // Check-ins diarios del equipo (semana actual) — supervisión del admin.
  const [teamActivity, setTeamActivity] = useState<DailyActivity[]>([]);
  const activeEmployees = useMemo(() => users.filter((u) => u.role === 'employee' && u.active), [users]);
  const week = useMemo(() => weekDays(new Date()), []);
  const weekFrom = dayKey(week[0]!);
  const weekTo = dayKey(week[4]!);
  useEffect(() => {
    if (!isAdmin || activeEmployees.length === 0) return;
    dailyActivityService
      .listRange(
        activeEmployees.map((u) => u.id),
        weekFrom,
        weekTo
      )
      .then(setTeamActivity)
      .catch(() => setTeamActivity([]));
  }, [isAdmin, activeEmployees, weekFrom, weekTo]);

  const myTodayTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.assignedTo === user?.id &&
          task.cadence === 'daily' &&
          !taskDone(task) &&
          (task.recurring || taskIsCurrent(task))
      ),
    [tasks, user]
  );

  if (!user) return null;

  const firstName = user.name.split(' ')[0];

  return (
    <AppLayout
      title={`Hola, ${firstName} 👋`}
      subtitle={
        isAdmin
          ? 'Resumen del outreach de todo el equipo.'
          : 'Tu resumen de prospección.'
      }
    >
      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Empresas contactadas"
              value={t.contactadas}
              hint={`${t.perdidos} perdidas`}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              label="En contacto"
              value={t.enContacto}
              hint="Hablados, persiguiendo respuesta"
              icon={<MessageCircle className="h-4 w-4" />}
              accent="text-blue-600"
              accentBg="bg-blue-50"
            />
            <StatCard
              label="Demos enviadas"
              value={t.demos}
              hint={`${t.convContactoDemo}% de contactadas`}
              icon={<Send className="h-4 w-4" />}
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              label="Negociando"
              value={t.negociando}
              hint={`${t.convDemoNegociando}% de las demos`}
              icon={<Flame className="h-4 w-4" />}
              accent="text-red-600"
              accentBg="bg-red-50"
            />
            <StatCard
              label="Clientes cerrados"
              value={t.clientes}
              hint={`${t.convGlobal}% conversión global`}
              icon={<Handshake className="h-4 w-4" />}
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              label="Valor en pipeline"
              value={fmtMoney(t.pipelineValue)}
              hint="Oportunidades abiertas"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Valor ganado"
              value={fmtMoney(t.wonValue)}
              hint="Negocios cerrados"
              icon={<DollarSign className="h-4 w-4" />}
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              label="Tareas de hoy"
              value={myTodayTasks.length}
              hint={myTodayTasks.length === 0 ? '¡Todo al día!' : 'Pendientes'}
              icon={<Trophy className="h-4 w-4" />}
              accent="text-brand-600"
              accentBg="bg-brand-50"
            />
          </div>

          {/* Prospección autónoma: la decisión de hoy */}
          <ProspectionDecisionsCard />

          {/* Funnel + source */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-surface-800">Embudo de conversión</h2>
                <p className="text-xs text-surface-400">
                  Cuántos prospectos alcanzaron al menos cada etapa.
                </p>
              </div>
              <Funnel stages={funnel} />
            </div>

            <div className="card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-surface-800">Prospectos por fuente</h2>
                <p className="text-xs text-surface-400">De dónde vienen tus oportunidades.</p>
              </div>
              <SourceChart leads={scopedLeads} />
            </div>
          </div>

          {/* Admin: leaderboard */}
          {isAdmin && (
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-brand-600" />
                <div>
                  <h2 className="text-sm font-semibold text-surface-800">Desempeño del equipo</h2>
                  <p className="text-xs text-surface-400">
                    Actividad de outreach del staff.
                  </p>
                </div>
              </div>
              <EmployeeLeaderboard stats={stats} />
            </div>
          )}

          {/* Admin: check-ins diarios del equipo (esta semana) */}
          {isAdmin && activeEmployees.length > 0 && (
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-600" />
                <div>
                  <h2 className="text-sm font-semibold text-surface-800">Equipo — esta semana</h2>
                  <p className="text-xs text-surface-400">
                    Check-in diario: llamadas, contactos, demos y cierres.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                      <th className="pb-2 pr-2">Vendedor</th>
                      <th className="pb-2 pr-2 text-center">Llamadas</th>
                      <th className="pb-2 pr-2 text-center">Contactos</th>
                      <th className="pb-2 pr-2 text-center">Demos</th>
                      <th className="pb-2 pr-2 text-center">Cierres</th>
                      <th className="pb-2 pr-2 text-center">Demo→cierre</th>
                      <th className="pb-2 text-center">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((u) => {
                      const t = activityTotals(teamActivity.filter((r) => r.userId === u.id));
                      return (
                        <tr key={u.id} className="border-t border-surface-100">
                          <td className="py-2 pr-2 font-medium text-surface-800">
                            <RouterLink to={`/actividad?u=${u.id}`} className="hover:text-brand-600 hover:underline">
                              {u.name}
                            </RouterLink>
                          </td>
                          <td className="py-2 pr-2 text-center text-surface-700">{t.calls}</td>
                          <td className="py-2 pr-2 text-center text-surface-700">{t.contacts}</td>
                          <td className="py-2 pr-2 text-center text-surface-700">{t.demos}</td>
                          <td className="py-2 pr-2 text-center font-semibold text-emerald-700">{t.closes}</td>
                          <td className="py-2 pr-2 text-center text-surface-500">{t.closeRate}%</td>
                          <td className="py-2 pr-2 text-center text-surface-500">{t.daysLogged}/5</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-surface-400">
                <ArrowRight className="mr-1 inline h-3 w-3" /> Clic en el nombre para ver su diario completo.
              </p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
