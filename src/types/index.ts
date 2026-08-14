// ============================================================================
// Zerion CRM — Domain types
// These map 1:1 to the Supabase tables described in README.md / supabase/schema.sql
// ============================================================================

export type UUID = string;
/** ISO 8601 timestamp string, e.g. "2026-07-03T14:20:00.000Z" */
export type ISODate = string;

// ---------------------------------------------------------------------------
// Users / auth
// ---------------------------------------------------------------------------
export type Role = 'admin' | 'employee';

export interface User {
  id: UUID;
  email: string;
  name: string;
  role: Role;
  avatarColor: string; // used for the avatar chip when there's no image
  active: boolean;
  createdAt: ISODate;
}

/** Only exists in the mock/local layer — Supabase Auth stores the real hash. */
export interface Credential {
  userId: UUID;
  email: string;
  password: string; // plaintext ONLY in the mock layer; never in Supabase
}

// ---------------------------------------------------------------------------
// Leads (prospective clients)
// ---------------------------------------------------------------------------

/** Pipeline stage === next ACTION with a date (funnel demo-first). Ordered
 *  coldest → won:
 *    nuevo         → en cola, sin contactar
 *    en-contacto   → hablado; persiguiendo respuesta (reintentos con fecha)
 *    demo-enviada  → vio su página ya hecha; vive la secuencia de toques d1-d14
 *    negociando    → precio/objeciones; una reunión es una FECHA (meetingAt),
 *                    no una etapa
 *    cliente       → pagó
 *    reactivacion  → vio la demo y no compró; reheat a 30/60/90 días
 *    perdido       → no avanzó (3 intentos sin contacto o rechazo definitivo) */
export type Temperature =
  | 'nuevo'
  | 'en-contacto'
  | 'demo-enviada'
  | 'negociando'
  | 'cliente'
  | 'reactivacion'
  | 'perdido';

/** Where the prospect was found / first touched. */
export type Source =
  | 'linkedin'
  | 'instagram'
  | 'email'
  | 'whatsapp'
  | 'referido'
  | 'web'
  | 'evento'
  | 'llamada'
  | 'scraper'
  | 'meta'
  | 'otro';

/** Agency service line the opportunity is about. */
export type Service =
  | 'web'
  | 'app'
  | 'ecommerce'
  | 'branding'
  | 'marketing'
  | 'mantenimiento'
  | 'consultoria'
  | 'otro';

/**
 * Structured extras carried from the ZerionScraperAI pipeline (Google Maps).
 * Present only on scraper-sourced leads; powers the Lead Finder cards.
 */
export interface LeadEnrichment {
  rating?: number; // Google rating (e.g. 4.7)
  reviewCount?: number;
  city?: string;
  segment?: string; // has_website | no_website | social_only | parked
  whatTheyDo?: string;
  score?: number;
  whatsapp?: string;
  address?: string; // short address
  fullAddress?: string; // complete street address
  googleUrl?: string; // Google Maps / Business listing link (always available)
  image?: string; // photo of the business
  price?: string; // $ / $$ / $$$
  socials?: string[]; // social profile URLs (Instagram, Facebook…)
  email?: string; // scraped from the site (deep mode)
  placeId?: string;
  searchId?: string;
  runId?: number;
  profile?: string; // scraper campaign profile name
  /** Análisis técnico de la web (Lead Finder → edge function analyze-site). */
  technical?: SiteTechnical | null;
}

// ---------------------------------------------------------------------------
// Análisis técnico de la web de un prospecto (edge function analyze-site).
// Vive dentro de enrichment.technical en discoveries y leads.
// ---------------------------------------------------------------------------
export interface SiteTechnical {
  analyzedAt: ISODate;
  accessible: boolean; // la web respondió (200-399) al menos por HTTP o HTTPS
  https: boolean; // respondió por https
  httpOk: boolean; // respondió por http (relevante cuando https falla: cert roto)
  certExpired: boolean; // heurística: https falla por cert, http responde
  httpStatus: number; // último status HTTP obtenido (0 si inaccesible)
  loadTimeMs: number; // tiempo del fetch https (o http si https falló)
  title: string;
  hasMetaDescription: boolean;
  hasH1: boolean;
  hasViewport: boolean;
  openGraph: boolean;
  socials: string[]; // links sociales encontrados en el HTML
  stackHints: string[]; // wordpress, wix, shopify, squarespace, joomla, react, next…
  error?: string; // mensaje crudo cuando accessible=false (diagnóstico)
}

