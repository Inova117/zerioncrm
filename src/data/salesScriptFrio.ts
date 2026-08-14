// ============================================================================
// SALES SCRIPT — Llamada en frío (Guion de venta completo, demo-first)
// ----------------------------------------------------------------------------
// Guion de prospección fría a negocios locales sin web, co-diseñado con el
// fundador (ago 2026) y espejo del documento de entrenamiento
// (~/ZerionStudio/ads-web-300/guion-venta-frio.pdf). Metodología:
//   - Pattern interruption: el cumplido específico con datos REALES del lead
//     ([RESEÑAS], [RATING], [SOCIALES]) desarma mejor que cualquier apertura.
//   - NEPQ-lite (Jeremy Miner): la pregunta "¿por qué no tienes web?" saca la
//     razón real (la objeción antes de que exista) + agitación con el costo.
//   - Riesgo reverso (Hormozi): "no pagas nada por verla; si no te gusta, la
//     borro" — nunca decir "ya está hecha" si no lo está (demo-first honesto).
//   - Calificación antes de producir (eficiencia): "¿si te encanta, te la
//     quedarías?" — el sí al compromiso se pide antes del trabajo.
//   - WhatsApp (LatAm): canal rey para la entrega y el seguimiento.
//
// Los montos [PRECIO] / [MENSUAL] se resuelven SIEMPRE desde MIS PRECIOS
// (ajustes del copilot) — nunca inventar una cifra.
//
// Variables del prospecto (se resuelven en pantalla con los datos del lead,
// sin LLM — ver fillLeadVars en src/lib/scriptUtils.ts):
//   [SALUDO]   → "Doña Marta" / "Don Juan" / "Buenas"
//   [NOMBRE]   → "Marta, de ZerionStudio" (auto-presentación)
//   [rubro]    → industria ("clínica dental", "peluquería"…)
//   [CIUDAD]   → ciudad del negocio
//   [EMPRESA]  → nombre del negocio
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
    title: 'Apertura — el cumplido específico',
    emoji: '🎯',
    action: 'El cumplido con datos REALES del negocio desarma (pattern interruption). Nunca digas "investigación/encuesta/marketing". Después de la pregunta, CALLA.',
    lines: [
      '"Hola, ¿hablo con el/la dueño/a? … [SALUDO], le hablo de ZerionStudio."',
      '"Oye, antes que nada: me encantó su negocio — vi que [EMPRESA] tiene [RESEÑAS] en Google, [RATING], y hasta [SOCIALES]… pero no tiene página web."',
      '"¿Me permite preguntarle por qué no tiene una?"',
    ],
  },
  {
    id: 'razon',
    step: '2',
    title: 'La razón real (escucha y clasifica)',
    emoji: '🧭',
    action: 'NO interrumpas — la respuesta es la objeción ANTES de que exista. Clasifícala mentalmente con la tabla y guarda sus palabras textuales.',
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
    title: 'Agitación — el costo de inacción',
    emoji: '⏳',
    action: 'UNA pregunta. Después: SILENCIO absoluto. Que él ponga el número — el que habla primero, pierde.',
    lines: [
      '"Te entiendo perfectamente. … Y oye, ¿cuántos clientes crees que te buscan en Google, ven tus reseñas, y al no encontrar tu web se van con la competencia?"',
      '"¿Crees que son 2, 5, 10 al mes?"',
      '→ SILENCIO. Que él ponga el número.',
    ],
  },
  {
    id: 'propuesta',
    step: '4',
    title: 'La propuesta (riesgo reverso)',
    emoji: '🤝',
    action: 'La oferta irrechazable: gratis de ver, se borra si no gusta. Sin precio todavía. Pregunta de compromiso al final.',
    lines: [
      '"Mira, te propongo algo sin riesgo: te hago tu página web y no pagas nada por verla. Es gratis."',
      '"Si te gusta, seguimos. Si no te gusta, la borro y no pasó nada. ¿Te parece justo?"',
    ],
  },
  {
    id: 'calificacion',
    step: '5',
    title: 'La calificación (LA pregunta de eficiencia)',
    emoji: '🔒',
    action: 'El sí al compromiso se pide ANTES del trabajo. Si dice que no: no desarrollas nada — entra la objeción real (paso 6).',
    lines: [
      '"Perfecto. Y una cosa más, para ser honestos los dos: si te la muestro terminada en tu celular y te encanta, ¿estarías dispuesto a quedártela?"',
      '"No te digo cuánto cuesta todavía — solo quiero saber si, viéndola terminada, te interesaría quedártela."',
      '→ SÍ: "¡Listo! La desarrollo esta semana y te escribo por WhatsApp con el link. ¿Este número tiene WhatsApp? … Perfecto, [nombre], nos hablamos en unos días."',
      '→ NO / dudas: objeción real (paso 6). Si se resuelve, vuelve al paso 4.',
    ],
  },
  {
    id: 'objeciones',
    step: '6',
    title: 'Objeciones (reflejos, no decisiones)',
    emoji: '🛡️',
    action: 'Acordar → aislar → responder → re-pedir el paso. Máx. 2 loops — después cierra con elegancia.',
    lines: [
      '"No me interesa" → "Claro, totalmente válido. Solo una cosa: ¿qué hace hoy para que lo encuentren en Google, o no le preocupa por ahora?"',
      '"Está caro" → "Te entiendo — pagarlo de un solo no es cualquier cosa. ¿Y cuánto se te va al mes por no aparecer? … La página cuesta menos que un mes de eso. Y la viste terminada antes de pagar, cero riesgo."',
      '"Mi sobrino/amigo me la hace gratis" → "Qué bueno que tengas quien te ayude. Mírala igual — es gratis y ya está con tus fotos. Si lo de él es mejor, no me pagas nada. En los dos escenarios tú ganas."',
      '"Mándame la info" → "La información ES la página — ya está lista, mírala aquí: [link]. Usted la ve y me dice: ¿te gustó o no? Más simple no se puede, ¿verdad?"',
      '"No tengo tiempo" → "Te entiendo, por eso la dejamos lista: solo la miras 2 minutos por WhatsApp cuando puedas. ¿Te la mando?"',
      '"Déjame pensarlo" → "¿Es tu forma amable de decirme que no? … ¿Qué fue lo que no te convenció: el precio, o si de verdad te va a traer clientes?"',
    ],
  },
  {
    id: 'recepcion',
    step: '7',
    title: 'Recepcionista / empleado (gatekeeper)',
    emoji: '🚪',
    action: 'El gatekeeper puede repetir tu razón — que sea transmisible. La palabra "ayudar" abre puertas. Nunca engañar.',
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
    action: 'Se envía el día de la entrega. Link + curiosidad dirigida ("mira especialmente X") + recordatorio de riesgo cero.',
    lines: [
      '"[Nombre] 👋 ¡Tu página está lista! Mírala aquí: [link]"',
      '"La armé con tus fotos y tus reseñas de Google — mira especialmente cómo quedó la sección de [servicios/menú]."',
      '"Es gratis, no pagas nada por verla. Cuando la veas me dices qué opinas — si te gusta, conversamos; si no, la borro y no pasó nada. 👍"',
    ],
  },
  {
    id: 'cierre',
    step: '9',
    title: 'Follow-up + cierre (Toque 3, 24-48h)',
    emoji: '💵',
    action: 'Precio natural, sin pausa dramática: ya la vio, ya le gustó — es solo un dato. Si dice no: la página pasa al portafolio (máquina de demos).',
    lines: [
      'Si vio el link: "¿La viste? … ¿Qué opinas de [algo específico]? … ¿Te gustó cómo quedó con tus fotos?"',
      'Si no respondió: "Hola [nombre], ¿alcanzaste a ver tu página? Te la dejo aquí por si se perdió: [link]. Si no es buen momento, la dejo guardada."',
      '→ Cuando dijo que le gustó: "¡Qué bien! Mira, te la dejo terminada y funcionando — todo incluido: WhatsApp, Google Maps y la versión para celular. Cuesta [PRECIO], un solo pago, sin letra chica. ¿Te parece bien?"',
      '→ NO definitivo: "Sin problema, de verdad. La dejo como ejemplo de nuestro trabajo en el portafolio, sin tu nombre ni tus datos. Si algún día la necesitas, aquí estoy." → marcar "No aceptó" en el CRM.',
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
      'Día 2: "¿Alcanzaste a ver tu página? Si quieres cambios o tienes dudas, me escribes — se ajusta sin costo."',
      'Día 5: caso corto: "Un negocio de [rubro] en [CIUDAD] pasó de no aparecer a recibir X mensajes a la semana."',
      'Día 9: cierre suave: "Si no es buen momento, sin problema. La dejo guardada unos días — cuando quiera la retomamos. Aquí estoy." — STOP.',
    ],
  },
  {
    id: 'referidos',
    step: '11',
    title: 'Referidos (post-venta, dinero en efectivo)',
    emoji: '🎁',
    action: 'Se pide SOLO después del pago, con la emoción arriba. 3 contactos que compren = devolución en efectivo. NUNCA ofrecer hosting gratis (ya viene incluido).',
    lines: [
      '"¡Felicidades! 🎉 … Oye, una pregunta que solo les hago a mis clientes: ¿conoces a 2-3 dueños de negocios como el tuyo que tampoco tengan página web?"',
      '"Por cada uno que contrate te voy sumando — y si me traes 3 que compren, te devuelvo los [PRECIO] de tu página. En efectivo."',
      '"Te mando un enlace para que se los pases directo — así te llevas el crédito. ¿Te parece justo?"',
    ],
  },
];

/** La objeción más probable según la etapa del lead (atajo para el panel). */
export const QUICK_OBJECTIONS = SALES_SCRIPT_FRIO.find((s) => s.id === 'objeciones')!.lines;

/** Frase resumen del sistema (prospección fría + demo-first honesto). */
export const FRIO_PITCH_LINE =
  'No le vendas una página: muéstrale la suya. El adelanto es gratis y la web terminada se ve antes de pagar — el riesgo siempre es cero.';
