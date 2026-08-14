// ============================================================================
// SALES SCRIPT — Llamada en frío (Guion de venta completo, demo-first)
// ----------------------------------------------------------------------------
// Guion de prospección fría a negocios locales sin web, co-diseñado con el
// fundador (ago 2026) y espejo del documento de entrenamiento
// (~/ZerionStudio/ads-web-300/guion-venta-frio.pdf). Metodología:
//   - Voz Hormozi: frases cortas, honestidad frontal, el cumplido son los DATOS
//     (no el halago). Sin formalidades de call center, sin muletillas.
//   - Pattern interruption: la sorpresa genuina — "¿por qué un negocio con ese
//     nivel no tiene web?" — desarma mejor que cualquier apertura genérica.
//   - NEPQ-lite: la pregunta "¿por qué no tienes web?" saca la razón real (la
//     objeción antes de que exista) + agitación con el costo.
//   - Riesgo reverso: "no pagas nada por verla; si no te gusta, la borro" —
//     nunca decir "ya está hecha" si no lo está (demo-first honesto).
//   - Calificación antes de producir: "¿si te encanta, te la quedarías?" — el
//     sí al compromiso se pide antes del trabajo.
//   - WhatsApp (LatAm): canal rey para la entrega y el seguimiento.
//
// Voz unificada en "tú" (como el documento de entrenamiento y el método del
// fundador). Los montos [PRECIO] / [MENSUAL] se resuelven SIEMPRE desde MIS
// PRECIOS (ajustes del copilot) — nunca inventar una cifra.
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

