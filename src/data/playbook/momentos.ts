// ============================================================================
// Momentos de la llamada — el "GPS" del Copilot.
//
// Una llamada en frío no es una sola cosa: es una secuencia de momentos
// (gatekeeper → apertura → descubrimiento → pitch → objeción → señal de
// compra → cierre) y LA JUGADA CORRECTA depende del momento. Este módulo
// detecta el momento en tiempo real (regex sobre lo que dice el prospecto,
// sin esperar al LLM), con cues del habla REAL latina levantadas en la
// investigación profunda (Gong, Belfort, Voss, Cardone, SPIN, nicho local).
//
// Prioridad de detección (regla de la investigación): PELIGRO-colgar >
// YA-COMPRÓ > señal de compra > precio > objeción > gatekeeper > resto.
// Perder la llamada o sobre-vender son irreversibles; confundir
// descubrimiento con pitch no lo es.
// ============================================================================
import { normalizeSpeech } from './normalize';

export type CallMoment =
  | 'gatekeeper'
  | 'apertura'
  | 'descubrimiento'
  | 'pitch'
  | 'objecion'
  | 'precio'
  | 'senal-compra'
  | 'peligro'
  | 'cierre'
  | 'despedida';

export interface MomentInfo {
  id: CallMoment;
  /** Etiqueta corta para el chip en vivo. */
  label: string;
  emoji: string;
  /** Frases del PROSPECTO (normalizadas: lowercase, sin acentos) que delatan este momento. */
  cues: RegExp;
  /** La mejor jugada de este momento: instrucción corta + qué decir. */
  bestMove: string;
  /** Si varias matchean en la misma frase, gana la de mayor prioridad. */
  priority: number;
}

