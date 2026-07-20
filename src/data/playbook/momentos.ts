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
  /** Variante si la hora de lectura AÚN no está amarrada (hoy solo despedida).
   *  Vive aquí — no en la UI — para que el playbook siga siendo la única
   *  fuente de verdad de las jugadas (sync:playbook la propaga al server). */
  bestMoveNoHora?: string;
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
      'UNA sola jugada de rescate y si no engancha, suelta con elegancia (quemas el prospecto de hoy, no el de 3 meses). Con dato SUYO: "Quince segundos y le dejo: usted tiene [200] reseñas y [4.8] estrellas, y cuando lo buscan en Google no sale. Su página ya está hecha — ¿se la mando por WhatsApp y la ve cuando pueda, o lo dejo ahí?" · "Estoy ocupado" → ruta express: "le mando el link ahorita y la ve en la noche en dos minutitos — yo le escribo mañana." · "No me interesa" firme → "Entiendo, y le dejo. Véala cuando pueda nomás — y si no le gusta, un no gracias por WhatsApp y no le molesto más." NUNCA ruegues ni aceleres el pitch — el segundo rescate seguido destruye la puerta futura.',
  },
  {
    id: 'cierre',
    label: 'Ya compró — CÁLLATE y agenda',
    emoji: '🤝',
    priority: 97,
    cues: /cuando (empezamos|empezariamos|podriamos empezar|arrancamos)|como le pago|como seria el pago|que necesitan? de mi|mandeme los datos|para el deposito|hagamoslo|hagamos eso|de una,? pues|dale pues|ya,? pues(?!,? ?(digame|cuenteme|hable|pero|no |lo voy|dejeme|tengo que))|listo,? (hagamos|mandame|de una)|(?<!no )(?<!no le )(?<!tampoco )(?<!ni )(?<!nada )me interesa|esta bien,? (hagamos|mandame|veamos)|de acuerdo(?!,? ?pero)|me parece bien(?!,? ?pero)|ahi nos vemos|venga y conversamos|el (lunes|martes|miercoles|jueves|viernes|sabado) (si )?puedo|cuando (estaria|esta|tendria) (lista )?(mi|la) pagina|cuando tenga la pagina/,
    bestMove:
      'YA COMPRÓ mentalmente: cada palabra de venta extra solo puede reabrir dudas. En el TOQUE 1: amarra link + hora en una frase y corta — "Perfecto: le mando el link ahorita mismo, ¿a este número? ¿Y a qué hora la alcanza a ver?" En el TOQUE 2 (ya la vio y dijo sí): cobra — "Excelente decisión. Le mando los datos — ¿maneja transferencia o De Una? — y hoy mismo queda oficial." Único agregado permitido tras el sí AL PAGO: el plan mensual opt-out ("el primer mes de mantenimiento va incluido… ¿lo dejamos activo?") y la LLAMADA DE ENTREGA amarrada antes de colgar ("mañana lo llamo dos minutitos para entregarle sus claves — ¿a las cinco le va bien?"). NUNCA menciones otra feature ni vuelvas a tocar el precio.',
  },
  {
    id: 'senal-compra',
    label: 'Señal de compra — CIERRA',
    emoji: '🟢',
    priority: 95,
    cues: /cuanto (cuesta|vale|sale|es(?! lo (menos|minimo))|cobran?|me sale|se demoran?)|que incluye|en cuanto tiempo|cuanto (tiempo )?se demoran?|estaria list[ao]|como seria|tienen ejemplos|trabajos (hechos|anteriores)|han trabajado con|donde puedo ver|me pueden poner (el menu|las fotos)|ustedes tambien manejan|y si despues quiero cambiar|suena (bien|interesante)|estaria bueno|le pago cuando (la vea|este|la tenga)|cuando este list[ao] le pago/,
    bestMove:
      'Dejó de evaluarte: está imaginándose CON la página. Responde en UNA frase y convierte en "se la mando ahorita": "Claro — y mejor que explicárselo, véala: ya está hecha, con sus reseñas, lista para mandarle clientes al WhatsApp. ¿Este número tiene WhatsApp? ¿A qué hora la alcanza a ver?" Si pregunta precio: de frente y de vuelta a la página — "Trescientos con IVA incluido, una sola vez. Pero no me crea a mí: véala primero y decide con la página en la mano." DOS señales seguidas y sigues explicando = estás matando la venta.',
  },
  {
    id: 'precio',
    label: 'Negociación de precio',
    emoji: '💰',
    priority: 90,
    cues: /(esta|es|muy|tan|que) car(o|a)|carisim|carito|cuanto es lo (menos|minimo)|cual es lo menos|hay descuento|descuentito|rebaj(a|ita|eme)|mas barato|no me alcanza|esta fuerte el precio|esta elevado|formas? de pago|se puede pagar|en cuotas|a credito|mensualidades|si pago de una|ultimo precio|ayudeme con el precio|el otro me cobra(ba)? menos/,
    bestMove:
      'NUNCA defiendas el precio ni lo bajes. Es UNO y se dice de frente: "trescientos con IVA incluido, con todo — se lo digo de frente porque aquí no hay letra chica. Una sola vez, no es mensualidad." Secuencia si objeta: acuerda ("le entiendo, trescientos de un solo no es cualquier cosa") → reduce al ridículo ("la página trabaja 24 horas — un solo cliente nuevo la paga") → la ÚNICA flexibilidad es de forma ("la mitad ahora y la mitad a fin de mes, ¿así sí le cuadra?"). El monto jamás baja. Tras decir el número: SILENCIO — el primero que habla, cede.',
  },
  {
    id: 'objecion',
    label: 'Objeción',
    emoji: '🛡️',
    priority: 80,
    cues: /(no|tampoco|ni) me interesa|no estoy interesad|no necesito|asi (estamos|estoy) bien|ya tengo (mi |una |la )?(pagina|web|facebook|face|instagram|quien)|mi (sobrino|hijo|hija|primo|hermano)|un (amigo|muchacho|conocido) me|no tengo tiempo|estoy ocupad|dejame pensarlo|lo voy a pensar|dejeme pensar|tengo que (consultar|hablar con|pensarlo)|lo consulto|manda(me)? (la )?info|mandeme (la |una )?(informacion|proforma|cotizacion)|con (el )?facebook|no necesito publicidad|me estafaron|puro cuento|no confio|esta dura la (cosa|situacion)|las ventas estan|temporada baja|mas barato|yo le aviso(?! que llam)|le aviso cualquier cosa/,
    bestMove:
      'Secuencia fija de la Línea Recta: 1) ACUERDA ("tiene toda la razón / le entiendo perfecto") — nunca contradigas ni digas "pero" de frente. 2) AÍSLA o deflecta ("¿es eso lo único que lo detiene?"). 3) Responde SOLO esa objeción con SU dato — todas las battlecards desembocan en "véala primero". 4) RE-PIDE el paso ("¿se la mando? ¿a qué hora la alcanza a ver?"). Máximo 2 loops y sueltas con el viernes ("la página queda prendida hasta el viernes; si se anima, un mensajito"). La battlecard te da la respuesta exacta.',
  },
  {
    id: 'gatekeeper',
    label: 'Gatekeeper — no es el dueño',
    emoji: '🚪',
    priority: 75,
    cues: /de parte de quien|quien l(o|a) (busca|llama)|de que empresa|para que lo (necesita|busca)|no se encuentra|no esta (el|la) (dueno|duena|doctor|ingeniero|senor|senora)|el dueno no (esta|viene)|esta ocupado atendiendo|le doy el recado|deje su (mensaje|numero)|dejeme su numero y el le|yo le aviso que llamo|yo solo trabajo aqui/,
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
      'Pidió el pitch — pero verifica el GATE: si aún no admitió ningún problema, UNA frase de sello antes ("O sea: hoy los clientes le llegan por recomendación y en Google no aparece… ¿así es?") y con su sí, LA REVELACIÓN demo-first con pausa de misterio antes de "ya está hecha": "Yo no le llamo a ofrecerle una página… le llamo porque su página YA ESTÁ HECHA — armada para que el que lo busca en Google le escriba directo a su WhatsApp. Y ojo — usted no ha contratado nada ni me debe nada: la hicimos por nuestra cuenta, como muestra, con sus reseñas. Está lista para que la vea ahorita desde su celular." (Sin pre-built: "mañana a esta misma hora le llega por WhatsApp, YA HECHA, sin que pague ni mueva un dedo.") Remata con el trato: "La ve con calma, y si no le gusta la borro. ¿Le parece justo?" PROHIBIDO: tecnicismos, precio antes de que la vea (si pregunta: de frente y de vuelta a la página), hablar mal de la competencia.',
  },
  {
    id: 'descubrimiento',
    label: 'Descubrimiento',
    emoji: '🔎',
    priority: 40,
    cues: /por recomendacion me llegan|puro boca a boca|la mayoria viene por|los clientes (me )?llegan|tenemos facebook nomas|el face casi no|puro whatsapp trabajo|el whatsapp lo contesto yo|pagina no (tengo|tenemos)|ni se como me encuentran|me preguntan si tengo pagina|se me pierden pedidos|no se mucho de (eso de )?internet|eso lo ve mi hija a veces|al mes (llegan|vienen|atiendo)|depende de la temporada|antes (venia|llegaba) mas gente|contesto cuando puedo/,
    bestMove:
      'Está soltando información — la matemática del dolor sin interrogatorio (máx. 6-7 preguntas en toda la llamada): Lo ya intentado ("¿y ya probó resolverlo — página, publicidad? ¿le funcionó?") → Problema ("¿le ha pasado que contesta el WhatsApp tarde y ya compraron en otro lado?") → Implicación con números ("¿cuántos se le van al mes: dos, cinco, diez? ¿y cuánto deja cada uno?") → multiplica EN VOZ ALTA ("5 por 40 son 200 al mes… 2,400 al año. ¿Le cuadra o me paso?") → el porqué del ahora ("¿y por qué le interesa resolverlo justo ahora?" — guarda su respuesta textual). Cuando admita el dolor con anécdota o número: SELLA en una frase ("o sea que… ¿así es?"), DEJA de preguntar y pasa al pitch.',
  },
  {
    id: 'apertura',
    label: 'Apertura',
    emoji: '📞',
    priority: 35,
    cues: /^alo\b|hola,? buen(a|o)s|buenos dias|buenas tardes|quien habla|con quien (hablo|tengo el gusto)|que desea|que se le ofrece|como consiguio mi numero|quien le dio mi numero|es una venta|digame\b|si,? diga|si,? con el( mismo)?\b|con el mismo|el habla|ella habla|mucho gusto|para servirle/,
    bestMove:
      'Los primeros 12 segundos deciden la llamada. Usa la apertura que dictó el briefing (A/B en prueba, AMBAS asuntivas — jamás "¿hablo con…?" ni pedir permiso): A — honestidad radical asuntiva: "¡Don [nombre]! ¿Cómo le va? … Martín, de ZerionStudio. Le soy honesto: esta es una llamada de ventas — y aun así le va a interesar, porque su página ya está hecha. ¿Sabía que en Google usted no aparece?" · B — la maestra: gancho de conocido + PAUSA ("¡Don [nombre]! ¿Cómo le va?…"), confesión ("no me conoce todavía — soy Martín, de ZerionStudio"), SU dato ENMARCADO EN ESTATUS si el rating es alto ("llamo solo a los mejor calificados de la zona — y con [4.8] estrellas ustedes están en esa lista… Y aun así no aparecen en Google") y "¿usted sabía eso?" + SILENCIO. El contraste con "Y", nunca "pero"; el estatus solo si la ficha confirma rating alto. Si confirma que es el dueño ("sí, con él") → ventana de oro: lánzala YA, sin relleno. Si pregunta "¿es una venta?": en la A ya lo dijiste; en la B: "Es una llamada de negocio: ya hicimos algo para su negocio y se lo puedo mostrar." Energía arriba, cero "disculpe la molestia".',
  },
  {
    id: 'despedida',
    label: 'Despedida',
    emoji: '👋',
    priority: 30,
    cues: /que este bien|igualmente|gracias por llamar|buen dia entonces|buenas tardes entonces|nos vemos el|quedamos asi|ya quedamos|ahi hablamos|esperamos su mensaje|dale,? me avisa|bueno,? hablamos/,
    bestMove:
      'Antes de colgar, verifica el próximo paso: si NO quedó la HORA a la que va a ver la página, la llamada NO terminó. Recap de una frase: "Perfecto: le mando el link ahorita mismo a este WhatsApp, usted la ve tipo [noche], y mañana a las nueve le escribo y me cuenta. ¿Estamos?" Y el WhatsApp SALE en menos de 5 minutos — la velocidad es tu primera prueba de seriedad. "Mándemela y yo le aviso" SIN hora = evasiva: pide la hora una vez más antes de soltar.',
    bestMoveNoHora:
      'NO CUELGUES SIN LA HORA — "Perfecto. Última cosita: ¿como a qué hora la alcanza a ver, para escribirle mañana sin caerle en mal momento?"',
  },
];

