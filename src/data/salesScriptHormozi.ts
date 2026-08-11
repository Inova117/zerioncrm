// ============================================================================
// SALES SCRIPT — Hormozi (Guion de venta en vivo)
// ----------------------------------------------------------------------------
// Guion de llamada paso a paso basado en la metodología de Alex Hormozi
// ($100M Offers: dream outcome → problema → solución → garantía → escasez)
// fusionado con el modelo DEMO-FIRST de ZerionStudio (la página se construye
// ANTES de cobrar). Este guion se muestra EN PANTALLA dentro del Sales Copilot
// para que el vendedor lo tenga a la vista durante el briefing y la llamada.
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

export const SALES_SCRIPT_HORMOZI: ScriptSection[] = [
  {
    id: 'apertura',
    step: '1',
    title: 'Apertura',
    emoji: '🎯',
    action: 'Dila y CALLA. No pidas permiso. Sonríe — se escucha.',
    lines: [
      '"¡[SALUDO]! ¿Cómo le va? … Soy [NOMBRE]."',
      '"Le soy honesto de entrada: esta es una llamada de ventas — y aun así le va a interesar, porque su página web YA ESTÁ HECHA."',
      '"¿Sabía que cuando buscan [rubro] en Google, usted no aparece? … En [CIUDAD], [EMPRESA] no sale ni en la primera página."',
    ],
  },
  {
    id: 'problema',
    step: '2',
    title: 'El dolor (Hormozi: dream outcome)',
    emoji: '💔',
    action: 'Máx. 2-3 preguntas. Que ÉL admita el problema con números. Guarda todo textual.',
    lines: [
      '"¿Hoy cómo le llegan los clientes: recomendación, gente que pasa, o internet?"',
      '"¿Y se le han ido pedidos por no contestar el WhatsApp a tiempo? ¿Cuántos al mes: dos, cinco, diez?"',
      '"¿Cuánto le deja cada uno, más o menos? … A ver si le entendí: [X] al mes por [Y] son [Z]. ¿Le cuadra o me paso?"',
      '→ REMATE: "…¿y por qué le interesa resolver esto JUSTO ahora?"',
    ],
  },
  {
    id: 'sello',
    step: '3',
    title: 'El sello del problema (GATE)',
    emoji: '🔒',
    action: 'Sin su "sí" confirmado NO pases al pitch. Es la puerta obligatoria.',
    lines: [
      '"O sea: los clientes le llegan por recomendación, el WhatsApp se contesta cuando se puede, y ya se le han ido pedidos por eso… ¿así es?"',
      '→ Solo con su SÍ (o corrección aceptada) continúa.',
    ],
  },
  {
    id: 'revelacion',
    step: '4',
    title: 'La revelación (el pitch de contraste)',
    emoji: '💥',
    action: 'El contraste: HOY vs CON la página. Pausa de misterio antes de "ya está hecha".',
    lines: [
      '"Yo no le llamo a ofrecerle una página… le llamo porque su página YA ESTÁ HECHA."',
      '"La armamos por nuestra cuenta, como muestra de trabajo, con SUS fotos y SUS reseñas de Google — para que el que busca [rubro] en [CIUDAD] le escriba directo al WhatsApp."',
      '"HOY: cuando lo buscan en Google, aparece su competencia. CON la página: lo encuentran a usted, le escriben, y usted vende sin contestar el teléfono."',
      '"Y ojo — usted no ha contratado nada ni me debe nada. La hicimos por nuestra cuenta."',
    ],
  },
  {
    id: 'trato-t1',
    step: '5',
    title: 'El trato + cierre del Toque 1',
    emoji: '🤝',
    action: 'AMARRA LA HORA. Sin hora NO es sí. Frase + silencio.',
    lines: [
      '"Se la mando por WhatsApp, usted la ve con calma — sola, sin mí encima. Si le encanta, conversamos. Si no, la borro y aquí no ha pasado nada. ¿Le parece justo?"',
      '"¿Este número tiene WhatsApp? … ¿Y a qué hora cree que la alcanza a ver? ¿Hoy en la noche, o mañana en la mañana?"',
    ],
  },
  {
    id: 'precio',
    step: '6',
    title: 'El precio (solo T2, o si él pregunta)',
    emoji: '💰',
    action: 'De frente. UNA vez. NUNCA se baja. Silencio absoluto después.',
    lines: [
      '"Como la suya ya está construida, queda en [PRECIO], con todo — se lo digo de frente porque aquí no hay letra chica. Una sola vez, no es mensualidad."',
      '"La página trabaja 24 horas — un solo cliente nuevo la paga. Con dos clientes nuevos, ya le sobró."',
      '→ SILENCIO. El primero que habla, cede.',
    ],
  },
  {
    id: 'objeciones',
    step: '7',
    title: 'Objeciones (acordar siempre)',
    emoji: '🛡️',
    action: 'NUNCA contradecir. Acordar → aislar → responder → re-pedir el paso. Máx. 2 loops.',
    lines: [
      '"Mi sobrino me la hace gratis" → "Qué bueno que tenga quien le ayude. Mire: esta YA ESTÁ terminada — véala primero. Si lo de él es mejor, se queda con lo de él y no me paga nada. En los dos escenarios usted gana."',
      '"Está caro" → "Le entiendo — pagarlo de un solo no es cualquier cosa. ¿Y cuánto se le va al mes por no aparecer? … [SU número] al año se va a la competencia. La página cuesta MENOS que un mes de eso."',
      '"Mándame la info" → "La información ES la página — se la mando ahorita mismo. Usted la ve y me dice: ¿le gustó o no? Más simple no se puede, ¿verdad? ¿A qué hora la alcanza a ver?"',
      '"Déjame pensarlo" → "¿Es su forma amable de decirme que no? … ¿Qué fue lo que no le convenció: el precio, o si de verdad le va a traer clientes?"',
    ],
  },
  {
    id: 'cierre-t2',
    step: '8',
    title: 'El Toque 2 (24-72h, ya la vio)',
    emoji: '💵',
    action: 'Que ELLA diga que le gustó → replay del dolor → prueba → precio → SILENCIO → cobrar.',
    lines: [
      '"¿La pudo ver? ¿Le gustó cómo quedó con sus reseñas?"',
      '"Acuérdese de lo que me contaba: [X] al mes por [Y] son [Z] al año yéndose donde la competencia."',
      '"¿Maneja transferencia o De Una? … Perfecto. Hoy mismo queda oficial."',
      '→ Solo después del sí: "El primer mes de mantenimiento va incluido… ¿lo dejamos activo?"',
    ],
  },
  {
    id: 'seguimiento',
    step: '9',
    title: 'Seguimiento (anti-ghosting)',
    emoji: '📆',
    action: 'Siempre con algo NUEVO. Nunca "¿ya lo pensó?". El viernes es real.',
    lines: [
      'Link por WhatsApp: "Buenas, aquí va su página — mírela con calma. Si no le gusta, un no gracias y no le molesto más."',
      'El viernes: "Las demos que no se concretan las doy de baja el viernes. Si se anima, un mensajito."',
      'Reactivación a 90 días con caso de éxito del rubro.',
    ],
  },
];

/** La objeción más probable según la etapa del lead (atajo para el panel). */
export const QUICK_OBJECTIONS = SALES_SCRIPT_HORMOZI.find((s) => s.id === 'objeciones')!.lines;

/** Frase resumen del sistema (Hormozi): el destino que se vende. */
export const HORMOZI_PITCH_LINE =
  'Nadie compra el avión; compra la playa. La página es el avión — el destino es su WhatsApp vibrando con un pedido nuevo.';