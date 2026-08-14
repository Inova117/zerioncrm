import { describe, it, expect } from 'vitest';
import type { Lead } from '../types';
import {
  stageFollowUpPatch,
  advanceTouch,
  touchInfo,
  followUpBucket,
  normalizeLead,
  localAt,
  isoToLocalInput,
  localInputToIso,
  TOUCH_MAX_DEMO,
  ATTEMPT_MAX,
} from './followUp';
import { parseISO } from 'date-fns';

const NOW = new Date('2026-08-14T12:00:00');

/** Fecha local +N días a las 10:00 (mismo cálculo que localAt). */
const plusDays = (n: number): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
};

const lead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    company: 'Peluquería Héctor',
    contactName: 'Héctor',
    role: 'Dueño',
    email: '',
    phone: '+593 99 999 9999',
    website: '',
    industry: 'Peluquería',
    source: 'scraper',
    channel: '',
    reason: '',
    script: '',
    temperature: 'nuevo',
    service: 'web',
    value: 0,
    mrr: 0,
    position: 0,
    assignedTo: 'u1',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    lastContactAt: null,
    meetingAt: null,
    nextActionAt: null,
    touch: 0,
    ...over,
  }) as Lead;

describe('stageFollowUpPatch — reglas automáticas al mover de etapa', () => {
  it('demo-enviada arranca la secuencia mañana a las 10:00 (toque 1)', () => {
    const patch = stageFollowUpPatch(lead(), 'demo-enviada', NOW);
    expect(patch.touch).toBe(1);
    expect(parseISO(patch.nextActionAt!).getTime()).toBe(plusDays(1).getTime());
  });

  it('en-contacto y negociando reintentan en 2 días', () => {
    for (const stage of ['en-contacto', 'negociando'] as const) {
      const patch = stageFollowUpPatch(lead(), stage, NOW);
      expect(patch.touch).toBe(1);
      expect(parseISO(patch.nextActionAt!).getTime()).toBe(plusDays(2).getTime());
    }
  });

  it('reactivacion agenda el reheat a +30 días', () => {
    const patch = stageFollowUpPatch(lead(), 'reactivacion', NOW);
    expect(patch.touch).toBe(1);
    expect(parseISO(patch.nextActionAt!).getTime()).toBe(plusDays(30).getTime());
  });

  it('cliente / perdido / nuevo salen de la cola de seguimiento', () => {
    for (const stage of ['cliente', 'perdido', 'nuevo'] as const) {
      const patch = stageFollowUpPatch(lead({ temperature: 'demo-enviada' }), stage, NOW);
      expect(patch).toEqual({ touch: 0, nextActionAt: null });
    }
  });

  it('no cambia nada si la etapa no cambió', () => {
    expect(stageFollowUpPatch(lead({ temperature: 'nuevo' }), 'nuevo', NOW)).toEqual({});
  });
});

