import { describe, expect, it } from 'vitest';
import { leadOfferLine } from './leadService';

describe('leadOfferLine', () => {
  it('usa enrichment.offer (scoring dual) como señal autoritativa', () => {
    expect(leadOfferLine({ service: 'web', industry: 'clínica dental', enrichment: { offer: 'aaas' } })).toBe('aaas');
    expect(leadOfferLine({ service: 'aaas', industry: 'abogado', enrichment: { offer: 'web' } })).toBe('web');
  });

  it('respeta la etiqueta explícita del servicio', () => {
    expect(leadOfferLine({ service: 'aaas' })).toBe('aaas');
    expect(leadOfferLine({ service: 'web' })).toBe('web');
  });

  it('clasifica por nicho cuando no hay servicio explícito', () => {
    expect(leadOfferLine({ industry: 'clínica dental' })).toBe('aaas'); // aaas por catálogo
    expect(leadOfferLine({ industry: 'estudio jurídico' })).toBe('web'); // web por catálogo
  });

  it('nicho ambiguo (restaurante) cae a web por defecto', () => {
    expect(leadOfferLine({ industry: 'restaurante de comida italiana' })).toBe('web');
  });

  it('sin datos → web (guion por defecto)', () => {
    expect(leadOfferLine(undefined)).toBe('web');
    expect(leadOfferLine(null)).toBe('web');
    expect(leadOfferLine({})).toBe('web');
  });
});
