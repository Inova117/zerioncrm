import type { Lead, User, Service, Temperature, Source } from '../types';
import { SERVICES, STAGES, SOURCES, serviceLabel, stageLabel, sourceLabel } from './constants';
import type { NewLeadInput } from '../services/leadsService';

export const CSV_HEADERS = [
  'Empresa',
  'Contacto',
  'Cargo',
  'Email',
  'Teléfono',
  'Sitio web',
  'Industria',
  'Servicio',
  'Temperatura',
  'Presupuesto',
  'MRR',
  'Fuente',
  'Canal',
  'Motivo',
  'Responsable',
];

export function leadToRow(lead: Lead, ownerName: string): (string | number)[] {
  return [
    lead.company,
    lead.contactName,
    lead.role,
    lead.email,
    lead.phone,
    lead.website,
    lead.industry,
    serviceLabel(lead.service),
    stageLabel(lead.temperature),
    lead.value,
    lead.mrr,
    sourceLabel(lead.source),
    lead.channel,
    lead.reason,
    ownerName,
  ];
}

export function leadsToRows(leads: Lead[], usersById: Map<string, User>): (string | number)[][] {
  return leads.map((l) => leadToRow(l, usersById.get(l.assignedTo)?.name ?? ''));
}

// --- import mapping (accepts either the Spanish label or the raw key) --------
const lc = (s: string) => s.trim().toLowerCase();
const serviceMap = new Map<string, Service>(
  SERVICES.flatMap((s) => [[lc(s.label), s.key] as const, [lc(s.key), s.key] as const])
);
const stageMap = new Map<string, Temperature>(
  STAGES.flatMap((s) => [[lc(s.label), s.key] as const, [lc(s.key), s.key] as const])
);
const sourceMap = new Map<string, Source>(
  SOURCES.flatMap((s) => [[lc(s.label), s.key] as const, [lc(s.key), s.key] as const])
);

/** Locale-tolerant number parse: handles "1,500", "1.500", "1,234.56", "1.234,56". */
export function parseNum(v: string): number {
  let s = (v ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // The right-most separator is the decimal; the other groups thousands.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const dec = s.length - lastComma - 1;
    s = dec > 0 && dec <= 2 ? s.replace(',', '.') : s.replace(/,/g, ''); // decimal vs thousands
  } else if (lastDot > -1) {
    const parts = s.split('.');
    const dec = parts[parts.length - 1].length;
    if (parts.length > 2 || dec === 3) s = s.replace(/\./g, ''); // thousands grouping
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normKey = (s: string) => stripAccents(s.trim().toLowerCase());

/**
 * Convert a parsed CSV row → NewLeadInput, or null if it has no company.
 * Header lookup is case/accent-insensitive. `resolveOwner` maps a "Responsable"
 * name to a user id so an exported file round-trips its owners. (#3, #12)
 */
export function rowToLeadInput(
  row: Record<string, string>,
  defaultAssignee: string,
  resolveOwner?: (name: string) => string | undefined
): NewLeadInput | null {
  const nm: Record<string, string> = {};
  for (const k in row) nm[normKey(k)] = row[k];
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = nm[normKey(k)];
      if (v != null && v !== '') return v.trim();
    }
    return '';
  };

  const company = get('Empresa', 'Company', 'Cuenta');
  if (!company) return null;

  const ownerName = get('Responsable', 'Owner', 'Vendedor');
  return {
    company,
    contactName: get('Contacto', 'Contact', 'Nombre'),
    role: get('Cargo', 'Role', 'Puesto'),
    email: get('Email', 'Correo'),
    phone: get('Teléfono', 'Telefono', 'Phone'),
    website: get('Sitio web', 'Website', 'Web'),
    industry: get('Industria', 'Industry'),
    service: serviceMap.get(lc(get('Servicio', 'Service'))) ?? 'otro',
    temperature: stageMap.get(lc(get('Temperatura', 'Etapa', 'Stage'))) ?? 'nuevo',
    value: Math.max(0, parseNum(get('Presupuesto', 'Valor', 'Value'))),
    mrr: Math.max(0, parseNum(get('MRR', 'Retainer'))),
    source: sourceMap.get(lc(get('Fuente', 'Source'))) ?? 'otro',
    channel: get('Canal', 'Channel'),
    reason: get('Motivo', 'Reason'),
    script: '',
    assignedTo: (ownerName && resolveOwner?.(ownerName)) || defaultAssignee,
  };
}
