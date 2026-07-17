// ============================================================================
// Sales Playbook — la base de conocimiento del Copilot.
//
// Metodologías destiladas (Straight Line de Jordan Belfort, 10X/cierres de
// Grant Cardone, SPIN Selling, Challenger) aplicadas a UN caso de uso:
// venderle desarrollo web + automatizaciones a negocios locales por teléfono.
//
// Este módulo alimenta:
//  • el system prompt del coach (playbookForPrompt) — se cachea por llamada
//  • las battlecards instantáneas del cliente (detectObjection, sin LLM)
//  • el briefing pre-llamada del modo mock
// Fase 2 lo vuelve editable por industria desde el CRM.
// ============================================================================

export interface Battlecard {
  id: string;
  /** Frases (normalizadas, sin acentos, lowercase) que disparan la card. */
  triggers: RegExp;
  objection: string;
  /** Respuesta lista para decir, 2-4 frases, español neutro. */
  response: string;
  /** El principio detrás, para que el vendedor entienda el porqué. */
  why: string;
}

// ---------------------------------------------------------------------------
// Principios (los "libros" en versión operativa)
// ---------------------------------------------------------------------------
export const PRINCIPLES = `
## Línea Recta (Jordan Belfort)
- La venta avanza en línea recta: apertura → rapport → descubrimiento → presentación → cierre. Cada respuesta del prospecto o te acerca o te desvía; si te desvía, reconoce y vuelve a la línea ("Entiendo, y justo por eso le llamaba…").
- Las 3 certezas: el prospecto compra cuando está seguro de (1) el producto, (2) tú, (3) tu empresa. Si un cierre falla, detecta cuál de las 3 falta y trabájala en un "loop": responde la objeción, re-presenta valor, vuelve a cerrar.
- La tonalidad vende más que las palabras: seguro, entusiasta y escaso de tiempo (tú también estás ocupado). Nunca suenes necesitado ni leas un guión.
- Primeros 4 segundos: debes sonar (1) agudo como un cuchillo (experto), (2) entusiasta, (3) una autoridad. Si pierdes los primeros 4 segundos, pierdes la llamada.

## Grant Cardone (10X / Sell or Be Sold)
- SIEMPRE acuerda primero. Nunca contradigas: "Tiene toda la razón…", "Entiendo perfecto…", y LUEGO redirige. El acuerdo desarma; la discusión pierde ventas.
- El precio nunca es el problema real: es certeza de valor. Si dicen "caro", no bajes el precio — sube el valor (qué gana, qué pierde por no tenerlo).
- El seguimiento es donde está el dinero: la mayoría de ventas caen entre el contacto 5 y 12. Nunca cuelgues sin un próximo paso CONCRETO con fecha y hora.
- Trata cada llamada como si el negocio dependiera de ella. Velocidad y volumen: la siguiente llamada empieza en cuanto termina esta.

## SPIN (descubrimiento)
- Situación: "¿Cómo consiguen clientes nuevos hoy?" / "¿Cuánto llega por recomendación vs gente nueva?"
- Problema: "¿Qué pasa cuando alguien los busca en Google y no los encuentra?" / "¿Cuántas llamadas pierden fuera de horario?"
- Implicación: "Si un cliente nuevo vale $X y se pierden 5 al mes, son $X×5 cada mes que se lleva el negocio de al lado…"
- Necesidad: "Si le llegaran clientes desde Google sin mover un dedo, ¿qué significaría para el negocio?" — que ÉL diga el beneficio.
- Regla: el que pregunta controla. 2 preguntas antes de cada afirmación. Nunca presentes precio antes de haber cuantificado el problema.

## Challenger
- Enseña algo que no sabía: "El 70% de la gente busca en Google antes de llamar; si no está ahí, ese cliente ya fue de su competencia."
- Personaliza con SUS datos (rating, reseñas, si no tiene web — está en la ficha del lead).
- Toma control con calma: propone tú el siguiente paso, no preguntes "¿qué le parece?" sino "Le propongo esto: …".
`.trim();

// ---------------------------------------------------------------------------
// Apertura de llamada en frío (negocios locales)
// ---------------------------------------------------------------------------
export const OPENERS = `
## Apertura (cold call a negocio local)
1. Nombre + nombre del negocio + honestidad: "Hola, ¿hablo con el dueño de [negocio]? Le habla [nombre] de ZerionStudio. Le soy honesto: es una llamada comercial, ¿me regala 30 segundos y usted decide si vale la pena?" (el permiso desarma).
2. El gancho con SU dato: "Los encontré en Google Maps — tienen [rating]⭐ con [N] reseñas, se nota que trabajan bien. Lo que me llamó la atención es que NO tienen página web, y con esas reseñas están dejando plata en la mesa."
3. Puente a descubrimiento: "¿Hoy cómo les llega la gente nueva, puro boca a boca?"
- Si contesta un empleado: "¿A qué hora encuentro a [dueño]? ¿De parte de quién le digo que…? Perfecto, le llamo a las X" — consigue nombre y hora, no pitchees al empleado.
- Buzón de voz: mensaje de 15s: nombre, "les encontré en Google Maps, tengo un dato de su negocio que les interesa, les llamo mañana a las X" — genera curiosidad, no vendas.
`.trim();

