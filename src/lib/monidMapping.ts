// ============================================================================
// Monid mapping — lógica PURA de mapeo de shapes de la API Monid.
// ----------------------------------------------------------------------------
// Las respuestas de Monid (ContactOut, Hunter, Apollo, Clay, PDL) tienen shapes
// NO intuitivos. Este módulo normaliza cada uno a estructuras tipadas y estables,
// de modo que la UI y el scoring nunca dependan del wire-format.
//
// Timeless teaching: el BUG más caro del V2 fue asumir que ContactOut devolvía
// `profiles` como ARRAY cuando en realidad era un DICCIONARIO indexado por URL
// de LinkedIn. Estas funciones + tests son el regress-guard de eso.
//
// PURE: sin fetch, sin Deno, sin Supabase — testable con vitest directo.
// Las fixtures son copia fiel de respuestas REALES (sep 2026).
// ============================================================================

// --- ContactOut decision-makers ---------------------------------------------

export interface ContactPerson {
  full_name?: string;
  title?: string;
  seniority?: string;
  job_function?: string;
  contact_availability?: { work_email?: boolean; personal_email?: boolean; phone?: boolean };
}

/**
 * ContactOut devuelve `profiles` como OBJETO indexado por URL de LinkedIn:
 *   { "https://linkedin.com/in/x": { full_name, title, ... }, ... }
 * — NO como array. Aplana ambos casos (dict → Object.values, array → él mismo).
 */
export function mapContactOutProfiles(profiles: unknown): ContactPerson[] {
  if (!profiles) return [];
  if (Array.isArray(profiles)) return profiles as ContactPerson[];
  if (typeof profiles === 'object') return Object.values(profiles as Record<string, ContactPerson>);
  return [];
}

// --- Hunter domain-search ---------------------------------------------------

