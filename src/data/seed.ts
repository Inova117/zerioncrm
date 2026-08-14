import type { User, Credential, Lead, Contact, Comment, Task, Service, RoadmapMeta } from '../types';
import { currentPeriodKey } from '../lib/objectives';
import { defaultActivities, defaultDays, defaultMeta } from './roadmapDefaults';

// ============================================================================
// Seed data for the local/mock backend.
// Dates are generated relative to "now" so the timeline always looks fresh.
// This entire file is only used to bootstrap localStorage the first time;
// once Supabase is live you'll seed the DB instead (see supabase/seed.sql).
// ============================================================================

const now = Date.now();
const DAY = 86_400_000;
const ago = (days: number, hours = 0) =>
  new Date(now - days * DAY - hours * 3_600_000).toISOString();
const ahead = (days: number) => new Date(now + days * DAY).toISOString();

// ---- Users -----------------------------------------------------------------
export const ADMIN_ID = 'usr-admin';
const U_LUCIA = 'usr-lucia';
const U_DIEGO = 'usr-diego';
const U_SARA = 'usr-sara';

export const seedUsers: User[] = [
  {
    id: ADMIN_ID,
    email: 'admin@zerionstudio.com',
    name: 'Martín (Fundador)',
    role: 'admin',
    avatarColor: '#6366f1',
    active: true,
    createdAt: ago(120),
  },
  {
    id: U_LUCIA,
    email: 'lucia@zerionstudio.com',
    name: 'Lucía Fernández',
    role: 'employee',
    avatarColor: '#ec4899',
    active: true,
    createdAt: ago(80),
  },
  {
    id: U_DIEGO,
    email: 'diego@zerionstudio.com',
    name: 'Diego Ramírez',
    role: 'employee',
    avatarColor: '#10b981',
    active: true,
    createdAt: ago(64),
  },
  {
    id: U_SARA,
    email: 'sara@zerionstudio.com',
    name: 'Sara Molina',
    role: 'employee',
    avatarColor: '#f59e0b',
    active: true,
    createdAt: ago(30),
  },
];

// Mock credentials — NEVER ship real plaintext passwords; Supabase Auth replaces this.
export const seedCredentials: Credential[] = [
  { userId: ADMIN_ID, email: 'admin@zerionstudio.com', password: 'zerion2026' },
  { userId: U_LUCIA, email: 'lucia@zerionstudio.com', password: 'lucia123' },
  { userId: U_DIEGO, email: 'diego@zerionstudio.com', password: 'diego123' },
  { userId: U_SARA, email: 'sara@zerionstudio.com', password: 'sara123' },
];

// ---- Leads -----------------------------------------------------------------
let pos = 0;
const p = () => pos++;

