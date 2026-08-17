// ============================================================================
// SALES SCRIPT — AI agent («La Secretaria Que Nunca Duerme»)
// Guion de venta del agente de AI (secretaria virtual), co-diseñado con el
// fundador (ago 2026) y espejo de salesScriptFrio.ts en estructura, distinto
// en contenido: aquí se vende el agente (setup + retainer), no la página web.
//
// Reglas Hormozi de ESTE guion (las 3 que hacen que funcione):
//   1. La demo vende, tú no — tu única misión es que el prospecto le escriba
//      a la secretaria en SU propio WhatsApp.
//   2. Vendes una secretaria, no un software — jamás «chatbot/agente/IA/sistema».
//   3. Un sí a la vez — el agente primero; la web se ofrece DESPUÉS del cierre.
//
// Montos [SETUP] / [RETENER] se resuelven SIEMPRE desde MIS PRECIOS (Ajustes
// del copilot) — nunca inventar una cifra. Variables del prospecto igual que
// el guion frío: [SALUDO] [NOMBRE] [rubro] [CIUDAD] [EMPRESA] [RESEÑAS] [RATING].
// ============================================================================
import type { ScriptSection } from './salesScriptFrio';

export const SALES_SCRIPT_AGENT: ScriptSection[] = [
  {
    id: 'apertura',
    step: '1',
    title: 'Apertura — la pregunta del dolor',
    emoji: '🎯',
    action: 'El dolor es la puerta. Una pregunta de 1 minuto, sin vender todavía. Calma y curiosidad — no interrogatorio.',
    lines: [
      '"Hola, ¿con quién tengo el gusto? … Le hablo de ZerionStudio."',
      '"Una pregunta rápida: ¿le pasa que los pacientes le escriben por WhatsApp y a veces se quedan sin contestar?"',
      '"¿Y que hay citas que confirman y después no llegan?"',
    ],
  },
  {
    id: 'razon',
    step: '2',
    title: 'Los números (escucha y haz la matemática en voz alta)',
    emoji: '🧭',
    action: 'Dos preguntas y listo. NO interrumpa. Con SUS números haga la matemática EN VOZ ALTA — el que habla primero, pierde.',
    lines: [
      '"Dos preguntas y listo. Una: ¿cuántos pacientes le escriben al día por WhatsApp?"',
      '"Y dos: ¿cuántos pacientes agendados no llegan en una semana normal?"',
      '→ Con su número: "O sea, si no llegan [X] por semana y cada cita vale [aprox], son $[X×valor] que se le van cada semana. Eso es un sueldo completo que se le cae del bolsillo."',
    ],
  },
  {
    id: 'agitacion',
    step: '3',
    title: 'El costo de no contestar',
    emoji: '⏳',
    action: 'Refuerce con UNA frase. El que espera en el WhatsApp ya se fue con el competidor. Después: silencio.',
    lines: [
      '"El paciente que le escribe a las 3 de la tarde y nadie le contesta hasta la noche… ese paciente ya se fue a otro lado."',
      '"El que espera en la sala le paga; el que espera en el WhatsApp ya se fue."',
    ],
  },
  {
    id: 'propuesta',
    step: '4',
    title: 'La demo en vivo (esto cierra, no su boca)',
    emoji: '💬',
    action: 'LA DEMO VENDE, NO USTED. Que el prospecto le escriba a la secretaria en SU propio WhatsApp. El momento en que contesta es la venta. No explique nada técnico.',
    lines: [
      '"Agarre su celular. Abra el WhatsApp de [EMPRESA]. Escríbale: "Hola, necesito una cita para el jueves"."',
      '"¿Qué acaba de ver? Contestó en 5 segundos, le ofreció horarios y le agendó la cita. Sola."',
      '"Eso mismo pasa a las 3 de la mañana, un domingo, mientras usted atiende."',
    ],
  },
  {
    id: 'calificacion',
    step: '5',
    title: 'El cierre — stack + precio + garantía',
    emoji: '💎',
    action: 'Después de la demo, cierre en 60 segundos: stack → precio → garantía → pregunta de arranque. Sin anclas largas.',
    lines: [
      '"Esto es lo que incluye: contesta 24/7, agenda, confirma, recupera citas canceladas y le manda reporte cada viernes."',
      '"Valor normal $2,000. Usted paga [SETUP] de instalación y [RETENER] al mes."',
      '"Y la garantía: si en 30 días no le recupera su plata en citas que hoy se pierden, le devuelvo el setup. Sin letra chica."',
      '"¿Empezamos esta semana para que el lunes ya esté contestando?"',
    ],
  },
  {
    id: 'objeciones',
    step: '6',
    title: 'Objeciones (respuesta exacta, memorícelas)',
    emoji: '🛡️',
    action: 'Acordar → aislar → responder → re-pedir. Máx. 2 vueltas — después cierre con elegancia.',
    lines: [
      '"Suena caro" → "Me acaba de decir que pierde [X] citas por semana. Con UNA que recupere al mes, ya se pagó. ¿Cuánto cuesta una cita que no se hace? Es la décima parte del sueldo de una recepcionista — y nunca se enferma."',
      '"Mi recepcionista ya hace eso" → "Y la queremos. Esto no la reemplaza: le quita el WhatsApp y las confirmaciones, para que ella se dedique a los pacientes que están AHÍ en la sala. El que espera en la sala le paga; el que espera en el WhatsApp ya se fue."',
      '"Déjeme pensarlo" → "Perfecto. Dejo a su secretaria trabajando en su WhatsApp GRATIS por 3 días. El viernes me dice. Si no le gusta, la apago y no me debe nada. ¿Me confirma el número de WhatsApp de [EMPRESA]?"',
    ],
  },
  {
    id: 'recepcion',
    step: '7',
    title: 'Recepcionista / empleado (gatekeeper)',
    emoji: '🚪',
    action: 'Su razón debe ser transmisible — el gatekeeper la repite. La palabra "ayudar" abre puertas. Nunca engañar.',
    lines: [
      '"Hola, ¿me podría ayudar? ¿Está el/la dueño/a? Es sobre los mensajes de WhatsApp del negocio."',
      '"¿Cuál es la mejor manera de que le llegue un mensaje — WhatsApp o que le llame a tal hora?"',
    ],
  },
  {
    id: 'entrega',
    step: '8',
    title: 'WhatsApp primero (Paso 0 — antes de llamar)',
    emoji: '📲',
    action: 'En LATAM se contesta WhatsApp, no el teléfono. Este mensaje va PRIMERO, antes de la llamada.',
    lines: [
      '"Hola [SALUDO], soy [NOMBRE]. Una pregunta de 1 minuto: ¿le pasa que le escriben por WhatsApp y a veces se quedan sin contestar? ¿Y que hay citas que confirman y después no llegan?"',
      '"Tengo algo que le quiero mostrar en 2 minutos por videollamada. ¿Le interesa?"',
    ],
  },
  {
    id: 'cierre',
    step: '9',
    title: 'Follow-up + cierre',
    emoji: '💵',
    action: 'Precio natural, sin drama: ya vio la demo, ya le gustó — es solo un dato. Si dice no, se apaga y no pasa nada.',
    lines: [
      'Si la probó: "¿Qué le pareció? … ¿Le contestó al instante? … ¿Le agendó la cita?"',
      '→ Le gustó: "Se la dejamos entrenada con sus datos y sus precios. [SETUP] una vez y [RETENER] al mes — y 30 días de garantía. ¿Le parece bien?"',
      '→ NO definitivo: "Sin problema. La apago y no pasa nada. Si algún día la necesita, aquí estoy." → marcar "No aceptó" en el CRM.',
    ],
  },
  {
    id: 'seguimiento',
    step: '10',
    title: 'Seguimiento (anti-ghosting)',
    emoji: '📆',
    action: 'Siempre con algo NUEVO. Nunca "¿ya lo pensó?". Cadencia: día 0, 2, 5, 9 — y STOP.',
    lines: [
      'Día 0: el mensaje de la demo del paso 8.',
      'Día 2: "¿Alcanzó a probar a la secretaria? Si quiere, le mando de nuevo el WhatsApp."',
      'Día 5: caso corto: "Una [rubro] en [CIUDAD] recuperó X citas al mes que se le escapaban por no contestar a tiempo."',
      'Día 9: cierre suave: "Si no es buen momento, sin problema. La dejo guardada — cuando quiera la retomamos. Aquí estoy." — STOP.',
    ],
  },
  {
    id: 'referidos',
    step: '11',
    title: 'Referidos (post-venta, dinero en efectivo)',
    emoji: '🎁',
    action: 'Solo después del pago, con la emoción arriba. 3 compras = devolución en efectivo.',
    lines: [
      '"¡Felicidades! 🎉 … Una pregunta solo para clientes: ¿conoce a 2-3 dueños como usted que no den abasto con el WhatsApp?"',
      '"Por cada uno que contrate le voy sumando — y si me trae 3 que compren, le devuelvo [SETUP]. En efectivo."',
      '"Le mando un enlace para que se los pase directo. ¿Le parece justo?"',
    ],
  },
];

/** Frase resumen del sistema (prospección del agente + demo en vivo). */
export const AGENT_PITCH_LINE =
  'La demo vende, tú no: tu única misión es que el prospecto le escriba a la secretaria en su WhatsApp. Vendes una secretaria, no un software — nunca digas «chatbot» ni «agente». Y un sí a la vez: el agente primero, la web después.';