export interface Lead {
  id: UUID;
  company: string;
  contactName: string;
  role: string; // contact's job title
  email: string;
  phone: string;
  website: string;
  industry: string;
  source: Source;
  /** Free text: which channel / where they were written to. */
  channel: string;
  /** Why they are a potential client. */
  reason: string;
  /** Guion de llamada específico de este prospecto. Se lee en pantalla durante
   *  la llamada del Sales Copilot y tiene prioridad sobre el guion genérico
   *  de llamada en frío; '' = sin guion propio (se usa el estándar). */
  script: string;
  temperature: Temperature;
  /** Agency service line (web, app, retainer…). */
  service: Service;
  /** One-time estimated project value in USD (0 if unknown). */
  value: number;
  /** Monthly recurring revenue / retainer in USD (0 if not a retainer). */
  mrr: number;
  /** Manual ordering within a Kanban column. */
  position: number;
  assignedTo: UUID; // employee/user id
  createdAt: ISODate;
  updatedAt: ISODate;
  lastContactAt: ISODate | null;
  /** Scheduled meeting date (a date INSIDE "negociando" — not a stage). */
  meetingAt: ISODate | null;
  /** Fecha del PRÓXIMO toque de seguimiento (la vista HOY trabaja con esto).
   *  null = fuera de la cola de seguimiento (nuevo/cliente/perdido). */
  nextActionAt: ISODate | null;
  /** Número del próximo toque en la secuencia de la etapa (1-based; 0 = sin
   *  secuencia). demo-enviada: 1-6 (d1→d14). en-contacto: intentos 1-3.
   *  reactivacion: reheats 1-3 (30/60/90). negociando: seguimiento abierto. */
  touch: number;
  /** Google-Maps enrichment from the scraper (null for hand-entered leads). */
  enrichment?: LeadEnrichment | null;
  /** Meta (Facebook) lead id — 15-17 dígitos que Meta genera para rastrear un
   *  lead. Se puebla cuando el lead entra por el webhook de Lead Ads o cuando se
   *  casa con el id que Meta generó. La Conversions API lo usa como llave de
   *  match de máxima precisión. undefined/null para leads que no vienen de Meta. */
  metaLeadId?: string | null;
  /** Facebook click id (fbc/fbclid) capturado en el momento de la captura del
   *  lead, si está disponible. También es llave de match de máxima prioridad
   *  para la Conversions API. undefined/null si no aplica. */
  fbclid?: string | null;
}

// ---------------------------------------------------------------------------
// Lead Finder — a business FOUND by the scraper (persisted across runs).
// Kept even if not saved as a lead, so past runs never repeat and the user can
// come back to decide. "Saved" is derived by matching placeId against leads.
// ---------------------------------------------------------------------------
export interface Discovery {
  id: UUID;
  placeId: string;
  company: string;
  contactName: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  channel: string;
  reason: string;
  service: Service;
  assignedTo: UUID; // staff the found business is earmarked for
  discoveredBy: UUID; // who ran the search
  createdAt: ISODate;
  enrichment?: LeadEnrichment | null;
}

