import type { Lead, Task, User, EmployeeStats, FunnelStage, Temperature } from '../types';
import { pct } from '../lib/utils';

// Ordering used to decide "reached at least this stage" for funnel math.
const ORDER: Temperature[] = ['nuevo', 'frio', 'tibio', 'caliente', 'reunion', 'cliente'];
const rank = (t: Temperature) => ORDER.indexOf(t);

/** Count of leads currently in each stage. */
export function funnel(leads: Lead[]): FunnelStage[] {
  return ORDER.map((temperature) => ({
    temperature,
    count: leads.filter((l) => l.temperature === temperature).length,
  }));
}

/** "Reached" funnel: how many leads got at least as far as each stage. */
export function cumulativeFunnel(leads: Lead[]): FunnelStage[] {
  const active = leads.filter((l) => l.temperature !== 'perdido');
  return ORDER.map((temperature) => ({
    temperature,
    count: active.filter((l) => rank(l.temperature) >= rank(temperature)).length,
  }));
}

export interface Totals {
  // Every lead that left "nuevo" — i.e. was actually contacted. Deliberately
  // INCLUDES "perdido": a lost lead was still contacted, and it must count
  // against the conversion rate (convGlobal = clientes / contactadas). (bug #18)
  contactadas: number;
  tibios: number;
  // Point-in-time count of leads currently in "caliente" ("negociando ahora"),
  // intentionally NOT cumulative like tibios/reuniones. (bug #19)
  calientes: number;
  reuniones: number;
  clientes: number;
  perdidos: number;
  pipelineValue: number; // $ of open (non-cliente, non-perdido) leads
  wonValue: number;
  convContactoTibio: number; // %
  convTibioReunion: number;
  convGlobal: number; // clientes / contactadas
}

export function totals(leads: Lead[]): Totals {
  const contactadas = leads.filter((l) => l.temperature !== 'nuevo').length;
  const tibiosPlus = leads.filter((l) => rank(l.temperature) >= rank('tibio') && l.temperature !== 'perdido');
  const reunionesPlus = leads.filter((l) => rank(l.temperature) >= rank('reunion') && l.temperature !== 'perdido');
  const clientes = leads.filter((l) => l.temperature === 'cliente');
  const open = leads.filter((l) => l.temperature !== 'cliente' && l.temperature !== 'perdido');

  return {
    contactadas,
    tibios: tibiosPlus.length,
    calientes: leads.filter((l) => l.temperature === 'caliente').length,
    reuniones: reunionesPlus.length,
    clientes: clientes.length,
    perdidos: leads.filter((l) => l.temperature === 'perdido').length,
    pipelineValue: open.reduce((s, l) => s + l.value, 0),
    wonValue: clientes.reduce((s, l) => s + l.value, 0),
    convContactoTibio: pct(tibiosPlus.length, contactadas),
    convTibioReunion: pct(reunionesPlus.length, tibiosPlus.length),
    convGlobal: pct(clientes.length, contactadas),
  };
}

/** Per-employee performance table (for the founder). */
export function employeeStats(
  users: User[],
  leads: Lead[],
  tasks: Task[]
): EmployeeStats[] {
  return users
    .filter((u) => u.role === 'employee')
    .map((user) => {
      const own = leads.filter((l) => l.assignedTo === user.id);
      const ownTasks = tasks.filter((t) => t.assignedTo === user.id);
      const clientes = own.filter((l) => l.temperature === 'cliente').length;
      const contacted = own.filter((l) => l.temperature !== 'nuevo').length;
      return {
        user,
        contacted,
        tibio: own.filter((l) => rank(l.temperature) >= rank('tibio') && l.temperature !== 'perdido').length,
        caliente: own.filter((l) => l.temperature === 'caliente').length,
        reuniones: own.filter((l) => rank(l.temperature) >= rank('reunion') && l.temperature !== 'perdido').length,
        clientes,
        perdidos: own.filter((l) => l.temperature === 'perdido').length,
        tasksDone: ownTasks.filter((t) => t.done).length,
        tasksTotal: ownTasks.length,
        conversionRate: pct(clientes, contacted),
      };
    })
    .sort((a, b) => b.clientes - a.clientes || b.contacted - a.contacted);
}

/** Leads grouped by source, for a distribution chart. */
export function bySource(leads: Lead[]): { source: string; count: number }[] {
  const map = new Map<string, number>();
  leads.forEach((l) => map.set(l.source, (map.get(l.source) ?? 0) + 1));
  return [...map.entries()].map(([source, count]) => ({ source, count }));
}