export interface HunterEmail {
  email?: string;
  type?: string;
  confidence?: number;
  position?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Hunter `/domain-search` → `{ data: { emails: [{ value, type, confidence,
 * first_name, last_name, position }] } }`. Normaliza `value` → `email`.
 */
export function mapHunterEmails(output: unknown): HunterEmail[] {
  const data = (output as { data?: { emails?: Array<Record<string, unknown>> } })?.data;
  const emails = data?.emails ?? [];
  return emails.map((e) => ({
    email: typeof e.value === 'string' ? e.value : undefined,
    type: typeof e.type === 'string' ? e.type : undefined,
    confidence: typeof e.confidence === 'number' ? e.confidence : undefined,
    position: typeof e.position === 'string' ? e.position : undefined,
    first_name: typeof e.first_name === 'string' ? e.first_name : undefined,
    last_name: typeof e.last_name === 'string' ? e.last_name : undefined,
  }));
}

// --- Apollo people ----------------------------------------------------------

export interface ApolloPerson {
  first_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  organization?: { name?: string };
  has_email?: boolean;
  has_direct_phone?: string;
}

/** Apollo `/mixed_people/api_search` → `{ total_entries, people: [{...}] }`. */
export function mapApolloPeople(output: unknown): ApolloPerson[] {
  return ((output as { people?: ApolloPerson[] })?.people) ?? [];
}

// --- Clay people ------------------------------------------------------------

export interface ClayPerson {
  clay_profile_id?: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  location?: { name?: string; city?: string };
  matched_experiences?: Array<{ company?: string; title?: string }>;
}

/** Clay `/search/query-mode/run` → `{ data: [{ clay_profile_id, name, ... }] }`. */
export function mapClayPeople(output: unknown): ClayPerson[] {
  return ((output as { data?: ClayPerson[] })?.data) ?? [];
}

// --- PDL firm (founded/empleados/funding) ------------------------------------

export interface FirmSignals {
  empleados?: number;
  founded?: number;
  antiguedad?: number;
  size?: string;
  industry?: string;
  linkedinUrl?: string;
  totalFunding?: number;
  fundingStage?: string;
}

/**
 * PDL `/v5/company/enrich` → `{ employee_count, founded, size, industry,
 * total_funding_raised, latest_funding_stage, linkedin_url }`. Normaliza a las
 * señales del Minero + deriva `antiguedad` desde `founded`.
 */
export function mapPdlFirm(output: unknown): FirmSignals {
  const p = output as Record<string, unknown>;
  const derived: FirmSignals = {};
  if (typeof p.employee_count === 'number') derived.empleados = p.employee_count;
  if (typeof p.founded === 'number') {
    derived.founded = p.founded;
    derived.antiguedad = Math.max(0, new Date().getFullYear() - p.founded);
  }
  if (typeof p.size === 'string') derived.size = p.size;
  if (typeof p.industry === 'string') derived.industry = p.industry;
  if (typeof p.linkedin_url === 'string') derived.linkedinUrl = p.linkedin_url;
  if (typeof p.total_funding_raised === 'number') derived.totalFunding = p.total_funding_raised;
  if (typeof p.latest_funding_stage === 'string') derived.fundingStage = p.latest_funding_stage;
  return derived;
}

// --- Scoring (paridad con src/lib/facturacion.ts + reseñas) ------------------

export type NivelFacturacion = 'sostiene' | 'probable' | 'no' | 'sin-datos';

/**
 * Score de facturación (0-100) replicando `facturacion.ts` + la señal de
 * reseñas (decisión sep 2026: los negocios locales no están en PDL, las reseñas
 * de Google son proxy válido). `null` si no hay NINGUNA señal.
 */
export function scoreFacturacion(s: {
  empleados?: number;
  antiguedad?: number;
  founded?: number;
  resenas?: number;
}): number | null {
  const parts: number[] = [];
  if (typeof s.empleados === 'number') {
    const n = s.empleados;
    parts.push(n >= 20 ? 100 : n >= 10 ? 80 : n >= 5 ? 60 : n >= 3 ? 40 : n >= 1 ? 20 : 0);
  }
  const antig = s.antiguedad ?? (s.founded != null ? new Date().getFullYear() - s.founded : undefined);
  if (typeof antig === 'number') {
    parts.push(antig >= 21 ? 80 : antig >= 11 ? 60 : antig >= 3 ? 40 : 15);
  }
  if (typeof s.resenas === 'number') {
    const n = s.resenas;
    parts.push(n >= 500 ? 95 : n >= 200 ? 80 : n >= 50 ? 65 : n >= 10 ? 40 : 15);
  }
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function nivelOf(score: number | null): NivelFacturacion {
  if (score === null) return 'sin-datos';
  if (score >= 70) return 'sostiene';
  if (score >= 40) return 'probable';
  return 'no';
}

// --- Parse de intención (fallback determinístico, sin LLM) -------------------

export interface Intent {
  niche: string;
  city: string;
  objetivo: 'sostiene' | 'probable' | 'todos';
  tipo: 'local' | 'b2b';
}

const B2B_KEYWORDS = /software|tecnolog|tech\b|saas|\bit\b|desarrollo|consultor|consulting|agencia|marketing|publicidad|advertising|branding|diseño|fintech|startup|digital|legal|abogad|contab|auditor|ingenier|arquitect|logíst|ecommerce|e-commerce|telecom|seguros|inmobiliar/i;

/** Heurística sin LLM: extrae nicho/ciudad/objetivo/tipo de una frase natural. */
export function parseIntentFallback(text: string): Intent {
  // Captura "en <ciudad>" de forma lazy, cortando en cláusulas de filtro
  // ("que sostengan", "probable", "todos") o en el final. Acepta ciudades
  // compuestas y mayúsculas/minúsculas mezcladas.
  const cityMatch = text.match(
    /\ben\s+([a-záéíóúñA-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ]*(?:\s+[a-záéíóúñA-ZÁÉÍÓÚÑ]+)*?)(?=\s+que\b|\s+sostien|\s+probable\b|\s+todos\b|\s+y\b|$)/i,
  );
  const city = cityMatch?.[1] ?? '';
  const objetivo: Intent['objetivo'] = /sostien|sosten|sosteng|establecid|factur|plata|grande/i.test(text)
    ? 'sostiene'
    : /probable|quiz|tal vez|medio/i.test(text)
      ? 'probable'
      : 'todos';
  let niche = text;
  if (cityMatch) niche = text.slice(0, cityMatch.index).trim();
  niche = niche.replace(/^(dame|busca|quiero|necesito|encontr)\w*\s+/i, '').trim();
  const tipo: Intent['tipo'] = B2B_KEYWORDS.test(text) ? 'b2b' : 'local';
  return { niche: niche || 'negocio', city, objetivo, tipo };
}