// ---------------------------------------------------------------------------
// Hora de lectura amarrada — el test de compromiso del T1.
// "Mándemela y yo le aviso" NO cuenta (es la antesala del ghosting, ver la
// battlecard yo-le-aviso): solo compromisos con verbo de VER + momento, o la
// respuesta corta y directa a "¿a qué hora la ve?" (solo el momento, sin verbo).
// ---------------------------------------------------------------------------
const NUM = String.raw`(?:\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)`;
const RE_HORA_FULL = new RegExp(
  String.raw`(la (veo|reviso|miro|checo)|alcanzo a ver(la)?|la puedo ver)\D{0,25}(en la (noche|tarde|manana)|al mediodia|al almuerzo|tipo ${NUM}|como a las ${NUM}|a las ${NUM}|despues de las ${NUM})` +
    String.raw`|(en la (noche|tarde|manana)|tipo ${NUM}|como a las ${NUM}|a las ${NUM})\D{0,15}la (veo|reviso|miro|checo)`
);
const RE_HORA_SHORT = new RegExp(
  String.raw`^(si,? )?(de pronto |quizas )?(hoy |esta )?(en la (noche|tarde|manana)|al mediodia|como a las ${NUM}|a las ${NUM}|tipo ${NUM})( (esta bien|puede ser|me cuadra|de pronto|si puedo))?$`
);

/** ¿Esta frase del prospecto amarra la hora de lectura? (texto ya crudo; se normaliza aquí) */
export function detectHora(text: string): boolean {
  const t = normalizeSpeech(text).trim();
  return RE_HORA_FULL.test(t) || (t.length <= 45 && RE_HORA_SHORT.test(t));
}

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
  return MOMENTS.map(
    (m) =>
      `### ${m.emoji} ${m.label}\nMejor jugada: ${m.bestMove}` +
      (m.bestMoveNoHora ? `\nSi la hora de lectura AÚN no está amarrada: ${m.bestMoveNoHora}` : '')
  ).join('\n\n');
}
