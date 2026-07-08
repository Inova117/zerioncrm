import type { Lead, Contact, Temperature } from '../types';

// A "Company" is derived by grouping opportunities (leads) that share the same
// company name. Keeps the data model simple while giving a real account view:
// all opportunities + contacts + value for one client in one place.

const ORDER: Temperature[] = ['nuevo', 'frio', 'tibio', 'caliente', 'reunion', 'cliente', 'perdido'];
const rank = (t: Temperature) => ORDER.indexOf(t);

export interface CompanyGroup {
  key: string; // normalized name (grouping key)
  name: string; // display name
  industry: string;
  leads: Lead[]; // opportunities
  contacts: Contact[];
  totalValue: number;
  totalMrr: number;
  openCount: number;
  wonCount: number;
  /** Best current status: hottest open stage, else won, else lost. */
  status: Temperature;
  ownerIds: string[];
  lastContactAt: string | null;
}

const normalize = (name: string) => name.trim().toLowerCase();

export function groupCompanies(leads: Lead[], contacts: Contact[]): CompanyGroup[] {
  const byKey = new Map<string, Lead[]>();
  for (const l of leads) {
    const key = normalize(l.company);
    if (!key) continue;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(l);
  }

  const contactsByLead = new Map<string, Contact[]>();
  for (const c of contacts) {
    (contactsByLead.get(c.leadId) ?? contactsByLead.set(c.leadId, []).get(c.leadId)!).push(c);
  }

  const groups: CompanyGroup[] = [];
  for (const [key, groupLeads] of byKey) {
    const open = groupLeads.filter((l) => l.temperature !== 'cliente' && l.temperature !== 'perdido');
    const won = groupLeads.filter((l) => l.temperature === 'cliente');

    let status: Temperature;
    if (open.length) {
      status = open.reduce((best, l) => (rank(l.temperature) > rank(best) ? l.temperature : best), open[0].temperature);
    } else if (won.length) {
      status = 'cliente';
    } else {
      status = 'perdido';
    }

    const groupContacts = groupLeads.flatMap((l) => contactsByLead.get(l.id) ?? []);
    const lastContactAt = groupLeads
      .map((l) => l.lastContactAt)
      .filter(Boolean)
      .sort((a, b) => (b as string).localeCompare(a as string))[0] ?? null;

    groups.push({
      key,
      name: groupLeads.find((l) => l.company.trim())?.company.trim() ?? key,
      industry: groupLeads.find((l) => l.industry)?.industry ?? '',
      leads: groupLeads.sort((a, b) => rank(b.temperature) - rank(a.temperature)),
      contacts: groupContacts,
      // Exclude lost opportunities so an account's value isn't overstated. (#22)
      totalValue: groupLeads.filter((l) => l.temperature !== 'perdido').reduce((s, l) => s + l.value, 0),
      totalMrr: won.reduce((s, l) => s + l.mrr, 0),
      openCount: open.length,
      wonCount: won.length,
      status,
      ownerIds: [...new Set(groupLeads.map((l) => l.assignedTo))],
      lastContactAt,
    });
  }

  // Most opportunities first, then by value.
  return groups.sort((a, b) => b.leads.length - a.leads.length || b.totalValue - a.totalValue);
}
