// ============================================================================
// SALES SCRIPT — Llamada en frío (Guion de prospección)
// ----------------------------------------------------------------------------
// Guion de llamada fría a negocios locales sin web (clínicas, restaurantes,
// peluquerías…) basado en la investigación de metodologías de prospección:
//   - John Barrows (frío B2B): la llamada fría NO vende el producto, vende el
//     siguiente paso (30 seg → 2 min → WhatsApp). Mensaje específico del nicho.
//   - Pattern interruption (psicología): NUNCA decir "investigación",
//     "encuesta" ni "marketing digital" — activan el reflejo de colgar en <2s.
//   - NEPQ-lite (Jeremy Miner): 2-3 preguntas emocionales + costo de inacción
//     + acuerdo lógico + cierre con pregunta (el prospecto se vende solo).
//   - WhatsApp (LatAm): el canal rey — la meta de la llamada fría es que diga
//     SÍ a recibir ejemplos por WhatsApp. La venta cierra ahí.
//
// Los montos [PRECIO] / [MENSUAL] se resuelven SIEMPRE desde MIS PRECIOS
// (ajustes del copilot) — nunca inventar una cifra.
//
// Variables del prospecto (se resuelven en pantalla con los datos del lead,
// sin LLM — ver fillLeadVars en src/lib/scriptUtils.ts):
//   [SALUDO]  → "Doña Marta" / "Don Juan" / "Buenas"
//   [NOMBRE]  → "Marta, de ZerionStudio" (auto-presentación)
//   [rubro]   → industria ("clínica dental", "restaurantes"…)
//   [CIUDAD]  → ciudad del negocio
//   [EMPRESA] → nombre del negocio
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
    title: 'Apertura (permiso + 30 segundos)',
    emoji: '🎯',
    action: 'Tono bajo y pausado. Pide permiso con una pregunta pequeña — los micro-compromisos abren. Si dice que no, agenda la llamada.',
    lines: [
      '"¿Hablo con el/la dueño/a? … Hola [SALUDO], me llamo [NOMBRE]. Pregunta rápida: ¿le caí en mal momento o tiene 30 segundos?"',
      '→ Si duda o dice que sí, siga. Si dice que no: "¿A qué hora le puedo llamar?"',
    ],
  },
  {
    id: 'gancho',
    step: '2',
    title: 'El gancho (mensaje específico)',
    emoji: '💬',
    action: 'Específico de SU mundo. Sin features, sin precio. El objetivo es que pregunte "¿cómo?" — no explicar el producto.',
    lines: [
      '"Le soy directo: trabajo con [rubro] de [CIUDAD] que hoy no aparecen cuando la gente los busca en Google. Vi que [EMPRESA] no tiene web todavía."',
      '"No le voy a vender nada ahora. Solo quería saber: ¿cómo consigue clientes nuevos hoy — recomendación, la gente que pasa, o también lo buscan en internet?"',
    ],
  },
  {
    id: 'dolor',
    step: '3',
    title: 'El dolor (NEPQ: preguntas emocionales)',
    emoji: '💔',
    action: 'Máx. 2-3 preguntas. Que ÉL admita el problema. Escucha, no interrumpas, anota los números.',
    lines: [
      '"¿Y qué pasa cuando alguien de [CIUDAD] busca «[rubro] cerca de mí» en Google? ¿Aparece usted o su competencia?"',
      '"¿Se ha enterado de gente que fue a otro lado porque no los encontró a usted? ¿Cuántos al mes cree: dos, cinco, más?"',
      '→ Escuchar. Guardar los números textuales para el cierre.',
    ],
  },
  {
    id: 'costo',
    step: '4',
    title: 'Costo de inacción (NEPQ)',
    emoji: '⏳',
    action: 'UNA pregunta. Después: SILENCIO absoluto. El primero que habla pierde.',
    lines: [
      '"¿Y si eso sigue igual los próximos 6 meses, cuánto calcula que le cuesta en clientes que ni sabe que lo buscaron?"',
      '→ SILENCIO. Que él ponga el número.',
    ],
  },
  {
    id: 'acuerdo',
    step: '5',
    title: 'Acuerdo lógico + prueba (NEPQ nivel 5)',
    emoji: '🤝',
    action: 'No vendas la web: vendes 30 seg → 2 min → WhatsApp. La meta es que diga SÍ a recibir ejemplos.',
    lines: [
      '"Tiene sentido, ¿no? Si no aparecen cuando lo buscan, el cliente se va con quien sí aparece."',
      '"Por eso le llamo: yo hago las páginas de [rubro] como el suyo. No sé si le sirva, pero le puedo mandar por WhatsApp 2 ejemplos de negocios como el suyo, para que vea el estilo sin compromiso. ¿Se los mando?"',
      '"¿Este número tiene WhatsApp? … Perfecto, se los mando ahorita."',
    ],
  },
  {
    id: 'objeciones',
    step: '6',
    title: 'Objeciones (reflejos, no decisiones)',
    emoji: '🛡️',
    action: 'Las primeras objeciones son reflejos, no decisiones (Barrows). Acordar → preguntar → re-pedir el paso. Máx. 2 loops.',
    lines: [
      '"No me interesa" → "Claro, totalmente válido. Solo una cosa: ¿qué hace hoy para que lo encuentren en Google, o no le preocupa por ahora?"',
      '"Mándame la info" → "La información ES la página — se la mando por WhatsApp y usted la ve con calma. ¿Me da el número?"',
      '"Ya tengo quien me la haga" → "Qué bueno. Mire los ejemplos igual — si lo de su gente es mejor, no me paga nada. Usted no pierde nada."',
      '"No tengo tiempo" → "Le entiendo, por eso le mando todo por WhatsApp y usted lo ve cuando pueda. ¿Se los mando?"',
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
    id: 'cierre',
    step: '8',
    title: 'El cierre frío (siguiente paso)',
    emoji: '💵',
    action: 'La llamada fría NO vende la web: vende el siguiente paso (Barrows). El precio SOLO si él pregunta.',
    lines: [
      '"¿Le pareció justo? … Entonces le mando los ejemplos por WhatsApp y usted me dice cuál le gusta más. ¿Le parece?"',
      '→ Solo si pregunta precio: "Todo incluido, [PRECIO], y la ve terminada antes de pagar: si no le encanta, no paga. Pero primero vea los ejemplos."',
    ],
  },
  {
    id: 'seguimiento',
    step: '9',
    title: 'Seguimiento (anti-ghosting)',
    emoji: '📆',
    action: 'Siempre con algo NUEVO. Nunca "¿ya lo pensó?". Cadencia: día 0, 2, 5, 9 — y STOP.',
    lines: [
      'WhatsApp día 0: "Aquí van los 2 ejemplos. Mírelos con calma y dígame cuál estilo le gusta más para el suyo."',
      'Día 2: "¿Le llegaron? Le dejo uno más de su rubro por si le sirve de referencia."',
      'Día 5: caso corto: "Un [rubro] de [CIUDAD] pasó de no aparecer a recibir X mensajes a la semana."',
      'Día 9: cierre suave: "Si no es buen momento, sin problema. Cuando quiera ver cómo se vería la suya, aquí estoy." — STOP.',
    ],
  },
];

/** La objeción más probable según la etapa del lead (atajo para el panel). */
export const QUICK_OBJECTIONS = SALES_SCRIPT_FRIO.find((s) => s.id === 'objeciones')!.lines;

/** Frase resumen del sistema (prospección fría): lo que se vende en cada etapa. */
export const FRIO_PITCH_LINE =
  'En la llamada fría no se vende la web: se venden 30 segundos, luego 2 minutos, luego un WhatsApp con ejemplos. La web se vende sola cuando la ven terminada.';
