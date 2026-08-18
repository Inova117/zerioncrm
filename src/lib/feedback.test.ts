import { describe, expect, it } from 'vitest';
import { nichePerformance, topNiches } from './feedback';
import type { CallSurveyAnswers, Lead } from '../types';

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', company: 'Clínica Dental', contactName: '', role: '', email: '', phone: '',
  website: '', industry: 'clínicas dentales', source: 'scraper', channel: '', reason: '',
  script: '', temperature: 'nuevo', service: 'web', value: 0, mrr: 0, position: 0,
  assignedTo: 'u1', createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z',
  lastContactAt: null, meetingAt: null, nextActionAt: null, touch: 0, enrichment: null,
  ...over,
});

const survey = (over: Partial<CallSurveyAnswers> = {}): CallSurveyAnswers => ({
  resultado: '', objecion: '', oferta: 'no', hora: 'no', desenlace: '', ...over,
});

describe('nichePerformance — arranque en frío (Laplace)', () => {
  it('sin leads → lista vacía', () => {
    expect(nichePerformance([], {})).toEqual([]);
  });

  it('tasas Laplace neutrales: 1 lead sin contactar', () => {
    const [p] = nichePerformance([lead({ temperature: 'nuevo' })], {});
    expect(p.leads).toBe(1);
    expect(p.contacted).toBe(0);
    expect(p.contactRate).toBeCloseTo(1 / 3); // (0+1)/(1+2)
    expect(p.demoRate).toBeCloseTo(0.5); // (0+1)/(0+2)
    expect(p.closeRate).toBeCloseTo(0.5); // (0+1)/(0+2)
  });

  it('1 cliente sube la prioridad sobre el neutral', () => {
    const [cliente] = nichePerformance([lead({ temperature: 'cliente' })], {});
    const [nuevo] = nichePerformance([lead({ temperature: 'nuevo' })], {});
    expect(cliente.closeRate).toBeCloseTo(2 / 3); // (1+1)/(1+2)
    expect(cliente.priority).toBeGreaterThan(nuevo.priority);
  });
});

describe('nichePerformance — objeciones', () => {
  it('objeción "ya tengo página" deprioriza el nicho (fit killer)', () => {
    const sinObj = nichePerformance([lead({ temperature: 'perdido' })], {});
    const conObj = nichePerformance(
      [lead({ temperature: 'perdido' })],
      { l1: survey({ objecion: 'ya-pagina' }) }
    );
    expect(conObj[0].priority).toBeLessThan(sinObj[0].priority);
    expect(conObj[0].objections['ya-pagina']).toBe(1);
  });

  it('resultado "no contestó" NO penaliza el nicho (señal de contacto, no de fit)', () => {
    const sin = nichePerformance([lead({ temperature: 'perdido' })], {});
    const con = nichePerformance(
      [lead({ temperature: 'perdido' })],
      { l1: survey({ resultado: 'no-contesto' }) }
    );
    expect(con[0].priority).toBeCloseTo(sin[0].priority);
  });
});

describe('nichePerformance — agrupación por nicho', () => {
  it('agrupa por nicho y resuelve el primary del catálogo', () => {
    const perf = nichePerformance(
      [
        lead({ id: 'a', industry: 'clínicas dentales', temperature: 'cliente' }),
        lead({ id: 'b', industry: 'abogados', temperature: 'nuevo' }),
      ],
      {}
    );
    const clinicas = perf.find((p) => p.primary === 'aaas');
    const abogados = perf.find((p) => p.primary === 'web');
    expect(clinicas).toBeTruthy();
    expect(clinicas!.leads).toBe(1);
    expect(abogados).toBeTruthy();
    expect(abogados!.leads).toBe(1);
  });
});

describe('topNiches', () => {
  it('ordena por prioridad descendente y corta a n', () => {
    const perf = nichePerformance(
      [
        lead({ id: 'a', industry: 'clínicas dentales', temperature: 'cliente' }),
        lead({ id: 'b', industry: 'abogados', temperature: 'nuevo' }),
        lead({ id: 'c', industry: 'abogados', temperature: 'perdido' }),
      ],
      {}
    );
    const top = topNiches(perf, 2);
    expect(top).toHaveLength(2);
    expect(top[0].priority).toBeGreaterThanOrEqual(top[1].priority);
  });
});
