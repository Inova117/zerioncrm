import { useMemo } from 'react';
import {
  Building2,
  Flame,
  CalendarCheck,
  Trophy,
  TrendingUp,
  DollarSign,
  Thermometer,
  Handshake,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { StatCard } from '../components/dashboard/StatCard';
import { Funnel } from '../components/dashboard/Funnel';
import { SourceChart } from '../components/dashboard/SourceChart';
import { EmployeeLeaderboard } from '../components/dashboard/EmployeeLeaderboard';
import { PageLoader } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { cumulativeFunnel, totals, employeeStats } from '../services/metricsService';
import { fmtMoney, inCadenceWindow } from '../lib/utils';

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { loading, leads, tasks, users } = useData();

  const scopedLeads = useMemo(
    () => (isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id)),
    [leads, isAdmin, user]
  );

  const t = useMemo(() => totals(scopedLeads), [scopedLeads]);
  const funnel = useMemo(() => cumulativeFunnel(scopedLeads), [scopedLeads]);
  const stats = useMemo(() => employeeStats(users, leads, tasks), [users, leads, tasks]);

  const myTodayTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.assignedTo === user?.id &&
          !task.done &&
          task.cadence === 'daily' &&
          inCadenceWindow(task.dueDate ?? task.createdAt, 'daily')
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
              label="Tibios o más"
              value={t.tibios}
              hint={`${t.convContactoTibio}% de contactadas`}
              icon={<Thermometer className="h-4 w-4" />}
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              label="Calientes"
              value={t.calientes}
              hint="Negociando ahora"
              icon={<Flame className="h-4 w-4" />}
              accent="text-red-600"
              accentBg="bg-red-50"
            />
            <StatCard
              label="Reuniones"
              value={t.reuniones}
              hint={`${t.convTibioReunion}% de los tibios`}
              icon={<CalendarCheck className="h-4 w-4" />}
              accent="text-violet-600"
              accentBg="bg-violet-50"
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
                    Actividad de outreach por empleado.
                  </p>
                </div>
              </div>
              <EmployeeLeaderboard stats={stats} />
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
