// ============================================================================
// SALES SCRIPT — Prospección fría completa, demo-first
// ----------------------------------------------------------------------------
// Guion de prospección fría a negocios locales sin web, co-diseñado con el
// fundador (ago 2026). Metodología:
//   - APERTURA A/B: el paso 1 tiene DOS variantes (la prueba A/B). Cambia SOLO
//     el hook — el resto del guion (razón → agitación → oferta → cierre) es
//     idéntico. La variante usada en cada llamada se guarda en `outcome.apertura`
//     y el dashboard compara cuál convierte más. Toggle en el panel por lead/lote.
//   - A (rating): la observación de los DATOS del negocio (reseñas/rating) +
//     la sorpresa de que no tengan web. Cumplido por datos, no por halago.
//   - B (investigada + honesta): un dato específico que investigaste del negocio
//     + confesión honesta de que es llamada de ventas bien investigada.
//   - NEPQ-lite: la pregunta "¿por qué no tienen web?" saca la razón real (la
//     objeción antes de que exista) + agitación con el costo.
//   - Riesgo reverso: "no paga nada por verla; si no le gusta, la borro" —
//     nunca decir "ya está hecha" si no lo está (demo-first honesto).
//   - Calificación antes de producir: "¿si le encanta, se la quedaría?" — el sí
//     al compromiso se pide antes del trabajo.
//   - WhatsApp (LatAm): canal rey para la entrega y el seguimiento.
//
// Voz unificada en "usted" (mercado ecuatoriano — como habla el fundador).
// Los montos [PRECIO] / [MENSUAL] se resuelven SIEMPRE desde MIS PRECIOS
// (ajustes del copilot) — nunca inventar una cifra.
//
// Variables del prospecto (se resuelven en pantalla con los datos del lead,
// sin LLM — ver fillLeadVars en src/lib/scriptUtils.ts):
//   [SALUDO]   → "Doña Rosa" / "Don Juan" / "Buenas"
//   [NOMBRE]   → "Marta, de ZerionStudio" (auto-presentación)
//   [rubro]    → industria ("clínica dental", "peluquería"…)
//   [CIUDAD]   → ciudad del negocio
//   [EMPRESA]  → nombre del negocio (sin el sufijo " - Ciudad" del scraper)
//   [RESEÑAS]  → "35 reseñas" (del scraper) / "muy buenas reseñas"
//   [RATING]   → "4.6 estrellas" / "excelente calificación"
//   [SOCIALES] → "hasta Instagram" / "redes sociales"
// ============================================================================

export interface ScriptSection {
  id: string;
  step: string; // "1"
  title: string; // "Apertura"
  emoji: string; // "🎯"
  /** El QUÉ hacer (instrucción corta para el vendedor). */
  action: string;
  /** La frase EXACTA para decir (guion literal). */
  lines: string[];
}

/** APERTURA A — el rating que llama la atención (datos + sorpresa). */
const APERTURA_A: ScriptSection = {
  id: 'apertura',
  step: '1',
  title: 'Apertura A — el rating que llama la atención',
  emoji: '🎯',
  action: 'El cumplido son los DATOS, no el halago. Dilo como curiosidad genuina. Cuando responda la razón, entra a la oferta + beneficios + dudas.',
  lines: [
    '"Hola, ¿hablo con el/la encargado/a de [EMPRESA]? … Qué tal, le comento: andaba buscando negocios de [rubro] en [CIUDAD] y vi que ustedes tienen [RATING] con [RESEÑAS] — eso llama la atención."',
    '"Pero veo que no tienen página web. ¿Me permite preguntarles por qué no tienen una?"',
  ],
};

/** APERTURA B — la llamada fría bien investigada (dato específico + honestidad). */
const APERTURA_B: ScriptSection = {
  id: 'apertura',
  step: '1',
  title: 'Apertura B — la fría bien investigada',
  emoji: '🎯',
  action: 'INVESTIGA un dato específico del negocio antes de llamar (producto nuevo, enfoque, algo que destaque). Dilo con naturalidad y, ENSEGUIDA, confiesa que es llamada de ventas bien investigada y pide permiso para la oferta — sin vueltas.',
  lines: [
    '"Hola, ¿hablo con el/la encargado/a de [EMPRESA]? … Qué tal, le comento: [DATO — ej. vi que sacaron una línea nueva / vi que se enfocan en venta de comida para perros] — por eso me llamó la atención su negocio."',
    '"Le soy honesto: esta es una llamada de ventas, pero bien investigada. Sé que les puedo ayudar a subir sus ventas y su visibilidad en Google. ¿Le gustaría escucharla?"',
  ],
};