// ---------------------------------------------------------------------------
// Cierres
// ---------------------------------------------------------------------------
export const CLOSES = `
## Señales de compra (cierra AL INSTANTE cuando escuches)
"¿cuánto cuesta?" · "¿qué incluye?" · "¿cuánto se demoran?" · "¿y cómo sería?" · "déjame ver…" · preguntas sobre plazos, formas de pago, ejemplos de trabajos.
Cuando hay señal: DEJA de presentar y cierra. Vender de más mata ventas.

## Cierres probados
- Alternativa (el mejor para agendar): "¿Le queda mejor mañana a las 10 o el jueves a las 3?" — nunca preguntes SI quiere, pregunta CUÁNDO.
- Resumen de valor: "Quedamos así: página lista en 2 semanas, aparece en Google, los clientes le escriben directo al WhatsApp. ¿Arrancamos?"
- Cardone (asumido): "Lo que haría hoy es dejarle apartado el espacio de este mes; el diseño se lo muestro el viernes y si no le encanta, no pasa nada. ¿Le parece?"
- Escasez honesta (solo si es verdad): "Este mes tomo 3 proyectos para entregarlos bien; me queda 1 espacio."
- Riesgo cero: "Primero le muestro el diseño; si no le gusta, no paga nada. Usted solo pierde 20 minutos viendo cómo quedaría su negocio en internet."
`.trim();

