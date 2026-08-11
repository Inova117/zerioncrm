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
//     SÍ a recibir SU página por WhatsApp. La venta cierra ahí.
//   - DEMO-FIRST honesto (ZerionStudio): el prospecto ve un ADELANTO de su
//     página (mockup con su nombre y sus fotos de Google) antes de pagar nada.
//     Si le gusta, se desarrolla completa en 7 días y la ve terminada antes de
//     pagar; si no, se borra. Cero riesgo — y sin pre-desarrollar para todos:
//     el adelanto solo se arma para leads que muestran interés real en la llamada.
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
      '"Le soy directo: trabajo con [rubro] de [CIUDAD] que hoy no aparecen cuando la gente los busca en Google. Vi que [EMPRESA] no tiene web todavía — por eso le llamo."',
      '"Solo quiero saber una cosa: ¿cómo consigue clientes nuevos hoy — recomendación, la gente que pasa, o también lo buscan en internet?"',
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
    title: 'El adelanto (su página, con sus ojos)',
    emoji: '👀',
    action: 'El momento clave: NO ofrezcas ejemplos de otros y NO digas que ya está hecha si no lo está. Ofrece un ADELANTO gratuito con su nombre y sus fotos — la prueba visual sin mentir. Amarra el WhatsApp.',
    lines: [
      '"Tiene sentido, ¿no? Si no aparecen cuando lo buscan, el cliente se va con quien sí aparece."',
      '"Mire, yo no le voy a pedir que confíe en mi palabra. Le mando por WhatsApp un adelanto de cómo se vería su página — con el nombre de su negocio y sus fotos de Google. Es gratis, lo ve con sus propios ojos."',
      '"Si le gusta, la desarrollamos completa en 7 días y se la muestro terminada antes de pagar. Si no le gusta, no pasa nada, la borro. ¿Le parece justo?"',
      '"¿Este número tiene WhatsApp? … Perfecto, se lo mando ahorita."',
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
      '"Mándame la info" → "La información ES la página — le mando el adelanto por WhatsApp y usted lo ve con calma. ¿Me da el número?"',
      '"Ya tengo quien me la haga" → "Qué bueno. Mire el adelanto igual — es gratis y con sus fotos. Si lo de su gente es mejor, no me paga nada. Usted no pierde nada."',
      '"No tengo tiempo" → "Le entiendo, por eso el adelanto se ve en 2 minutos por WhatsApp cuando pueda. ¿Se lo mando?"',
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
      '"¿Le pareció justo? … Entonces le mando el adelanto por WhatsApp y usted me dice si le gusta. ¿Le parece?"',
      '→ Solo si pregunta precio: "El adelanto es gratis. Si le gusta, la desarrollamos completa en 7 días por [PRECIO], con todo — se lo digo de frente porque aquí no hay letra chica. Y la ve terminada antes de pagar: si no le encanta, no paga. Pero primero véala."',
    ],
  },
  {
    id: 'seguimiento',
    step: '9',
    title: 'Seguimiento (anti-ghosting)',
    emoji: '📆',
    action: 'Siempre con algo NUEVO. Nunca "¿ya lo pensó?". Cadencia: día 0, 2, 5, 9 — y STOP.',
    lines: [
      'WhatsApp día 0: "Aquí va el adelanto de su página — mírelo con calma. Si no le gusta, me dice y no le molesto más."',
      'Día 2: "¿Alcanzó a verlo? Si quiere cambios o tiene dudas, me escribe — se ajusta sin costo."',
      'Día 5: caso corto: "Un [rubro] de [CIUDAD] pasó de no aparecer a recibir X mensajes a la semana."',
      'Día 9: cierre suave: "Si no es buen momento, sin problema. Lo dejo guardado unos días — cuando quiera lo retomamos. Aquí estoy." — STOP.',
    ],
  },
];

/** La objeción más probable según la etapa del lead (atajo para el panel). */
export const QUICK_OBJECTIONS = SALES_SCRIPT_FRIO.find((s) => s.id === 'objeciones')!.lines;

/** Frase resumen del sistema (prospección fría + demo-first honesto). */
export const FRIO_PITCH_LINE =
  'No le vendas una página: muéstrale la suya. El adelanto es gratis y la web terminada se ve antes de pagar — el riesgo siempre es cero.';