describe('advanceTouch — completar un toque avanza la secuencia', () => {
  it('demo: toque 1 → 2 en +1 día; toque 5 → 6 en +4 días', () => {
    const p1 = advanceTouch(lead({ temperature: 'demo-enviada', touch: 1 }), NOW);
    expect(p1.touch).toBe(2);
    expect(parseISO(p1.nextActionAt!).getTime()).toBe(plusDays(1).getTime());

    const p5 = advanceTouch(lead({ temperature: 'demo-enviada', touch: 5 }), NOW);
    expect(p5.touch).toBe(6);
    expect(parseISO(p5.nextActionAt!).getTime()).toBe(plusDays(4).getTime());
  });

  it('demo: completar el toque 6 mueve a reactivacion', () => {
    const p = advanceTouch(lead({ temperature: 'demo-enviada', touch: 6 }), NOW);
    expect(p).toEqual({ temperature: 'reactivacion' });
  });

  it('reactivacion: 1→2 en +30 días y el tercero agota la cola', () => {
    const p1 = advanceTouch(lead({ temperature: 'reactivacion', touch: 1 }), NOW);
    expect(p1.touch).toBe(2);
    expect(parseISO(p1.nextActionAt!).getTime()).toBe(plusDays(30).getTime());

    const p3 = advanceTouch(lead({ temperature: 'reactivacion', touch: 3 }), NOW);
    expect(p3).toEqual({ touch: 3, nextActionAt: null });
  });

  it('en-contacto: intentos se topan en 3', () => {
    const p = advanceTouch(lead({ temperature: 'en-contacto', touch: 2 }), NOW);
    expect(p.touch).toBe(ATTEMPT_MAX);
    const p3 = advanceTouch(lead({ temperature: 'en-contacto', touch: 3 }), NOW);
    expect(p3.touch).toBe(3);
    expect(p3.nextActionAt).not.toBeNull();
  });

  it('etapas sin secuencia no avanzan nada', () => {
    expect(advanceTouch(lead(), NOW)).toEqual({});
    expect(advanceTouch(lead({ temperature: 'cliente' }), NOW)).toEqual({});
  });
});

describe('touchInfo — qué toque toca ahora', () => {
  it('demo-enviada clamp-a 1..6', () => {
    const t0 = touchInfo(lead({ temperature: 'demo-enviada', touch: 0 }));
    expect(t0?.touch).toBe(1);
    expect(t0?.label).toContain('Día 1');
    const t6 = touchInfo(lead({ temperature: 'demo-enviada', touch: 9 }));
    expect(t6?.touch).toBe(TOUCH_MAX_DEMO);
    expect(t6?.label).toContain('Día 14');
  });

  it('negociando devuelve seguimiento genérico; nuevo/cliente/perdido → null', () => {
    expect(touchInfo(lead({ temperature: 'negociando' }))?.label).toContain('negociación');
    expect(touchInfo(lead())).toBeNull();
    expect(touchInfo(lead({ temperature: 'cliente' }))).toBeNull();
    expect(touchInfo(lead({ temperature: 'perdido' }))).toBeNull();
  });
});

describe('followUpBucket — cubos de la vista HOY', () => {
  const yesterday = new Date(NOW);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(NOW);
  tomorrow.setDate(tomorrow.getDate() + 1);

  it('null → fuera de la cola; ayer → overdue; hoy → today; mañana → upcoming', () => {
    expect(followUpBucket(null, NOW)).toBeNull();
    expect(followUpBucket(yesterday.toISOString(), NOW)).toBe('overdue');
    expect(followUpBucket(NOW.toISOString(), NOW)).toBe('today');
    expect(followUpBucket(tomorrow.toISOString(), NOW)).toBe('upcoming');
  });
});

describe('normalizeLead — datos viejos se re-mapean al pipeline v2', () => {
  it('etapas legacy → nuevas y campos con defaults', () => {
    const n = normalizeLead({ temperature: 'frio' } as unknown as Partial<Lead>);
    expect(n.temperature).toBe('en-contacto');
    expect(n.touch).toBe(0);
    expect(n.nextActionAt).toBeNull();
  });

  it('valores válidos se conservan', () => {
    const n = normalizeLead({ temperature: 'demo-enviada', touch: 3, nextActionAt: 'x' } as unknown as Partial<Lead>);
    expect(n.temperature).toBe('demo-enviada');
    expect(n.touch).toBe(3);
    expect(n.nextActionAt).toBe('x');
  });
});

describe('isoToLocalInput / localInputToIso', () => {
  it('redondean ISO ↔ datetime-local (minutos 0)', () => {
    const iso = localAt(0, 10, NOW);
    const input = isoToLocalInput(iso);
    expect(input).toMatch(/^\d{4}-\d{2}-\d{2}T10:00$/);
    expect(localInputToIso(input)).toBe(iso);
    expect(localInputToIso('')).toBeNull();
    expect(isoToLocalInput(null)).toBe('');
  });
});
