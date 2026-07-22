import type { Lead, Task, User, EmployeeStats, FunnelStage, Temperature, Service } from '../types';
import { pct } from '../lib/utils';
import { SERVICES } from '../lib/constants';
import { taskDone } from '../lib/objectives';

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
  mrrActive: number; // recurring revenue locked in (retainers of won clients)
  mrrPipeline: number; // potential recurring revenue in open deals
  convContactoTibio: number; // %
  convTibioReunion: number;
  convGlobal: number; // clientes / contactadas
}

export function totals(leads: Lead[]): Totals {
  const contactadas = leads.filter((l) => l.temperature !== 'nuevo').length;
  const tibiosPlus = leads.filter((l) => rank(l.temperature) >= rank('tibio') && l.temperature !== 'perdido');
  const reunionesPlus = leads.filter((l) => rank(l.temperature) >= rank('reunion') && l.temperature !== 'perdido');
  const clientes = leads.filter((l) => l.temperature === 'cliente');
  const open = leads.filter(
    (l) => l.temperature !== 'cliente' && l.temperature !== 'perdido' && l.temperature !== 'no-acepto'
  );

  return {
    contactadas,
    tibios: tibiosPlus.length,
    calientes: leads.filter((l) => l.temperature === 'caliente').length,
    reuniones: reunionesPlus.length,
    clientes: clientes.length,
    perdidos: leads.filter((l) => l.temperature === 'perdido').length,
    pipelineValue: open.reduce((s, l) => s + l.value, 0),
    wonValue: clientes.reduce((s, l) => s + l.value, 0),
    mrrActive: clientes.reduce((s, l) => s + l.mrr, 0),
    mrrPipeline: open.reduce((s, l) => s + l.mrr, 0),
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
        tasksDone: ownTasks.filter((t) => taskDone(t)).length,
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

// ---------------------------------------------------------------------------
// Agency reporting
// ---------------------------------------------------------------------------
export interface ServiceStats {
  service: Service;
  label: string;
  deals: number;
  won: number;
  wonValue: number; // one-time revenue closed
  mrr: number; // recurring revenue closed
  openValue: number; // value still in pipeline
}

/** Per-service-line performance, best revenue first. */
export function byService(leads: Lead[]): ServiceStats[] {
  const map = new Map<Service, ServiceStats>();
  SERVICES.forEach((s) =>
    map.set(s.key, { service: s.key, label: s.label, deals: 0, won: 0, wonValue: 0, mrr: 0, openValue: 0 })
  );
  leads.forEach((l) => {
    const st = map.get(l.service);
    if (!st) return;
    st.deals++;
    if (l.temperature === 'cliente') {
      st.won++;
      st.wonValue += l.value;
      st.mrr += l.mrr;
    } else if (l.temperature !== 'perdido' && l.temperature !== 'no-acepto') {
      st.openValue += l.value;
    }
  });
  return [...map.values()]
    .filter((s) => s.deals > 0)
    .sort((a, b) => b.wonValue - a.wonValue || b.deals - a.deals);
}

/** % of decided deals that were won (won / (won + lost)).
 *  'no-acepto' cuenta como perdido: vio la página y decidió que no. */
export function winRate(leads: Lead[]): number {
  const won = leads.filter((l) => l.temperature === 'cliente').length;
  const lost = leads.filter((l) => l.temperature === 'perdido' || l.temperature === 'no-acepto').length;
  return pct(won, won + lost);
}

/** Average one-time value of won deals. */
export function avgTicket(leads: Lead[]): number {
  const won = leads.filter((l) => l.temperature === 'cliente');
  return won.length ? Math.round(won.reduce((s, l) => s + l.value, 0) / won.length) : 0;
}

/** Open pipeline value per stage (for a value-weighted funnel). */
export function pipelineByStage(leads: Lead[]): { temperature: Temperature; value: number }[] {
  const stages: Temperature[] = ['nuevo', 'frio', 'tibio', 'caliente', 'reunion'];
  return stages.map((temperature) => ({
    temperature,
    value: leads.filter((l) => l.temperature === temperature).reduce((s, l) => s + l.value, 0),
  }));
}
