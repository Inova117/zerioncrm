// ============================================================================
// Tests del reporte sin transcripción — la encuesta del vendedor reemplaza al
// LLM cuando la escucha falló. El desenlace debe mapear EXACTO a la rúbrica
// del summary por LLM (la temperatura alimenta el Kanban y el dashboard).
// ============================================================================
import { describe, expect, it } from 'vitest';
import { summarizeFromSurvey } from './copilotService';
import type { CallSurveyAnswers, Lead } from '../types';

const lead: Lead = {
  id: 'lead-test',
  company: 'Cafetería Prueba',
  contactName: 'Marta',
  role: 'Dueña',
  email: '',
  phone: '',
  website: '',
  industry: 'Restaurantes',
  source: 'otro',
  channel: '',
  reason: '',
  script: '',
  temperature: 'tibio',
  service: 'web',
  value: 0,
  mrr: 0,
  position: 0,
  assignedTo: 'usr-1',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
  lastContactAt: null,
  meetingAt: null,
};

const survey = (over: Partial<CallSurveyAnswers>): CallSurveyAnswers => ({
  resultado: 'contacto',
  objecion: '',
  oferta: 'si',
  hora: 'amarrada',
  desenlace: 'caliente',
  ...over,
});

describe('summarizeFromSurvey', () => {
  it('desenlace cliente → temperature cliente y nextAction de entrega', () => {
    const s = summarizeFromSurvey(survey({ desenlace: 'cliente' }), lead);
    expect(s.temperature).toBe('cliente');
    expect(s.nextAction).toContain('Publicar la página HOY');
    expect(s.summary).toContain('Cerré — pago confirmado');
  });

  it('desenlace caliente → temperature caliente y link por WhatsApp', () => {
    const s = summarizeFromSurvey(survey({ desenlace: 'caliente' }), lead);
    expect(s.temperature).toBe('caliente');
    expect(s.nextAction).toContain('Enviar el link de la página');
  });

  it('desenlace no-acepto → reactivación 90 días (demo muerta)', () => {
    const s = summarizeFromSurvey(survey({ desenlace: 'no-acepto', hora: 'no' }), lead);
    expect(s.temperature).toBe('no-acepto');
    expect(s.nextAction).toContain('reactivar en 90 días');
    expect(s.summary).toContain('No aceptó ver la página.');
  });

  it('desenlace perdido → temperature perdido', () => {
    const s = summarizeFromSurvey(survey({ desenlace: 'perdido' }), lead);
    expect(s.temperature).toBe('perdido');
    expect(s.nextAction).toContain('90 días');
  });

  it('sin desenlace → cae a la temperatura actual del lead (no inventa)', () => {
    const s = summarizeFromSurvey(survey({ desenlace: '' }), lead);
    expect(s.temperature).toBe('tibio');
    expect(s.nextAction).toBe('');
  });

  it('refleja la objeción reportada con su etiqueta legible', () => {
    const s = summarizeFromSurvey(survey({ objecion: 'caro' }), lead);
    expect(s.summary).toContain('Está caro / no hay presupuesto');
  });

  it('sin objeción lo dice explícitamente', () => {
    const s = summarizeFromSurvey(survey({}), lead);
    expect(s.summary).toContain('Sin objeción registrada.');
  });

  it('oferta no presentada y hora sin amarrar', () => {
    const s = summarizeFromSurvey(survey({ oferta: 'no', hora: 'sin-hora' }), lead);
    expect(s.summary).toContain('No llegó a presentar la oferta.');
    expect(s.summary).toContain('Aceptó ver la página, pero sin hora.');
  });

  it('marca el origen manual (sin transcripción)', () => {
    const s = summarizeFromSurvey(survey({}), lead);
    expect(s.summary).toContain('sin transcripción');
  });
});