const rawLeads: Omit<Lead, 'service' | 'mrr' | 'script' | 'nextActionAt' | 'touch'>[] = [
  {
    id: 'lead-1', company: 'Cafetería Aroma', contactName: 'Marta Ruiz', role: 'Dueña',
    email: 'marta@aroma.mx', phone: '+52 55 1234 5678', website: 'aroma.mx',
    industry: 'Restaurantes', source: 'instagram', channel: 'DM en Instagram',
    reason: 'Publican a diario pero su web está desactualizada. Buen fit para rediseño + reservas.',
    temperature: 'nuevo', value: 3500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(2), updatedAt: ago(2), lastContactAt: ago(2), meetingAt: null,
  },
  {
    id: 'lead-2', company: 'Fitness Pro Gym', contactName: 'Carlos Vega', role: 'Gerente',
    email: 'carlos@fitnesspro.com', phone: '+52 33 2345 6789', website: 'fitnesspro.com',
    industry: 'Fitness', source: 'linkedin', channel: 'InMail en LinkedIn',
    reason: 'Cadena con 3 sucursales sin sistema de membresías digital.',
    temperature: 'nuevo', value: 6000, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(1), updatedAt: ago(1), lastContactAt: ago(1), meetingAt: null,
  },
  {
    id: 'lead-3', company: 'Estudio Legal Vargas', contactName: 'Ana Vargas', role: 'Socia',
    email: 'ana@vargaslegal.com', phone: '+52 81 3456 7890', website: 'vargaslegal.com',
    industry: 'Legal', source: 'referido', channel: 'Referido por cliente actual',
    reason: 'Necesitan presencia digital seria y captación de leads por Google.',
    temperature: 'en-contacto', value: 4500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(6), updatedAt: ago(4), lastContactAt: ago(4), meetingAt: null,
  },
  {
    id: 'lead-4', company: 'EcoTienda Verde', contactName: 'Pablo Sánchez', role: 'Fundador',
    email: 'pablo@ecoverde.mx', phone: '+52 55 4567 8901', website: 'ecoverde.mx',
    industry: 'E-commerce', source: 'email', channel: 'Correo en frío',
    reason: 'Venden por WhatsApp, quieren una tienda online real.',
    temperature: 'en-contacto', value: 5200, position: p(), assignedTo: U_SARA,
    createdAt: ago(8), updatedAt: ago(5), lastContactAt: ago(5), meetingAt: null,
  },
  {
    id: 'lead-5', company: 'Clínica Dental Sonrisa', contactName: 'Dr. Luis Peña', role: 'Director',
    email: 'luis@sonrisadental.com', phone: '+52 33 5678 9012', website: 'sonrisadental.com',
    industry: 'Salud', source: 'instagram', channel: 'Comentario + DM',
    reason: 'Quieren agenda de citas online y campañas de captación.',
    temperature: 'demo-enviada', value: 7000, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(12), updatedAt: ago(2), lastContactAt: ago(2), meetingAt: null,
  },
  {
    id: 'lead-6', company: 'Boutique Lumen', contactName: 'Valeria Cruz', role: 'Dueña',
    email: 'valeria@lumen.mx', phone: '+52 55 6789 0123', website: 'lumen.mx',
    industry: 'Moda', source: 'referido', channel: 'Referido por Aroma',
    reason: 'Marca en crecimiento, quiere e-commerce + branding.',
    temperature: 'en-contacto', value: 8500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(15), updatedAt: ago(3), lastContactAt: ago(3), meetingAt: null,
  },
  {
    id: 'lead-7', company: 'Constructora Nova', contactName: 'Roberto Díaz', role: 'Director Comercial',
    email: 'roberto@nova.com', phone: '+52 81 7890 1234', website: 'novaconstruye.com',
    industry: 'Construcción', source: 'linkedin', channel: 'LinkedIn + llamada',
    reason: 'Proyecto grande de portal de propiedades. Presupuesto alto.',
    temperature: 'negociando', value: 15000, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(20), updatedAt: ago(1), lastContactAt: ago(1), meetingAt: ahead(3),
  },
  {
    id: 'lead-8', company: 'Academia Idiomas Global', contactName: 'Elena Torres', role: 'Coordinadora',
    email: 'elena@idiomasglobal.com', phone: '+52 55 8901 2345', website: 'idiomasglobal.com',
    industry: 'Educación', source: 'web', channel: 'Formulario del sitio',
    reason: 'Plataforma de cursos online + pasarela de pago.',
    temperature: 'negociando', value: 11000, position: p(), assignedTo: U_SARA,
    createdAt: ago(18), updatedAt: ago(2), lastContactAt: ago(2), meetingAt: ahead(5),
  },
  {
    id: 'lead-9', company: 'Restaurante La Terraza', contactName: 'Miguel Ángel', role: 'Propietario',
    email: 'miguel@laterraza.mx', phone: '+52 33 9012 3456', website: 'laterraza.mx',
    industry: 'Restaurantes', source: 'evento', channel: 'Networking en expo',
    reason: 'Reunión agendada para propuesta de menú digital + reservas.',
    temperature: 'negociando', value: 6500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(25), updatedAt: ago(1), lastContactAt: ago(1), meetingAt: ahead(2),
  },
  {
    id: 'lead-10', company: 'TechStart Solutions', contactName: 'Andrea López', role: 'CEO',
    email: 'andrea@techstart.io', phone: '+52 55 0123 4567', website: 'techstart.io',
    industry: 'Tecnología', source: 'linkedin', channel: 'LinkedIn',
    reason: 'Startup que necesita landing + dashboard. Reunión de descubrimiento hecha.',
    temperature: 'negociando', value: 9800, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(28), updatedAt: ago(4), lastContactAt: ago(4), meetingAt: ago(2),
  },
  {
    id: 'lead-11', company: 'Inmobiliaria Cielo', contactName: 'Fernando Gil', role: 'Gerente',
    email: 'fernando@cielo.mx', phone: '+52 81 1122 3344', website: 'cieloinmobiliaria.mx',
    industry: 'Inmobiliaria', source: 'referido', channel: 'Referido',
    reason: 'Cerrado: portal de propiedades con CRM integrado.',
    temperature: 'cliente', value: 13500, position: p(), assignedTo: U_SARA,
    createdAt: ago(45), updatedAt: ago(10), lastContactAt: ago(10), meetingAt: ago(20),
  },
  {
    id: 'lead-12', company: 'Panadería Trigo Dorado', contactName: 'Rosa Méndez', role: 'Dueña',
    email: 'rosa@trigodorado.mx', phone: '+52 55 2233 4455', website: 'trigodorado.mx',
    industry: 'Alimentos', source: 'instagram', channel: 'DM Instagram',
    reason: 'Cerrado: tienda online de pedidos + branding.',
    temperature: 'cliente', value: 4800, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(50), updatedAt: ago(14), lastContactAt: ago(14), meetingAt: ago(30),
  },
  {
    id: 'lead-13', company: 'Autolavado Express', contactName: 'Jorge Núñez', role: 'Dueño',
    email: 'jorge@autoexpress.mx', phone: '+52 33 3344 5566', website: '',
    industry: 'Servicios', source: 'whatsapp', channel: 'WhatsApp Business',
    reason: 'No hubo presupuesto este trimestre.',
    temperature: 'perdido', value: 2500, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(40), updatedAt: ago(18), lastContactAt: ago(18), meetingAt: null,
  },

  // --- Leads del ZerionScraperAI (Google Maps) → alimentan el Lead Finder ---
  {
    id: 'lead-s1', company: 'Estética Bella Vida', contactName: '', role: '',
    email: '', phone: '+52 55 3312 8890', website: '',
    industry: 'Peluquería', source: 'scraper', channel: 'Scraper · cdmx-peluquerias · run #1',
    reason: 'Peluquería · CDMX — ⭐ 4.7 (128 reseñas) — Sin sitio web (oportunidad alta)\nQué hacen: Cortes, tinte y tratamientos capilares',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(0), updatedAt: ago(0), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 4.7, reviewCount: 128, city: 'CDMX', segment: 'no_website', whatTheyDo: 'Cortes, tinte y tratamientos capilares', score: 84, profile: 'cdmx-peluquerias', runId: 1 },
  },
  {
    id: 'lead-s2', company: 'Barbería El Navajazo', contactName: '', role: '',
    email: '', phone: '+52 55 4421 7734', website: '',
    industry: 'Barbería', source: 'scraper', channel: 'Scraper · cdmx-peluquerias · run #1',
    reason: 'Barbería · CDMX — ⭐ 4.9 (312 reseñas) — Sin sitio web (oportunidad alta)\nQué hacen: Cortes de caballero, afeitado clásico y diseño de barba',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(0), updatedAt: ago(0), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 4.9, reviewCount: 312, city: 'CDMX', segment: 'no_website', whatTheyDo: 'Cortes de caballero, afeitado clásico y diseño de barba', score: 91, whatsapp: '+52 55 4421 7734', profile: 'cdmx-peluquerias', runId: 1 },
  },
  {
    id: 'lead-s3', company: 'Salón Glamour Studio', contactName: '', role: '',
    email: '', phone: '+52 55 2298 5510', website: 'glamourstudio.mx',
    industry: 'Peluquería', source: 'scraper', channel: 'Scraper · cdmx-peluquerias · run #1',
    reason: 'Peluquería · CDMX — ⭐ 4.5 (86 reseñas) — Con sitio web\nQué hacen: Peinados, uñas y maquillaje para eventos',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(0), updatedAt: ago(0), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 4.5, reviewCount: 86, city: 'CDMX', segment: 'has_website', whatTheyDo: 'Peinados, uñas y maquillaje para eventos', score: 58, profile: 'cdmx-peluquerias', runId: 1 },
  },
  {
    id: 'lead-s4', company: 'Corte & Estilo GDL', contactName: '', role: '',
    email: '', phone: '+52 33 1567 4420', website: '',
    industry: 'Peluquería', source: 'scraper', channel: 'Scraper · gdl-peluquerias · run #2',
    reason: 'Peluquería · Guadalajara — ⭐ 4.8 (204 reseñas) — Sin sitio web (oportunidad alta)\nQué hacen: Coloración, keratina y tratamientos',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: U_SARA,
    createdAt: ago(1), updatedAt: ago(1), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 4.8, reviewCount: 204, city: 'Guadalajara', segment: 'no_website', whatTheyDo: 'Coloración, keratina y tratamientos', score: 88, whatsapp: '+52 33 1567 4420', profile: 'gdl-peluquerias', runId: 2 },
  },
  {
    id: 'lead-s5', company: 'Studio Hair Lounge', contactName: '', role: '',
    email: '', phone: '+52 33 2044 9981', website: 'studiohairlounge.com',
    industry: 'Peluquería', source: 'scraper', channel: 'Scraper · gdl-peluquerias · run #2',
    reason: 'Peluquería · Guadalajara — ⭐ 4.3 (57 reseñas) — Con sitio web\nQué hacen: Corte, color y alaciado',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: U_SARA,
    createdAt: ago(1), updatedAt: ago(1), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 4.3, reviewCount: 57, city: 'Guadalajara', segment: 'has_website', whatTheyDo: 'Corte, color y alaciado', score: 49, profile: 'gdl-peluquerias', runId: 2 },
  },
  {
    id: 'lead-s6', company: 'Peluquería Doña Chuy', contactName: '', role: '',
    email: '', phone: '+52 33 3390 1122', website: '',
    industry: 'Peluquería', source: 'scraper', channel: 'Scraper · gdl-peluquerias · run #2',
    reason: 'Peluquería · Guadalajara — ⭐ 5.0 (41 reseñas) — Sin sitio web (oportunidad alta)\nQué hacen: Corte familiar y tinte',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(1), updatedAt: ago(1), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 5.0, reviewCount: 41, city: 'Guadalajara', segment: 'no_website', whatTheyDo: 'Corte familiar y tinte', score: 79, profile: 'gdl-peluquerias', runId: 2 },
  },
  // Leads del ADMIN (libro propio — separados del equipo; QA de aislamiento)
  {
    id: 'lead-a1', company: 'Óptica Visión 20/20', contactName: 'Rosa Salazar', role: 'Dueña',
    email: 'rosa@vision2020.ec', phone: '+593 99 100 2000', website: '',
    industry: 'Óptica', source: 'scraper', channel: 'Scraper · uio-opticas · run #1',
    reason: 'Óptica · Quito — sin sitio web. Candidata directa a demo-first.',
    temperature: 'nuevo', value: 0, position: p(), assignedTo: ADMIN_ID,
    createdAt: ago(3), updatedAt: ago(3), lastContactAt: null, meetingAt: null,
    enrichment: { rating: 4.8, reviewCount: 87, city: 'Quito', segment: 'no_website', whatTheyDo: 'Exámenes visuales y lentes', score: 82, profile: 'uio-opticas', runId: 1 },
  },
  {
    id: 'lead-a2', company: 'Panadería La Espiga', contactName: 'Pedro Guamán', role: 'Dueño',
    email: 'pedro@espiga.ec', phone: '+593 98 765 4321', website: '',
    industry: 'Panadería', source: 'scraper', channel: 'Scraper · uio-panaderias · run #1',
    reason: 'Panadería · Quito — sin sitio web, alta demanda local.',
    temperature: 'en-contacto', value: 0, position: p(), assignedTo: ADMIN_ID,
    createdAt: ago(5), updatedAt: ago(5), lastContactAt: ago(5), meetingAt: null,
    enrichment: { rating: 4.6, reviewCount: 34, city: 'Quito', segment: 'no_website', whatTheyDo: 'Pan artesanal y pastelería', score: 71, profile: 'uio-panaderias', runId: 1 },
  },
];

