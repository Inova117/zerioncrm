// ============================================================================
// LA APERTURA — fuente ÚNICA de los guiones A/B.
//
// Antes vivía en 5 copias con redacciones ligeramente distintas (apertura.ts,
// momentos.ts, sistema.ts, el mock de copilotService y el spec del edge) y el
// A/B test se contaminaba. Ahora los guiones canónicos y sus specs para el LLM
// viven AQUÍ; todos los demás los importan, y el edge recibe los suyos
// generados por npm run sync:playbook (jamás editar la copia generada).
// ============================================================================

/** Guion canónico de la APERTURA A — HONESTIDAD RADICAL ASUNTIVA (v1.2). */
export const APERTURA_A_GUION =
  '"¡[Don/Doña|Doctora] [nombre]! ¿Cómo le va? … Martín, de ZerionStudio, aquí en [ciudad]. Le soy honesto de entrada: esta es una llamada de ventas — y aun así le va a interesar, porque ya hicimos algo para su negocio: su página web ya está hecha. ¿Sabía que cuando buscan [rubro] en Google, usted no aparece?"';

/** Guion canónico corrido de la APERTURA B — LA MAESTRA (los 4 tiempos, de un tirón). */
export const APERTURA_B_GUION =
  '"¡Don [nombre]! ¿Cómo le va, cómo le ha ido? … [PAUSA REAL hasta que responda] … No me conoce todavía — soy Martín, de ZerionStudio, aquí de [ciudad]. Y lo llamo a USTED por algo puntual: estoy llamando solo a los [rubro] mejor calificados de [ciudad] — y con [4.9] estrellas y [169] reseñas, ustedes están en esa lista. Justo por eso me llamó la atención: cuando alguien busca \'[rubro] en [ciudad]\', usted no aparece. Aparece su competencia. ¿Usted sabía eso?"';

/** Spec de la A para el briefing del LLM (el edge recibe esto vía sync:playbook). */
export const APERTURA_A_LLM_SPEC =
  'la APERTURA A — HONESTIDAD RADICAL ASUNTIVA del playbook: gancho asuntivo ("¡Don/Doña [nombre]! ¿Cómo le va?" — JAMÁS "¿hablo con…?") + "Martín, de ZerionStudio" + "Le soy honesto de entrada: esta es una llamada de ventas — y aun así le va a interesar, porque su página web ya está hecha" + remate con SU dato en pregunta ("¿Sabía que cuando buscan [rubro] en Google usted no aparece?"). PROHIBIDO pedir permiso ("¿me da medio minutito?") — adaptada con los datos REALES de la ficha (registro formal si es profesional/clínica)';

/** Spec de la B para el briefing del LLM (el edge recibe esto vía sync:playbook). */
export const APERTURA_B_LLM_SPEC =
  'la APERTURA B — LA MAESTRA del playbook, con los datos REALES de la ficha: gancho de conocido con pausa ("¡Don/Doña [nombre]! ¿Cómo le va?…"), la confesión ("no me conoce todavía — soy Martín, de ZerionStudio"), la razón ENMARCADA EN ESTATUS (el cumplido desde arriba: "estoy llamando solo a los [rubro] mejor calificados de [ciudad] — y con [SUS estrellas] y [SUS reseñas], ustedes están en esa lista") y luego el hueco ("…y aun así, cuando buscan [rubro] en [ciudad], no aparecen") y el remate "¿usted sabía eso?". DOS REGLAS DURAS: (1) el encuadre de estatus SOLO si la ficha confirma calificación ALTA — si el rating es bajo o no está en la ficha, NO lo digas (mentir el estatus = estafador); usa el ángulo del competidor. (2) El contraste va con "Y", JAMÁS con "pero" ("buenísimas reseñas… Y aun así no aparece" — nunca "…pero no aparece"): el "pero" borra el cumplido y te pone en contra. PROHIBIDO rematarla pidiendo permiso';

/** El opener interpolado del modo mock (sin LLM) — misma redacción, datos reales. */
export function aperturaGuionMock(
  variant: 'A' | 'B',
  d: { nombre: string; estatus?: string; sinWeb?: boolean }
): string {
  if (variant === 'A')
    return `"¡${d.nombre}! ¿Cómo le va? … Martín, de ZerionStudio. Le soy honesto de entrada: esta es una llamada de ventas — y aun así le va a interesar, porque su página web ya está hecha. ¿Sabía que cuando lo buscan en Google usted no aparece?"`;
  return `"¡${d.nombre}! ¿Cómo le va? … No me conoce todavía — soy Martín, de ZerionStudio. Y le llamo por algo puntual: ${d.estatus}. Y justo por eso me llamó la atención${d.sinWeb ? ': cuando lo buscan en Google, usted no aparece' : ' lo que vi'}. ¿Usted sabía eso?"`;
}
