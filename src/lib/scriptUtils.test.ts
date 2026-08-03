// ============================================================================
// Tests del divisor de pasos del guion por prospecto (Sales Copilot).
// ============================================================================
import { describe, expect, it } from 'vitest';
import { splitScriptSteps } from './scriptUtils';

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
