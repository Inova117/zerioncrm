import type { User, Credential, Lead, Contact, Comment, Task, Service } from '../types';

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

const rawLeads: Omit<Lead, 'service' | 'mrr'>[] = [
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
    temperature: 'frio', value: 4500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(6), updatedAt: ago(4), lastContactAt: ago(4), meetingAt: null,
  },
  {
    id: 'lead-4', company: 'EcoTienda Verde', contactName: 'Pablo Sánchez', role: 'Fundador',
    email: 'pablo@ecoverde.mx', phone: '+52 55 4567 8901', website: 'ecoverde.mx',
    industry: 'E-commerce', source: 'email', channel: 'Correo en frío',
    reason: 'Venden por WhatsApp, quieren una tienda online real.',
    temperature: 'frio', value: 5200, position: p(), assignedTo: U_SARA,
    createdAt: ago(8), updatedAt: ago(5), lastContactAt: ago(5), meetingAt: null,
  },
  {
    id: 'lead-5', company: 'Clínica Dental Sonrisa', contactName: 'Dr. Luis Peña', role: 'Director',
    email: 'luis@sonrisadental.com', phone: '+52 33 5678 9012', website: 'sonrisadental.com',
    industry: 'Salud', source: 'instagram', channel: 'Comentario + DM',
    reason: 'Quieren agenda de citas online y campañas de captación.',
    temperature: 'tibio', value: 7000, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(12), updatedAt: ago(2), lastContactAt: ago(2), meetingAt: null,
  },
  {
    id: 'lead-6', company: 'Boutique Lumen', contactName: 'Valeria Cruz', role: 'Dueña',
    email: 'valeria@lumen.mx', phone: '+52 55 6789 0123', website: 'lumen.mx',
    industry: 'Moda', source: 'referido', channel: 'Referido por Aroma',
    reason: 'Marca en crecimiento, quiere e-commerce + branding.',
    temperature: 'tibio', value: 8500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(15), updatedAt: ago(3), lastContactAt: ago(3), meetingAt: null,
  },
  {
    id: 'lead-7', company: 'Constructora Nova', contactName: 'Roberto Díaz', role: 'Director Comercial',
    email: 'roberto@nova.com', phone: '+52 81 7890 1234', website: 'novaconstruye.com',
    industry: 'Construcción', source: 'linkedin', channel: 'LinkedIn + llamada',
    reason: 'Proyecto grande de portal de propiedades. Presupuesto alto.',
    temperature: 'caliente', value: 15000, position: p(), assignedTo: U_DIEGO,
    createdAt: ago(20), updatedAt: ago(1), lastContactAt: ago(1), meetingAt: ahead(3),
  },
  {
    id: 'lead-8', company: 'Academia Idiomas Global', contactName: 'Elena Torres', role: 'Coordinadora',
    email: 'elena@idiomasglobal.com', phone: '+52 55 8901 2345', website: 'idiomasglobal.com',
    industry: 'Educación', source: 'web', channel: 'Formulario del sitio',
    reason: 'Plataforma de cursos online + pasarela de pago.',
    temperature: 'caliente', value: 11000, position: p(), assignedTo: U_SARA,
    createdAt: ago(18), updatedAt: ago(2), lastContactAt: ago(2), meetingAt: ahead(5),
  },
  {
    id: 'lead-9', company: 'Restaurante La Terraza', contactName: 'Miguel Ángel', role: 'Propietario',
    email: 'miguel@laterraza.mx', phone: '+52 33 9012 3456', website: 'laterraza.mx',
    industry: 'Restaurantes', source: 'evento', channel: 'Networking en expo',
    reason: 'Reunión agendada para propuesta de menú digital + reservas.',
    temperature: 'reunion', value: 6500, position: p(), assignedTo: U_LUCIA,
    createdAt: ago(25), updatedAt: ago(1), lastContactAt: ago(1), meetingAt: ahead(2),
  },
  {
    id: 'lead-10', company: 'TechStart Solutions', contactName: 'Andrea López', role: 'CEO',
    email: 'andrea@techstart.io', phone: '+52 55 0123 4567', website: 'techstart.io',
    industry: 'Tecnología', source: 'linkedin', channel: 'LinkedIn',
    reason: 'Startup que necesita landing + dashboard. Reunión de descubrimiento hecha.',
    temperature: 'reunion', value: 9800, position: p(), assignedTo: U_DIEGO,
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
];

// Tag each seed lead with an agency service line + a few retainers (MRR).
const seedServices: Service[] = [
  'web', 'app', 'ecommerce', 'ecommerce', 'app', 'branding', 'app', 'app',
  'web', 'app', 'ecommerce', 'ecommerce', 'mantenimiento',
];
const seedMrr = [0, 0, 0, 0, 1500, 0, 0, 2500, 0, 3000, 1200, 800, 0];

export const seedLeads: Lead[] = rawLeads.map((l, i) => ({
  ...l,
  service: seedServices[i] ?? 'otro',
  mrr: seedMrr[i] ?? 0,
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
    body: 'Movió de Frío a Tibio', createdAt: ago(2, 2) },
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
export const seedTasks: Task[] = [
  { id: 't1', title: 'Contactar 10 empresas nuevas', notes: 'Sector restaurantes en CDMX', cadence: 'daily',
    done: false, assignedTo: U_LUCIA, leadId: null, dueDate: ahead(0), createdAt: ago(0), completedAt: null },
  { id: 't2', title: 'Responder DMs pendientes', notes: '', cadence: 'daily',
    done: true, assignedTo: U_LUCIA, leadId: null, dueDate: ahead(0), createdAt: ago(0), completedAt: ago(0, 2) },
  { id: 't3', title: 'Seguimiento a leads tibios', notes: 'Aroma, Lumen', cadence: 'daily',
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