// Tag each seed lead with an agency service line + a few retainers (MRR).
// The 6 scraper leads (indices 13-18) are all "web" opportunities.
const seedServices: Service[] = [
  'web', 'app', 'ecommerce', 'ecommerce', 'app', 'branding', 'app', 'app',
  'web', 'app', 'ecommerce', 'ecommerce', 'mantenimiento',
  'web', 'web', 'web', 'web', 'web', 'web',
];
const seedMrr = [0, 0, 0, 0, 1500, 0, 0, 2500, 0, 3000, 1200, 800, 0, 0, 0, 0, 0, 0, 0];

// Pipeline v2 (seguimiento con fecha): toque actual + próxima acción.
// lead-5 (demo enviada, toque 2) y lead-6 (reintento, hoy) alimentan la vista HOY.
const seedTouch = [0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const seedNextActionAt: (string | null)[] = [
  null, null, null, null, ahead(0), ahead(0), ahead(1), null, ahead(2), null,
  null, null, null, null, null, null, null, null, null, null, null,
];

export const seedLeads: Lead[] = rawLeads.map((l, i) => ({
  ...l,
  service: seedServices[i] ?? 'otro',
  mrr: seedMrr[i] ?? 0,
  script: '',
  nextActionAt: seedNextActionAt[i] ?? null,
  touch: seedTouch[i] ?? 0,
}));

// ---- Contacts (stakeholders per account) -----------------------------------
export const seedContacts: Contact[] = [
  { id: 'ct1', leadId: 'lead-7', name: 'Roberto Díaz', role: 'Director Comercial',
    email: 'roberto@nova.com', phone: '+52 81 7890 1234', createdAt: ago(20) },
  { id: 'ct2', leadId: 'lead-7', name: 'Laura Méndez', role: 'CTO',
    email: 'laura@nova.com', phone: '+52 81 7890 9999', createdAt: ago(3) },
  { id: 'ct3', leadId: 'lead-8', name: 'Elena Torres', role: 'Coordinadora',
    email: 'elena@idiomasglobal.com', phone: '+52 55 8901 2345', createdAt: ago(18) },
  { id: 'ct4', leadId: 'lead-8', name: 'Marco Ruiz', role: 'Director General',
    email: 'marco@idiomasglobal.com', phone: '+52 55 8901 0000', createdAt: ago(5) },
  { id: 'ct5', leadId: 'lead-5', name: 'Dr. Luis Peña', role: 'Director',
    email: 'luis@sonrisadental.com', phone: '+52 33 5678 9012', createdAt: ago(12) },
];

// ---- Comments (activity) ---------------------------------------------------
export const seedComments: Comment[] = [
  { id: 'c1', leadId: 'lead-5', authorId: U_DIEGO, type: 'comment',
    body: 'Respondió el DM, pidió más info sobre el sistema de citas. Le mando propuesta mañana.',
    createdAt: ago(2, 3) },
  { id: 'c2', leadId: 'lead-5', authorId: U_DIEGO, type: 'stage_change',
    body: 'Movió de En contacto a Demo enviada', createdAt: ago(2, 2) },
  { id: 'c3', leadId: 'lead-7', authorId: U_DIEGO, type: 'contact',
    body: 'Llamada de 20 min. Muy interesados, piden cotización formal.', createdAt: ago(3) },
  { id: 'c4', leadId: 'lead-7', authorId: U_DIEGO, type: 'comment',
    body: 'Presupuesto aprobado por su dirección. Agendamos reunión de cierre.', createdAt: ago(1, 4) },
  { id: 'c5', leadId: 'lead-9', authorId: U_LUCIA, type: 'meeting',
    body: 'Reunión agendada para presentar propuesta de menú digital.', createdAt: ago(1) },
  { id: 'c6', leadId: 'lead-11', authorId: U_SARA, type: 'stage_change',
    body: 'Cerrado como Cliente 🎉', createdAt: ago(10) },
  { id: 'c7', leadId: 'lead-6', authorId: U_LUCIA, type: 'comment',
    body: 'Le encantó el portafolio. Está evaluando presupuesto interno.', createdAt: ago(3) },
];

// ---- Tasks -----------------------------------------------------------------
const rawTasks: Omit<Task, 'recurring' | 'target' | 'progress' | 'periodKey'>[] = [
  { id: 't1', title: 'Contactar 10 empresas nuevas', notes: 'Sector restaurantes en CDMX', cadence: 'daily',
    done: false, assignedTo: U_LUCIA, leadId: null, dueDate: ahead(0), createdAt: ago(0), completedAt: null },
  { id: 't2', title: 'Responder DMs pendientes', notes: '', cadence: 'daily',
    done: true, assignedTo: U_LUCIA, leadId: null, dueDate: ahead(0), createdAt: ago(0), completedAt: ago(0, 2) },
  { id: 't3', title: 'Seguimiento de demos enviadas', notes: 'Aroma, Lumen', cadence: 'daily',
    done: false, assignedTo: U_LUCIA, leadId: 'lead-6', dueDate: ahead(0), createdAt: ago(0), completedAt: null },
  { id: 't4', title: 'Enviar 5 propuestas', notes: '', cadence: 'weekly',
    done: false, assignedTo: U_DIEGO, leadId: null, dueDate: ahead(3), createdAt: ago(2), completedAt: null },
  { id: 't5', title: 'Cerrar reunión con Constructora Nova', notes: '', cadence: 'weekly',
    done: false, assignedTo: U_DIEGO, leadId: 'lead-7', dueDate: ahead(3), createdAt: ago(1), completedAt: null },
  { id: 't6', title: 'Actualizar CRM con notas de la semana', notes: '', cadence: 'weekly',
    done: true, assignedTo: U_SARA, leadId: null, dueDate: ahead(1), createdAt: ago(2), completedAt: ago(1) },
  { id: 't7', title: 'Meta: 3 nuevos clientes cerrados', notes: 'Objetivo del mes', cadence: 'monthly',
    done: false, assignedTo: U_DIEGO, leadId: null, dueDate: ahead(20), createdAt: ago(5), completedAt: null },
  { id: 't8', title: 'Meta: 100 empresas contactadas', notes: '', cadence: 'monthly',
    done: false, assignedTo: U_LUCIA, leadId: null, dueDate: ahead(20), createdAt: ago(5), completedAt: null },
  { id: 't9', title: 'Contactar 8 empresas nuevas', notes: 'Sector salud', cadence: 'daily',
    done: false, assignedTo: U_DIEGO, leadId: null, dueDate: ahead(0), createdAt: ago(0), completedAt: null },
  { id: 't10', title: 'Reporte mensual de outreach', notes: 'Para revisión del fundador', cadence: 'monthly',
    done: false, assignedTo: U_SARA, leadId: null, dueDate: ahead(25), createdAt: ago(3), completedAt: null },
];

// A few of the seed tasks are recurring OBJECTIVES with a numeric target + partial
// progress this period, to show the progress bars & auto-reset in action.
const objectiveSeed: Record<string, { target: number; progress: number }> = {
  t1: { target: 10, progress: 6 }, // daily: contactar 10 empresas
  t9: { target: 8, progress: 3 }, // daily: contactar 8 empresas
  t4: { target: 5, progress: 2 }, // weekly: enviar 5 propuestas
  t7: { target: 3, progress: 1 }, // monthly: 3 clientes nuevos
  t8: { target: 100, progress: 42 }, // monthly: 100 empresas contactadas
};

export const seedTasks: Task[] = rawTasks.map((t) => {
  const o = objectiveSeed[t.id];
  return o
    ? { ...t, dueDate: null, recurring: true, target: o.target, progress: o.progress, periodKey: currentPeriodKey(t.cadence) }
    : { ...t, recurring: false, target: 0, progress: 0, periodKey: null };
});

// ---- Roadmap Zerion (Guía Diaria V1) ---------------------------------------
// El módulo arranca YA poblado: 82 días en cero, las 16 actividades del
// roadmap y la meta (metas mensuales + pitch + reserva). Clientes y caja
// arrancan vacíos (los llena Martín). En Supabase el servicio hace el
// auto-siembra equivalente en el primer load si el diario está vacío.
export const seedRoadmapDays = defaultDays();
export const seedRoadmapActivities = defaultActivities();
export const seedRoadmapMeta: RoadmapMeta[] = [defaultMeta()];