/** La apertura de la variante pedida (A o B). El resto del guion es común. */
export function aperturaPorVariant(v: 'A' | 'B'): ScriptSection {
  return v === 'B' ? APERTURA_B : APERTURA_A;
}

/** Los pasos 2-13 — comunes a ambas variantes (una sola variable: el hook). */
const PASOS_COMUNES: ScriptSection[] = [
  {
    id: 'razon',
    step: '2',
    title: 'La razón real (escucha y clasifica)',
    emoji: '🧭',
    action: 'NO interrumpa — su respuesta es la objeción antes de que exista. Clasifíquela y guarde sus palabras textuales.',
    lines: [
      '"No tengo tiempo" → no es prioridad → agite con el costo de no tenerla',
      '"Es muy caro" → miedo al precio → agite + gratis de ver (paso 4)',
      '"Mi sobrino me la iba a hacer" → quemado con promesas → valide + prueba gratis',
      '"No lo necesito" → no ve el problema → agite con los clientes que pierde',
      '"No sé de eso" → miedo a lo desconocido → "Yo hago todo — usted solo mira"',
    ],
  },
  {
    id: 'agitacion',
    step: '3',
    title: 'Agitación — el costo de no tenerla',
    emoji: '⏳',
    action: 'UNA pregunta. Después: SILENCIO. Que él ponga el número — el que habla primero, pierde.',
    lines: [
      '"Le entiendo. … Y una cosa más: ¿cuántos clientes cree que lo buscan en Google, ven sus reseñas, y se van con la competencia?"',
      '"¿Dos al mes? ¿Cinco? ¿Diez?"',
      '→ SILENCIO. Que él ponga el número.',
    ],
  },
  {
    id: 'propuesta',
    step: '4',
    title: 'La oferta — irresistible, corta',
    emoji: '💎',
    action: 'Mecanismo + entrega/precio + garantía. Tres frases, sin anclas ni listas — el precio se dice aquí, natural.',
    lines: [
      '"Mire, le propongo algo: su página web completa, con WhatsApp, Google Maps y una IA que responde a sus clientes 24/7."',
      '"Lista en 7 días, dominio y alojamiento incluidos, por [PRECIO] — un solo pago, todo incluido."',
      '"Y la ve terminada antes de pagar: si no le encanta, no paga nada. ¿Le parece justo?"',
    ],
  },
  {
    id: 'calificacion',
    step: '5',
    title: 'La calificación (LA pregunta de eficiencia)',
    emoji: '🔒',
    action: 'El precio ya está dicho — la pregunta ahora es solo de compromiso. Si dice no: no desarrolla nada — objeción real (paso 6).',
    lines: [
      '"Y para ser honestos: si le muestro la página terminada y le encanta, ¿se la quedaría?"',
      '→ SÍ: "¡Listo! La desarrollo esta semana y le escribo por WhatsApp con el link. ¿Este número tiene WhatsApp?"',
      '→ NO / dudas: objeción real (paso 6). Si se resuelve, vuelva al paso 4.',
    ],
  },
  {
    id: 'objeciones',
    step: '6',
    title: 'Objeciones (reflejos, no decisiones)',
    emoji: '🛡️',
    action: 'Acordar → aislar → responder → re-pedir. Máx. 2 vueltas — después cierre con elegancia.',
    lines: [
      '"No me interesa" → "Claro, entiendo. Solo una cosa: ¿qué hace hoy para que lo encuentren en Google?"',
      '"Está caro" → "Le entiendo. ¿Y cuánto se le va al mes por no aparecer? … La página cuesta menos que eso. Y la vio terminada antes de pagar — cero riesgo."',
      '"Mi sobrino/amigo me la hace gratis" → "Qué bueno que tenga quién le ayude. Mírela igual — se la armo sin costo y la ve terminada antes de pagar. Si lo de él es mejor, no me paga nada. Gana en los dos escenarios."',
      '"Mándame la info" → "Claro, la info es la página — se la armo y la ve terminada antes de pagar. ¿Me da su WhatsApp para enviársela?"',
      '"No tengo tiempo" → "Le entiendo. Solo mírela 2 minutos por WhatsApp cuando pueda. ¿Se la mando?"',
      '"Déjeme pensarlo" → "¿Es su forma amable de decirme que no? … ¿Qué fue lo que no le convenció: el precio, o que de verdad le traiga clientes?"',
    ],
  },
  {
    id: 'recepcion',
    step: '7',
    title: 'Recepcionista / empleado (gatekeeper)',
    emoji: '🚪',
    action: 'Su razón debe ser transmisible — el gatekeeper la repite. La palabra "ayudar" abre puertas. Nunca engañar.',
    lines: [
      '"Hola, ¿me podría ayudar? ¿El/la dueño/a está? Es sobre la presencia del negocio en Google."',
      '"¿Cuál es la mejor manera de que le llegue un mensaje — WhatsApp o que le llame a tal hora?"',
    ],
  },
  {
    id: 'entrega',
    step: '8',
    title: 'WhatsApp con la página (Toque 2)',
    emoji: '📲',
    action: 'Se envía el día de la entrega. Link + curiosidad dirigida + riesgo cero.',
    lines: [
      '"[SALUDO] 👋 ¡Su página está lista! Mírela aquí: [link]"',
      '"La armé con sus fotos y sus reseñas de Google. Mire la sección de [servicios/menú] — esa es la que más me gusta."',
      '"Gratis, no paga nada por verla. Si le gusta, conversamos; si no, la borro y no pasó nada. 👍"',
    ],
  },
  {
    id: 'cierre',
    step: '9',
    title: 'Follow-up + cierre (Toque 3, 24-48h)',
    emoji: '💵',
    action: 'Precio natural, sin drama: ya la vio, ya le gustó — es solo un dato. Si dice no: la página pasa al portafolio (máquina de demos).',
    lines: [
      'Si la vio: "¿La vio? … ¿Qué le pareció la sección de [servicios/menú]? … ¿Le gustó con sus fotos?"',
      'Si no respondió: "[SALUDO], ¿alcanzó a ver su página? Se la dejo aquí por si se perdió: [link]. Si no es buen momento, la dejo guardada."',
      '→ Cuando dijo que le gustó: "¡Qué bien! Se la dejo terminada y funcionando — todo incluido: WhatsApp, Google Maps, celular. Cuesta [PRECIO], un solo pago, sin letra chica. ¿Le parece bien?"',
      '→ NO definitivo: "Sin problema, de verdad. La dejo como ejemplo en nuestro portafolio, sin su nombre. Si algún día la necesita, aquí estoy." → marcar "No aceptó" en el CRM.',
    ],
  },
  {
    id: 'seguimiento',
    step: '10',
    title: 'Seguimiento (anti-ghosting)',
    emoji: '📆',
    action: 'Siempre con algo NUEVO. Nunca "¿ya lo pensó?". Cadencia: día 0, 2, 5, 9 — y STOP.',
    lines: [
      'Día 0: el mensaje de entrega del paso 8.',
      'Día 2: "¿Alcanzó a verla? Si quiere cambios, me escribe — se ajusta sin costo."',
      'Día 5: caso corto: "Un negocio de [rubro] en [CIUDAD] pasó de no aparecer a recibir X mensajes a la semana."',
      'Día 9: cierre suave: "Si no es buen momento, sin problema. La dejo guardada unos días — cuando quiera la retomamos. Aquí estoy." — STOP.',
    ],
  },
  {
    id: 'referidos',
    step: '11',
    title: 'Referidos (post-venta, dinero en efectivo)',
    emoji: '🎁',
    action: 'Solo después del pago, con la emoción arriba. 3 compras = devolución en efectivo. Nunca hosting gratis (ya viene incluido).',
    lines: [
      '"¡Felicidades! 🎉 … Oye, una pregunta solo para clientes: ¿conoce a 2-3 dueños como usted que no tengan página web?"',
      '"Por cada uno que contrate le voy sumando — y si me trae 3 que compren, le devuelvo los [PRECIO]. En efectivo."',
      '"Le mando un enlace para que se los pase directo. ¿Le parece justo?"',
    ],
  },
];

/** El guion completo de la variante pedida (apertura A o B + pasos comunes). */
export function salesScriptFrio(variant: 'A' | 'B'): ScriptSection[] {
  return [aperturaPorVariant(variant), ...PASOS_COMUNES];
}

/** Default: variante A (el guion por defecto cuando no se elige). */
export const SALES_SCRIPT_FRIO: ScriptSection[] = salesScriptFrio('A');

/** La objeción más probable según la etapa del lead (atajo para el panel). */
export const QUICK_OBJECTIONS = PASOS_COMUNES.find((s) => s.id === 'objeciones')!.lines;

/** Frase resumen del sistema (prospección fría + demo-first honesto). */
export const FRIO_PITCH_LINE =
  'No le venda una página: muéstrele la suya. El adelanto se ve antes de pagar y el riesgo siempre es cero. A/B: cambie solo la apertura, el resto del guion no.';