export const SALES_SCRIPT_FRIO: ScriptSection[] = [
  {
    id: 'apertura',
    step: '1',
    title: 'Apertura — la sorpresa',
    emoji: '🎯',
    action: 'El cumplido son los DATOS, no el halago. Dilo como curiosidad genuina, no como plantilla. Después de la pregunta: CALLA.',
    lines: [
      '"¿Eres el dueño? … [SALUDO], te hablo de ZerionStudio."',
      '"Mira, te seré honesto: te llamo porque vi tu negocio en Google — [RESEÑAS], [RATING] — y no tienes página web."',
      '"Y me quedé pensando: ¿por qué un negocio con ese nivel no tiene página web? Dime, ¿por qué no tienes una?"',
    ],
  },
  {
    id: 'razon',
    step: '2',
    title: 'La razón real (escucha y clasifica)',
    emoji: '🧭',
    action: 'NO interrumpas — su respuesta es la objeción antes de que exista. Clasifícala y guarda sus palabras textuales.',
    lines: [
      '"No tengo tiempo" → no es prioridad → agita con el costo de no tenerla',
      '"Es muy caro" → miedo al precio → agita + gratis de ver (paso 4)',
      '"Mi sobrino me la iba a hacer" → quemado con promesas → valida + prueba gratis',
      '"No lo necesito" → no ve el problema → agita con los clientes que pierde',
      '"No sé de eso" → miedo a lo desconocido → "Yo hago todo — tú solo miras"',
    ],
  },
  {
    id: 'agitacion',
    step: '3',
    title: 'Agitación — el costo de no tenerla',
    emoji: '⏳',
    action: 'UNA pregunta. Después: SILENCIO. Que él ponga el número — el que habla primero, pierde.',
    lines: [
      '"Te entiendo. … Oye, y una cosa: ¿cuántos clientes crees que te buscan en Google, ven tus reseñas, y se van con la competencia?"',
      '"¿Dos al mes? ¿Cinco? ¿Diez?"',
      '→ SILENCIO. Que él ponga el número.',
    ],
  },
  {
    id: 'propuesta',
    step: '4',
    title: 'La propuesta (cero riesgo)',
    emoji: '🤝',
    action: 'Gratis de ver, se borra si no gusta. Sin precio todavía.',
    lines: [
      '"Mira, te propongo algo sin riesgo: te hago tu página web y no pagas nada por verla. Es gratis."',
      '"Si te encanta, seguimos. Si no, la borro y aquí no pasó nada. ¿Te parece justo?"',
    ],
  },
  {
    id: 'calificacion',
    step: '5',
    title: 'La calificación (LA pregunta de eficiencia)',
    emoji: '🔒',
    action: 'El sí al compromiso se pide ANTES del trabajo. Si dice no: no desarrollas nada — objeción real (paso 6).',
    lines: [
      '"Y para ser honestos los dos: si te la muestro terminada en tu celular y te encanta, ¿te la quedarías? No te digo cuánto cuesta todavía."',
      '→ SÍ: "¡Listo! La desarrollo esta semana y te escribo por WhatsApp con el link. ¿Este número tiene WhatsApp?"',
      '→ NO / dudas: objeción real (paso 6). Si se resuelve, vuelve al paso 4.',
    ],
  },
  {
    id: 'objeciones',
    step: '6',
    title: 'Objeciones (reflejos, no decisiones)',
    emoji: '🛡️',
    action: 'Acordar → aislar → responder → re-pedir. Máx. 2 vueltas — después cierra con elegancia.',
    lines: [
      '"No me interesa" → "Claro, entiendo. Solo una cosa: ¿qué haces hoy para que te encuentren en Google?"',
      '"Está caro" → "Te entiendo. ¿Y cuánto se te va al mes por no aparecer? … La página cuesta menos que eso. Y la viste terminada antes de pagar — cero riesgo."',
      '"Mi sobrino/amigo me la hace gratis" → "Qué bueno que tengas quién te ayude. Mírala igual — es gratis y ya está con tus fotos. Si lo de él es mejor, no me pagas nada. Ganas en los dos escenarios."',
      '"Mándame la info" → "La info es la página — ya está lista. Mírala y me dices: ¿te gustó o no?"',
      '"No tengo tiempo" → "Te entiendo. Solo mírala 2 minutos por WhatsApp cuando puedas. ¿Te la mando?"',
      '"Déjame pensarlo" → "¿Es tu forma amable de decirme que no? … ¿Qué fue lo que no te convenció: el precio, o que de verdad te traiga clientes?"',
    ],
  },
  {
    id: 'recepcion',
    step: '7',
    title: 'Recepcionista / empleado (gatekeeper)',
    emoji: '🚪',
    action: 'Tu razón debe ser transmisible — el gatekeeper la repite. La palabra "ayudar" abre puertas. Nunca engañar.',
    lines: [
      '"Hola, ¿me podrías ayudar? ¿El/la dueño/a está? Es sobre la presencia del negocio en Google."',
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
      '"[SALUDO] 👋 ¡Tu página está lista! Mírala aquí: [link]"',
      '"La armé con tus fotos y tus reseñas de Google. Mira la sección de [servicios/menú] — esa es la que más me gusta."',
      '"Gratis, no pagas nada por verla. Si te gusta, conversamos; si no, la borro y no pasó nada. 👍"',
    ],
  },
  {
    id: 'cierre',
    step: '9',
    title: 'Follow-up + cierre (Toque 3, 24-48h)',
    emoji: '💵',
    action: 'Precio natural, sin drama: ya la vio, ya le gustó — es solo un dato. Si dice no: la página pasa al portafolio (máquina de demos).',
    lines: [
      'Si vio el link: "¿La viste? … ¿Qué te pareció la sección de [servicios/menú]? … ¿Te gustó con tus fotos?"',
      'Si no respondió: "[SALUDO], ¿alcanzaste a ver tu página? Te la dejo aquí por si se perdió: [link]. Si no es buen momento, la dejo guardada."',
      '→ Cuando dijo que le gustó: "¡Qué bien! Te la dejo terminada y funcionando — todo incluido: WhatsApp, Google Maps, celular. Cuesta [PRECIO], un solo pago, sin letra chica. ¿Te parece bien?"',
      '→ NO definitivo: "Sin problema, de verdad. La dejo como ejemplo en nuestro portafolio, sin tu nombre. Si algún día la necesitas, aquí estoy." → marcar "No aceptó" en el CRM.',
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
      'Día 2: "¿Alcanzaste a verla? Si quieres cambios, me escribes — se ajusta sin costo."',
      'Día 5: caso corto: "Un negocio de [rubro] en [CIUDAD] pasó de no aparecer a recibir X mensajes a la semana."',
      'Día 9: cierre suave: "Si no es buen momento, sin problema. La dejo guardada unos días — cuando quieras la retomamos. Aquí estoy." — STOP.',
    ],
  },
  {
    id: 'referidos',
    step: '11',
    title: 'Referidos (post-venta, dinero en efectivo)',
    emoji: '🎁',
    action: 'Solo después del pago, con la emoción arriba. 3 compras = devolución en efectivo. Nunca hosting gratis (ya viene incluido).',
    lines: [
      '"¡Felicidades! 🎉 … Oye, una pregunta solo para clientes: ¿conoces a 2-3 dueños como tú que no tengan página web?"',
      '"Por cada uno que contrate te voy sumando — y si me traes 3 que compren, te devuelvo los [PRECIO]. En efectivo."',
      '"Te mando un enlace para que se los pases directo. ¿Te parece justo?"',
    ],
  },
];

/** La objeción más probable según la etapa del lead (atajo para el panel). */
export const QUICK_OBJECTIONS = SALES_SCRIPT_FRIO.find((s) => s.id === 'objeciones')!.lines;

/** Frase resumen del sistema (prospección fría + demo-first honesto). */
export const FRIO_PITCH_LINE =
  'No le vendas una página: muéstrale la suya. El adelanto es gratis y la web terminada se ve antes de pagar — el riesgo siempre es cero.';