export const MOMENTS: MomentInfo[] = [
  {
    id: 'peligro',
    label: 'Rescate — está por colgar',
    emoji: '🚨',
    priority: 100,
    cues: /te dejo|le dejo|tengo que colgar|no puedo hablar|dej(a|e) de llamar|no vuelvan a llamar|no moleste|quitame de (la|su) lista|voy a colgar|ya le dije que no|no tengo tiempo para esto|hasta luego,? gracias|chao,? gracias|bueno,? gracias,? hasta/,
    bestMove:
      'UNA sola jugada de rescate y si no engancha, suelta con elegancia (quemas el prospecto de hoy, no el de 3 meses). Con dato SUYO: "Quince segundos y le dejo: usted tiene [200] reseñas y [4.8] estrellas, y cuando lo buscan en Google no sale — solo eso quería decirle. ¿Se lo enseño el martes, o lo dejo ahí?" · "Estoy ocupado" → "¿Le llamo hoy a las 4 o mañana a las 9? Deme la hora y soy puntual." · "No me interesa" firme → "Entiendo, y le dejo. ¿Es porque ya tienen página, o porque nunca les ha hecho falta?" · Monosílabos → "¿Sería mala idea que le mande dos ejemplos por WhatsApp y usted decide?" NUNCA ruegues ni aceleres el pitch — el segundo rescate seguido destruye la puerta futura.',
  },
  {
    id: 'cierre',
    label: 'Ya compró — CÁLLATE y agenda',
    emoji: '🤝',
    priority: 97,
    cues: /cuando (empezamos|empezariamos|podriamos empezar|arrancamos)|como le pago|como seria el pago|que necesitan? de mi|mandeme los datos|para el deposito|hagamoslo|hagamos eso|de una,? pues|dale pues|ya,? pues(?!,? ?(digame|cuenteme|hable))|listo,? (hagamos|mandame|de una)|(?<!no )(?<!no le )me interesa|esta bien,? (hagamos|mandame|veamos)|de acuerdo|me parece bien|ahi nos vemos|venga y conversamos|el (lunes|martes|miercoles|jueves|viernes|sabado) (si )?puedo|mi pagina|cuando tenga la pagina/,
    bestMove:
      'YA COMPRÓ mentalmente: cada palabra de venta extra solo puede reabrir dudas. Confirma TODO en una frase y corta en menos de 60 segundos: "Perfecto, entonces lo dejamos así: nos vemos el jueves a las 3 y arrancamos. Le mando el detalle por WhatsApp ahorita, ¿a este número?" Único agregado permitido — y SOLO si el sí es al PROYECTO (anticipo), no a la cita de la muestra: el second money ("la mayoría agrega el mantenimiento con WhatsApp automático, ¿se lo dejo incluido?"). NUNCA menciones otro plan, otra feature ni vuelvas a tocar el precio.',
  },
  {
    id: 'senal-compra',
    label: 'Señal de compra — CIERRA',
    emoji: '🟢',
    priority: 95,
    cues: /cuanto (cuesta|vale|sale|es|cobran?|me sale|se demoran?)|que incluye|en cuanto tiempo|cuanto (tiempo )?se demoran?|estaria list[ao]|como seria|tienen ejemplos|trabajos (hechos|anteriores)|han trabajado con|donde puedo ver|me pueden poner (el menu|las fotos)|ustedes tambien manejan|y si despues quiero cambiar|suena (bien|interesante)|estaria bueno/,
    bestMove:
      'Dejó de evaluarte: está imaginándose CON la página. Responde en UNA frase y convierte en cita con alternativa: "Claro, le explico todo con ejemplos de su mismo rubro. ¿Le va mejor mañana a las 10 o el jueves a las 3?" Si pregunta precio en frío: "Depende de lo que necesite — por eso la muestra es gratis: la ve primero y hablamos de números con algo concreto en la mano. ¿Martes o miércoles?" DOS señales seguidas y sigues explicando = estás matando la venta.',
  },
  {
    id: 'precio',
    label: 'Negociación de precio',
    emoji: '💰',
    priority: 90,
    cues: /(esta|es|muy|tan|que) car(o|a)|carisim|carito|cuanto es lo (menos|minimo)|cual es lo menos|hay descuento|descuentito|rebaj(a|ita|eme)|mas barato|no me alcanza|esta fuerte el precio|esta elevado|formas? de pago|se puede pagar|en cuotas|a credito|mensualidades|si pago de una|ultimo precio|ayudeme con el precio|el otro me cobra(ba)? menos/,
    bestMove:
      'NUNCA defiendas el precio ni lo bajes de una. Secuencia: acuerda ("tiene razón, no es barato — y justo por eso funciona") → cuantifica con SUS números ("¿cuánto le deja un cliente nuevo? Con dos al mes se pagó sola") → reduce al ridículo ("menos de un dólar al día") → si insiste, cambia TÉRMINOS, no precio ("la mitad ahora y la mitad cuando la vea funcionando"). Tras decir un número: SILENCIO — el primero que habla, cede.',
  },
  {
    id: 'objecion',
    label: 'Objeción',
    emoji: '🛡️',
    priority: 80,
    cues: /no me interesa|no estoy interesad|no necesito|asi (estamos|estoy) bien|ya tengo (pagina|web|facebook|face|instagram|quien)|mi (sobrino|hijo|hija|primo|hermano)|un (amigo|muchacho|conocido) me|no tengo tiempo|estoy ocupad|dejame pensarlo|lo voy a pensar|dejeme pensar|tengo que (consultar|hablar con|pensarlo)|lo consulto|manda(me)? (la )?info|mandeme (la |una )?(informacion|proforma|cotizacion)|con (el )?facebook|no necesito publicidad|me estafaron|puro cuento|no confio|esta dura la (cosa|situacion)|las ventas estan|temporada baja|mas barato/,
    bestMove:
      'Secuencia fija (Cardone + Belfort): 1) ACUERDA ("tiene toda la razón / le entiendo perfecto") — nunca contradigas ni digas "pero" de frente. 2) AÍSLA o deflecta ("¿es eso lo único que lo detiene?" / "la idea como tal, ¿le gusta?"). 3) Responde SOLO esa objeción con SU dato. 4) RE-CIERRA con alternativa ("¿mañana o el jueves?"). Máximo 3 loops y sueltas con fecha. La battlecard te da la respuesta exacta.',
  },
  {
    id: 'gatekeeper',
    label: 'Gatekeeper — no es el dueño',
    emoji: '🚪',
    priority: 75,
    cues: /de parte de quien|quien l(o|a) (busca|llama)|de que empresa|para que lo (necesita|busca)|no se encuentra|no esta (el|la) (dueno|duena|doctor|ingeniero|senor|senora)|el dueno no (esta|viene)|esta ocupado atendiendo|le doy el recado|deje su (mensaje|numero)|dejeme su numero y el le|yo le aviso que llamo|en que le puedo ayudar|yo solo trabajo aqui/,
    bestMove:
      'NO pitchees al gatekeeper — trátalo como aliado, siempre de usted (tutea solo si la voz es claramente joven y te tutea primero): "¿Me ayuda porfa? Necesito hablar con el dueño sobre cómo aparece el negocio en Google. ¿Se encuentra?" Si no está: consigue ORO — "¿A qué hora lo encuentro seguro? ¿Y cómo se llama él? ¿Y me recuerda su nombre, para agradecerle cuando vuelva a llamar?" JAMÁS dejes tu número "para que él devuelva la llamada" (nunca llama): "mejor lo llamo yo, ¿mañana en la mañana está?"',
  },
  {
    id: 'pitch',
    label: 'Pidió el pitch',
    emoji: '🎯',
    priority: 60,
    cues: /que (es lo que )?hacen (ustedes)?|y ustedes que hacen|como funciona( eso)?|como trabajan|explique(me)?|a ver,? expliqueme|que me ofrece|que ofrece exactamente|para que me sirve( eso)?|eso de las paginas como es|que harian con mi negocio|de que se trata|ya,? (pues,? )?digame|a ver,? digame|cuenteme( rapidito| pues)?|tiene un minuto,? hable/,
    bestMove:
      'Pitch de 20 segundos, anclado al dolor que ÉL ya dijo, CERO tecnicismos, y remata con pregunta: "Es simple: le hacemos una página donde lo encuentran en Google, ven sus [servicios/menú] y le escriben directo a su WhatsApp. Usted no toca nada, nosotros hacemos todo. ¿Le cuadra para su negocio?" PROHIBIDO: listar features técnicos, dar precio antes de mostrar valor, hablar mal de la competencia.',
  },
  {
    id: 'descubrimiento',
    label: 'Descubrimiento',
    emoji: '🔎',
    priority: 40,
    cues: /por recomendacion me llegan|puro boca a boca|la mayoria viene por|los clientes (me )?llegan|tenemos facebook nomas|el face casi no|puro whatsapp trabajo|el whatsapp lo contesto yo|pagina no (tengo|tenemos)|ni se como me encuentran|me preguntan si tengo pagina|se me pierden pedidos|no se mucho de (eso de )?internet|eso lo ve mi hija a veces|al mes (llegan|vienen|atiendo)|depende de la temporada|antes (venia|llegaba) mas gente|contesto cuando puedo/,
    bestMove:
      'Está soltando información — escalera SPIN sin interrogatorio (máx. 6-7 preguntas en toda la llamada): Problema ("¿le ha pasado que contesta el WhatsApp tarde y ya compraron en otro lado?") → Implicación con números ("¿cuántos se le van al mes: dos, cinco, diez? ¿y cuánto deja cada uno?") → multiplica EN VOZ ALTA ("5 por 40 son 200 al mes… 2,400 al año. ¿Le cuadra o me paso?"). Cuando admita el dolor con anécdota o número: DEJA de preguntar y pasa al pitch.',
  },
  {
    id: 'apertura',
    label: 'Apertura',
    emoji: '📞',
    priority: 35,
    cues: /^alo\b|hola,? buen(a|o)s|buenos dias|buenas tardes|quien habla|con quien (hablo|tengo el gusto)|que desea|que se le ofrece|como consiguio mi numero|quien le dio mi numero|es una venta|digame\b|si,? diga|si,? con el( mismo)?\b|con el mismo|el habla|ella habla|mucho gusto|para servirle/,
    bestMove:
      'Los primeros 12 segundos deciden la llamada — LA APERTURA MAESTRA en 4 tiempos: gancho de conocido + PAUSA real ("¡Don [nombre]! ¿Cómo le va?…"), la confesión ("no me conoce todavía — soy Martín, de ZerionStudio"), la razón con SU dato ("antes de marcarle lo busqué en Google como un cliente: tiene [4.8] estrellas… y cuando buscan su rubro, usted no aparece"), y el remate "¿usted sabía eso?" + SILENCIO. JAMÁS remates pidiendo permiso ("¿me regala 30 segundos?" = telemarketer educado). Si confirma que es el dueño ("sí, con él") → ventana de oro: lánzala YA, sin relleno. Si pregunta "¿es una venta?": "Es una llamada de negocio: creo que está perdiendo clientes en Google, y se lo puedo mostrar. ¿Le interesa saber qué encontré?" Energía arriba, cero "disculpe la molestia".',
  },
  {
    id: 'despedida',
    label: 'Despedida',
    emoji: '👋',
    priority: 30,
    cues: /que este bien|igualmente|gracias por llamar|buen dia entonces|buenas tardes entonces|nos vemos el|quedamos asi|ya quedamos|ahi hablamos|esperamos su mensaje|dale,? me avisa|bueno,? hablamos/,
    bestMove:
      'Antes de colgar, verifica el próximo paso: si NO quedó día y hora concretos, la llamada NO terminó. Recap de una frase + micro-compromiso: "Perfecto: jueves a las 3 en su local. Le mando ahorita la confirmación por WhatsApp — cuando le llegue, ¿me responde con un OK?" Y manda el WhatsApp en menos de 5 minutos (con el pedido del logo: desploma los plantones).',
  },
];

/**
 * Detecta el momento de la llamada según la última frase del prospecto.
 * Devuelve null si ninguna cue matchea (la conversación sigue su curso).
 */
export function detectMoment(text: string): MomentInfo | null {
  const t = normalizeSpeech(text);
  let best: MomentInfo | null = null;
  for (const m of MOMENTS) {
    if (m.cues.test(t) && (!best || m.priority > best.priority)) best = m;
  }
  return best;
}

/** Los momentos como guía de texto para el system prompt del coach. */
export function momentsForPrompt(): string {
  return MOMENTS.map((m) => `### ${m.emoji} ${m.label}\nMejor jugada: ${m.bestMove}`).join('\n\n');
}
