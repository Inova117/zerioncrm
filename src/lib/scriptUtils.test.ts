// ============================================================================
// Tests del divisor de pasos del guion por prospecto (Sales Copilot).
// ============================================================================
import { describe, expect, it } from 'vitest';
import { splitScriptSteps, saludoNombre, fillLeadVars } from './scriptUtils';

describe('splitScriptSteps', () => {
  it('texto vacío o solo espacios → []', () => {
    expect(splitScriptSteps('')).toEqual([]);
    expect(splitScriptSteps('   \n  ')).toEqual([]);
  });

  it('bloques separados por línea en blanco → un paso por bloque', () => {
    const s = '1. Apertura: "¿Cómo le va?"\n\n2. Dolor: "¿Cuántos clientes pierde?"\n\n3. Cierre: "¿A qué hora la ve?"';
    expect(splitScriptSteps(s)).toHaveLength(3);
    expect(splitScriptSteps(s)[0]).toContain('Apertura');
    expect(splitScriptSteps(s)[2]).toContain('Cierre');
  });

  it('sin líneas en blanco → un paso por línea', () => {
    const s = 'Apertura: hola\nPregunta: ¿cómo le llegan?\nCierre: ¿a qué hora?';
    const steps = splitScriptSteps(s);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toBe('Apertura: hola');
  });

  it('normaliza CRLF y recorta líneas', () => {
    const s = '  Paso uno  \r\n  Paso dos  \r\n';
    expect(splitScriptSteps(s)).toEqual(['Paso uno', 'Paso dos']);
  });

  it('bloque único con párrafo largo → una sola línea como paso', () => {
    const s = 'Este es un guion de una sola línea sin saltos.';
    expect(splitScriptSteps(s)).toEqual([s]);
  });

  it('no deja pasos vacíos entre bloques con varios saltos', () => {
    const s = 'Uno\n\n\n\nDos';
    expect(splitScriptSteps(s)).toEqual(['Uno', 'Dos']);
  });
});

describe('saludoNombre', () => {
  it('nombre femenino → Doña (heurística por terminación en "a")', () => {
    expect(saludoNombre('Marta Ruiz')).toBe('Doña Marta');
    expect(saludoNombre('Ana')).toBe('Doña Ana');
  });

  it('nombre masculino → Don', () => {
    expect(saludoNombre('Juan Pérez')).toBe('Don Juan');
    expect(saludoNombre('Carlos')).toBe('Don Carlos');
  });

  it('sin nombre → "Buenas" (nunca un Don/Doña a secas)', () => {
    expect(saludoNombre('')).toBe('Buenas');
    expect(saludoNombre('   ')).toBe('Buenas');
    expect(saludoNombre(undefined)).toBe('Buenas');
  });
});

describe('fillLeadVars', () => {
  const lead = {
    company: 'Cafetería Aroma',
    contactName: 'Marta Ruiz',
    industry: 'Restaurantes',
    enrichment: { city: 'Quito' },
  };

  it('resuelve [SALUDO] y [NOMBRE] con los datos del prospecto', () => {
    expect(fillLeadVars('"¡[SALUDO]! ¿Cómo le va? … Soy [NOMBRE]."', lead)).toBe(
      '"¡Doña Marta! ¿Cómo le va? … Soy Marta, de ZerionStudio."'
    );
  });

  it('resuelve [rubro], [CIUDAD] y [EMPRESA]', () => {
    const out = fillLeadVars('buscan [rubro] en Google — en [CIUDAD], [EMPRESA] no sale', lead);
    expect(out).toBe('buscan restaurantes en Google — en Quito, Cafetería Aroma no sale');
  });

  it('sin datos usa fallbacks que suenan naturales hablados', () => {
    expect(fillLeadVars('"¡[SALUDO]! … Soy [NOMBRE]."', null)).toBe('"¡Buenas! … Soy de ZerionStudio."');
    expect(fillLeadVars('buscan [rubro] en Google — en [CIUDAD], [EMPRESA]', {})).toBe(
      'buscan negocios como el suyo en Google — en su zona, su negocio'
    );
  });

  it('deja intacto el texto sin variables', () => {
    expect(fillLeadVars('Hola, ¿cómo le va?', lead)).toBe('Hola, ¿cómo le va?');
  });
});