// ---------------------------------------------------------------------------
// Contacts — the people (stakeholders) at a prospect/account
// ---------------------------------------------------------------------------
export interface Contact {
  id: UUID;
  leadId: UUID;
  name: string;
  role: string; // job title / cargo
  email: string;
  phone: string;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Comments / activity timeline on a lead
// ---------------------------------------------------------------------------
export type ActivityType = 'comment' | 'stage_change' | 'contact' | 'meeting';

export interface Comment {
  id: UUID;
  leadId: UUID;
  authorId: UUID;
  type: ActivityType;
  body: string;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskCadence = 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: UUID;
  title: string;
  notes: string;
  cadence: TaskCadence;
  done: boolean;
  assignedTo: UUID;
  leadId: UUID | null; // optional link to a lead
  dueDate: ISODate | null;
  createdAt: ISODate;
  completedAt: ISODate | null;
  /** Recurring objective: auto-resets each cadence period (vs a one-off task). */
  recurring: boolean;
  /** Numeric goal for the period (0 = a plain done/undone task, no progress bar). */
  target: number;
  /** Current progress toward `target` in the period identified by `periodKey`. */
  progress: number;
  /** The period the progress/done belong to (e.g. "2026-07-08", "2026-W28",
   *  "2026-07"). If it's not the current period, progress/done read as reset. */
  periodKey: string | null;
}

// ---------------------------------------------------------------------------
// Encuesta post-llamada (Sales Copilot) — qué pasó en la llamada, reportado
// manualmente por el vendedor. Se guarda dentro del CallOutcome de cada llamada
// para alimentar métricas reales (embudo, objeciones, cierres, cash).
// ---------------------------------------------------------------------------
export interface CallSurveyAnswers {
  /** ¿Qué pasó con la llamada? (contacto | gatekeeper | no-contesto | colgo) */
  resultado: string;
  /** Objeción principal ('' = no hubo; caro | no-interesa | ya-pagina | sobrino | mandame-info | no-tiempo | pensarlo | otro). */
  objecion: string;
  /** ¿Llegó a presentar la oferta? */
  oferta: 'si' | 'no';
  /** ¿Aceptó ver la página? (amarrada | sin-hora | no) */
  hora: 'amarrada' | 'sin-hora' | 'no';
  /** ¿Cómo terminó? (cliente | negociando | demo-enviada | en-contacto | reactivacion | perdido) */
  desenlace: string;
}

// ---------------------------------------------------------------------------
// Derived / view models
// ---------------------------------------------------------------------------
export interface FunnelStage {
  temperature: Temperature;
  count: number;
}

export interface EmployeeStats {
  user: User;
  contacted: number; // total leads owned that left "nuevo"
  enContacto: number; // hablados (en-contacto o más, sin perdidos/reactivación)
  demos: number; // demo-enviada o más (pipeline activo caliente)
  negociando: number; // point-in-time: leads en "negociando" ahora
  clientes: number;
  perdidos: number;
  tasksDone: number;
  tasksTotal: number;
  conversionRate: number; // clientes / contacted
}

// ---------------------------------------------------------------------------
// Roadmap Zerion (Guía Diaria V1) — plan personal del fundador, 12 semanas.
// Módulo visible SOLO para el owner (admin id 117mgd…). El DIARIO es la
// fuente de verdad: semanas, meses, KPIs y gates se derivan de él.
// ---------------------------------------------------------------------------
export type RoadmapActivityStatus = 'pendiente' | 'hecho' | 'cancelado';

/** Fases del roadmap (columna "Fase" del Excel). */
export type RoadmapPhase =
  | 'Estrategia'
  | 'Oferta'
  | 'Producto'
  | 'Ventas'
  | 'Contenido'
  | 'Control'
  | 'Sistema'
  | 'Escala';

/** Captura diaria (hoja DIARIO). `day` = 'YYYY-MM-DD', clave de la fila. */
export interface RoadmapDay {
  day: string;
  contacts: number; // contactos REALES del día
  demos: number; // demos REALES del día
  webs: number; // webs vendidas ($200)
  aaas: number; // agentes AaaS vendidos
  income: number; // ingreso del día ($)
  content: boolean; // ¿publicó contenido (reel)?
  notes: string;
}

/** Actividad del roadmap (hoja ROADMAP). */
export interface RoadmapActivity {
  id: string;
  week: number; // 1..12
  phase: RoadmapPhase;
  title: string;
  responsible: string;
  dueDate: string | null; // 'YYYY-MM-DD'
  status: RoadmapActivityStatus;
  isGate: boolean; // fila de control con veredicto computado
  sort: number;
}

export type RoadmapProduct = 'web' | 'aaas' | 'otro';
export type RoadmapClientStatus = 'activo' | 'pausado' | 'baja';

/** Cliente con mensualidad (hoja FINANZAS → MRR). */
export interface RoadmapClient {
  id: string;
  name: string;
  product: RoadmapProduct;
  startDate: string | null; // 'YYYY-MM-DD'
  setup: number; // setup cobrado una vez ($)
  monthly: number; // mensualidad ($/mes)
  status: RoadmapClientStatus;
  notes: string;
}

/** Movimiento de caja (hoja FINANZAS → CAJA). */
export interface CashMove {
  id: string;
  day: string; // 'YYYY-MM-DD'
  concept: string;
  income: number;
  expense: number;
}

/** Configuración del módulo (una fila por owner). */
export interface RoadmapMeta {
  planStart: string; // '2026-08-12' — arranque de las 12 semanas
  pitch: string; // elevator pitch AaaS, editable
  reserve: number; // reserva intocable ($)
  /** Metas mensuales: '2026-08' → { income, mrr }. */
  monthlyGoals: Record<string, { income: number; mrr: number }>;
}

/** Documento completo que carga el módulo. */
export interface RoadmapDoc {
  meta: RoadmapMeta;
  days: RoadmapDay[];
  activities: RoadmapActivity[];
  clients: RoadmapClient[];
  cash: CashMove[];
}

// ---------------------------------------------------------------------------
// Actividad diaria del vendedor (check-in manual — supervisión del equipo)
// ---------------------------------------------------------------------------

/** Check-in diario de prospección: el vendedor registra QUÉ HIZO hoy (proceso),
 *  no el estado del pipeline (resultado). Un registro por vendedor y día. */
export interface DailyActivity {
  id: string;
  userId: string;
  /** YYYY-MM-DD (fecha local) — PK compuesta junto a userId. */
  day: string;
  /** Llamadas realizadas (intentos de contacto). */
  calls: number;
  /** Conversaciones reales con el dueño/decididor. */
  contacts: number;
  /** Demos: el prospecto VIO su página ya hecha. */
  demos: number;
  /** Cierres: pago confirmado en el día. */
  closes: number;
  /** Nota libre del vendedor (qué pasó, contextos, aprendizajes). */
  notes: string;
  createdAt: string;
  updatedAt: string;
}