// ---------------------------------------------------------------------------
// Battlecards de objeciones (respuesta instantánea, sin esperar al LLM)
// ---------------------------------------------------------------------------
export const BATTLECARDS: Battlecard[] = [
  {
    id: 'no-interesa',
    triggers: /no me interesa|no estoy interesad|no gracias|no necesito nada|no quiero nada/,
    objection: '"No me interesa"',
    response:
      'Le entiendo perfectamente, y seguro recibe mil llamadas. Solo un dato antes de colgar: 7 de cada 10 clientes nuevos buscan en Google antes de llamar — y hoy, cuando lo buscan a usted, aparece su competencia. ¿Me regala 20 segundos para decirle qué encontré de su negocio?',
    why: 'Cardone: acuerda primero, nunca discutas. Belfort: el "no me interesa" en frío es reflejo, no decisión — gana 20 segundos con un dato SUYO.',
  },
  {
    id: 'caro',
    triggers: /caro|carisimo|mucha plata|mucho dinero|no tengo (para|plata|dinero)|no hay (plata|presupuesto)|esta fuera de (mi )?presupuesto|cuesta mucho/,
    objection: '"Está caro / no tengo presupuesto"',
    response:
      'Tiene razón en cuidar cada dólar, así se maneja un negocio. Déjeme ponerlo así: ¿cuánto le deja un cliente nuevo? Si la página le trae UN cliente al mes, ya se pagó sola — todo lo demás es ganancia. Y lo dividimos en pagos para que ni lo sienta. ¿Cuánto vale un cliente para usted?',
    why: 'Cardone: el precio es falta de certeza de valor. Regresa el foco al retorno con SUS números (SPIN de implicación).',
  },
  {
    id: 'ya-tengo',
    triggers: /ya tengo (pagina|web|sitio|quien)|ya trabajo con|mi sobrino|un amigo (me la|la) (hace|hizo|maneja)|ya me la estan haciendo/,
    objection: '"Ya tengo página / alguien me la maneja"',
    response:
      'Qué bueno, eso dice que usted ya sabe que esto importa. Le propongo algo sin compromiso: la reviso gratis y le mando 3 cosas que yo mejoraría para que le traiga más clientes. Si su persona actual las puede hacer, perfecto — usted gana igual. ¿Se la mando por WhatsApp?',
    why: 'Challenger: no ataques al proveedor actual (defendería su decisión). Aporta valor gratis y siembra la duda con hechos.',
  },
  {
    id: 'facebook',
    triggers: /tengo (facebook|instagram|redes)|con (el )?facebook me (va|funciona)|(facebook|instagram) me basta|puro (facebook|instagram|whatsapp)/,
    objection: '"Con Facebook/Instagram me basta"',
    response:
      'Las redes están perfectas y hay que seguirlas usando. El detalle: en redes usted le habla a quien ya lo conoce. En Google lo busca gente que NECESITA su servicio HOY y no conoce a nadie — esa es la que está perdiendo. La página no reemplaza sus redes, le suma el canal donde está la gente con la billetera en la mano.',
    why: 'Acuerda primero (las redes sirven), luego enseña la diferencia intención de búsqueda vs. alcance social (Challenger).',
  },
  {
    id: 'mandame-info',
    triggers: /manda(me)? (la )?info|enviame (la )?informacion|mandame algo por (whatsapp|correo)|escribeme (por whatsapp|al correo)|pasame (la )?informacion/,
    objection: '"Mándame la información"',
    response:
      'Con gusto se la mando. Ahora, para no mandarle un PDF genérico que nadie lee: ¿qué es lo que más le interesa — que lo encuentren en Google, o automatizar las citas/pedidos? … Perfecto, le mando eso puntual y lo llamo mañana a esta misma hora para ver qué le pareció. ¿Le sirve?',
    why: '"Mándame info" suele ser un no disfrazado. Belfort: haz una pregunta para re-enganchar, y NUNCA sueltes el seguimiento sin fecha y hora (Cardone).',
  },
  {
    id: 'no-tiempo',
    triggers: /no tengo tiempo|estoy ocupad|ando ocupad|estoy atendiendo|llamame (luego|despues|mas tarde)|ahorita no puedo/,
    objection: '"No tengo tiempo / estoy ocupado"',
    response:
      'Le entiendo, y justo por eso le va a gustar esto: la página trabaja para que usted NO tenga que estar en todo. Le robo 15 segundos: [dato del negocio]. ¿Le llamo hoy a las 6 o mañana a las 9 y le cuento en 5 minutos?',
    why: 'Respeta el tiempo, deja un gancho, y cierra con alternativa de horario — nunca con "¿cuándo puede?"',
  },
  {
    id: 'pensarlo',
    triggers: /dejame pensarlo|lo voy a pensar|dejeme pensar|tengo que pensarlo|lo consulto|tengo que hablar con/,
    objection: '"Déjame pensarlo / lo consulto"',
    response:
      'Claro, es una decisión de negocio y se piensa. Para ayudarle a pensarlo bien: ¿qué es lo que le hace dudar — la inversión, o si de verdad le va a traer clientes? … [responde esa duda]. Hagamos esto: le preparo el diseño de muestra SIN costo y el jueves lo ve con calma. Así piensa con algo concreto en la mano. ¿Jueves a las 10 o a las 4?',
    why: 'Belfort: "pensarlo" = falta una de las 3 certezas. Aísla la objeción real, respóndela, y deja un próximo paso concreto.',
  },
  {
    id: 'desconfianza',
    triggers: /quien (es usted|eres|habla)|como se yo|sera (estafa|verdad)|no los conozco|de donde (me )?llaman|numero desconocido/,
    objection: 'Desconfianza / "¿quién eres?"',
    response:
      'Excelente pregunta, y hace bien en preguntarla. Soy [nombre] de ZerionStudio — desarrollamos páginas web para negocios como el suyo. Puede vernos en [sitio/Instagram]. Y por eso mismo propongo empezar sin riesgo: primero le muestro el diseño de SU página y usted decide viendo, no creyendo.',
    why: 'Certeza #2 y #3 de Belfort (confianza en ti y tu empresa). Prueba social + riesgo cero.',
  },
  {
    id: 'mal-momento',
    triggers: /las ventas estan (bajas|malas)|esta (dura|mala) la (cosa|situacion)|la economia|ahorita no|quiza(s)? (luego|despues|el proximo)|el (otro|proximo) (mes|ano)/,
    objection: '"Ahorita no / la situación está dura"',
    response:
      'Justo por eso le llamo ahora y no en diciembre: cuando las ventas están flojas es cuando más duele cada cliente que se va con la competencia. La página está trabajando en 2 semanas — los que la montan cuando está dura la cosa son los que recogen cuando se mueve. Y empezamos con un plan chico, sin ahorcarse.',
    why: 'Challenger: reencuadra el mal momento como LA razón para actuar. Cardone: en crisis, el que avanza gana el mercado.',
  },
];

// ---------------------------------------------------------------------------
// Detección instantánea (cliente, sin LLM)
// ---------------------------------------------------------------------------
/** Normaliza para matching: lowercase + sin acentos. */
export const normalizeSpeech = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Devuelve la battlecard si el texto contiene una objeción conocida. */
export function detectObjection(text: string): Battlecard | null {
  const t = normalizeSpeech(text);
  for (const card of BATTLECARDS) {
    if (card.triggers.test(t)) return card;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Playbook completo como texto para el system prompt del coach
// ---------------------------------------------------------------------------
export function playbookForPrompt(): string {
  const cards = BATTLECARDS.map(
    (c) => `### ${c.objection}\nRespuesta: ${c.response}\nPrincipio: ${c.why}`
  ).join('\n\n');
  return [
    PRINCIPLES,
    OPENERS,
    CLOSES,
    '## Manejo de objeciones (responde con estas líneas, adaptadas al contexto)',
    cards,
  ].join('\n\n');
}
