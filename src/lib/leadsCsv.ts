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

const parseNum = (v: string): number => {
  const n = parseFloat((v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Convert a parsed CSV row → NewLeadInput, or null if it has no company. */
export function rowToLeadInput(
  row: Record<string, string>,
  defaultAssignee: string
): NewLeadInput | null {
  const company = (row['Empresa'] ?? row['empresa'] ?? row['Company'] ?? '').trim();
  if (!company) return null;
  const get = (...keys: string[]) => {
    for (const k of keys) if (row[k] != null && row[k] !== '') return row[k].trim();
    return '';
  };
  return {
    company,
    contactName: get('Contacto', 'Contact', 'Nombre'),
    role: get('Cargo', 'Role', 'Puesto'),
    email: get('Email', 'Correo', 'email'),
    phone: get('Teléfono', 'Telefono', 'Phone', 'teléfono'),
    website: get('Sitio web', 'Website', 'Web'),
    industry: get('Industria', 'Industry'),
    service: serviceMap.get(lc(get('Servicio', 'Service'))) ?? 'web',
    temperature: stageMap.get(lc(get('Temperatura', 'Etapa', 'Stage'))) ?? 'nuevo',
    value: parseNum(get('Presupuesto', 'Valor', 'Value')),
    mrr: parseNum(get('MRR', 'Retainer')),
    source: sourceMap.get(lc(get('Fuente', 'Source'))) ?? 'otro',
    channel: get('Canal', 'Channel'),
    reason: get('Motivo', 'Reason', '¿Por qué?'),
    assignedTo: defaultAssignee,
  };
}
