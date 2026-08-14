import { describe, it, expect } from 'vitest';
import { metaEventForStage } from './metaCapiService';
import type { Temperature } from '../types';

// El mapa etapa→evento es el contrato entre el CRM y la Conversions API. Este
// test lo fija: si alguien cambia el mapa sin querer, salta aquí. Debe quedar en
// sync con ALLOWED_EVENTS de supabase/functions/meta-capi/index.ts.
describe('metaEventForStage — mapa etapa CRM → evento Meta', () => {
  it('mapea las etapas del embudo que Meta optimiza', () => {
    expect(metaEventForStage('nuevo')).toBe('Lead');
    expect(metaEventForStage('demo-enviada')).toBe('QualifiedLead');
    expect(metaEventForStage('negociando')).toBe('QualifiedLead');
    expect(metaEventForStage('cliente')).toBe('Purchase');
  });

  it('NO reporta las etapas fuera del embudo optimizable', () => {
    expect(metaEventForStage('en-contacto')).toBeNull();
    expect(metaEventForStage('reactivacion')).toBeNull();
    expect(metaEventForStage('perdido')).toBeNull();
  });

  it('solo emite eventos de la allow-list de la Conversions API', () => {
    const allowed = new Set(['Lead', 'QualifiedLead', 'MeetingScheduled', 'Purchase']);
    const stages: Temperature[] = [
      'nuevo', 'en-contacto', 'demo-enviada', 'negociando', 'cliente', 'reactivacion', 'perdido',
    ];
    for (const s of stages) {
      const ev = metaEventForStage(s);
      if (ev !== null) expect(allowed.has(ev)).toBe(true);
    }
  });
});
