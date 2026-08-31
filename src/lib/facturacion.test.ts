// ============================================================================
// Tests de facturación por proxy (pura).
// ============================================================================
import { describe, expect, it } from 'vitest';
import {
  facturaScore,
  nivelFacturacion,
  nSenales,
  huecoScore,
  senalesDetalle,
  scoreProspecto,
} from './facturacion';
import type { ProspectoSenales, ProspectoTechnical } from '../types';

describe('facturaScore', () => {
  it('devuelve null sin señales (no podemos opinar)', () => {
    expect(facturaScore(undefined)).toBeNull();
    expect(facturaScore({})).toBeNull();
  });

  it('promedia las señales disponibles', () => {
    // empleados 9 → 60
    expect(facturaScore({ empleados: 9 })).toBe(60);
  });

  it('clientes altos (colegio 1160 alumnos) puntúa muy alto', () => {
    expect(facturaScore({ clientes: 1160, antiguedad: 22 })).toBe(90);
  });
});

describe('nivelFacturacion', () => {
  it('sin señales → sin-datos', () => {
    expect(nivelFacturacion(undefined)).toBe('sin-datos');
    expect(nivelFacturacion({})).toBe('sin-datos');
  });

  it('una señal dominante alcanza sostiene (4 sedes)', () => {
    expect(nivelFacturacion({ sucursales: 4 })).toBe('sostiene');
    expect(nivelFacturacion({ clientes: 500 })).toBe('sostiene');
  });

  it('2+ señales sostienen (Terranova: clientes + antigüedad)', () => {
    expect(nivelFacturacion({ clientes: 1160, antiguedad: 22 })).toBe('sostiene');
  });

  it('una señal alta PERO no dominante queda en probable (solo antigüedad)', () => {
    // 41 años = 80 pts, pero solo antigüedad no prueba escala → probable
    expect(nivelFacturacion({ antiguedad: 41 })).toBe('probable');
  });

  it('empleados medios → probable (9 empleados)', () => {
    expect(nivelFacturacion({ empleados: 9 })).toBe('probable');
  });

  it('negocio chico → no (1 empleado)', () => {
    expect(nivelFacturacion({ empleados: 1 })).toBe('no');
  });
});

describe('nSenales / senalesDetalle', () => {
  it('cuenta y describe las señales informadas', () => {
    const s: ProspectoSenales = { empleados: 9, sucursales: 4 };
    expect(nSenales(s)).toBe(2);
    expect(senalesDetalle(s)).toEqual(['9 empleados', '4 sedes']);
  });
  it('0 señales conundefined', () => {
    expect(nSenales(undefined)).toBe(0);
    expect(senalesDetalle(undefined)).toEqual([]);
  });
});

describe('huecoScore', () => {
  const tech = (t: Partial<ProspectoTechnical>): ProspectoTechnical => ({
    accessible: true, https: true, hasMetaDescription: true, hasViewport: true, stack: [], ...t,
  });
  it('null sin technical', () => {
    expect(huecoScore(null)).toBeNull();
  });
  it('sin hueco → 0', () => {
    expect(huecoScore(tech({}))).toBe(0);
  });
  it('web bloqueada + sin SEO + sin responsive → 85', () => {
    expect(huecoScore(tech({ accessible: false, hasMetaDescription: false, hasViewport: false }))).toBe(85);
  });
});

describe('scoreProspecto', () => {
  it('desconocido por ambos lados cae a neutro (~50) sin contacto', () => {
    const s = scoreProspecto(undefined, null, false);
    // 0.4*40 + 0.35*40 + 0.25*30 = 16 + 14 + 7.5 = 37.5 → 38
    expect(s).toBe(38);
  });
  it('con reseñas (factura alta) + hueco + contacto sube', () => {
    const s = scoreProspecto(
      { resenas: 300 },
      { accessible: false, https: true, hasMetaDescription: false, hasViewport: false, stack: [] },
      true
    );
    // factura = ptsResenas(300)=80, hueco = 85, reach = 80
    // 0.4*80 + 0.35*85 + 0.25*80 = 32 + 29.75 + 20 = 81.75 → 82
    expect(s).toBe(82);
  });
});