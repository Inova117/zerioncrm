// ============================================================================
// Battlecards — respuesta instantánea a objeciones (sin esperar al LLM).
//
// Síntesis de la investigación profunda: cada card combina lo mejor de
// Cardone (acordar primero), Voss (etiqueta + calibrada), Belfort (deflector
// + loop) y el conocimiento del nicho (vender web a negocios locales latinos).
// Los triggers usan el habla REAL de un dueño de negocio por teléfono
// (normalizados: lowercase, sin acentos — ver normalizeSpeech).
// ============================================================================

export interface Battlecard {
  id: string;
  /** Frases (normalizadas, sin acentos, lowercase) que disparan la card. */
  triggers: RegExp;
  objection: string;
  /** Respuesta lista para decir en voz alta, español latino. */
  response: string;
  /** El principio detrás, para que el vendedor entienda el porqué. */
  why: string;
}

// El orden importa: la primera card que matchea gana (las más específicas van
// antes que las genéricas que comparten palabras).
export const BATTLECARDS: Battlecard[] = [
  {
    id: 'regateo',
    triggers:
      /hagame un descuent|descuentito|rebaj(a|e|ita)|en cuanto me lo deja|ultimo precio|ayudeme con el precio|hay descuento|si pago de una|deme un mejor precio/,
    objection: 'Regateo: "hágame un descuentito"',
    response:
      'Buena pregunta. ¿Y cómo hago yo para darle la página completa a ese precio? … Mejor hagamos esto: la mitad ahora y la mitad cuando la vea funcionando — o ajustamos qué incluye. ¿Cuál le cuadra?',
    why: 'El "¿cómo hago yo…?" (Voss) lo pone en tus zapatos sin confrontar. Nunca bajes el precio sin cambiar nada: cambia alcance o términos — bajar "porque sí" le enseña que tu precio era mentira.',
  },
  {
    id: 'caro',
    triggers:
      /\bcar(o|os|isimo|ito)\b|mucha plata|mucho dinero|no me alcanza|fuerte el precio|esta elevado|cuesta mucho|un ojo de la cara|no tengo (para|plata|dinero)|no hay (plata|presupuesto)|fuera de (mi )?presupuesto|no estoy para (esos )?gastos|es mucho eso/,
    objection: '"Está caro / no tengo presupuesto"',
    response:
      'Tiene toda la razón, no es barato — y justo por eso funciona. Le pregunto: ¿caro comparado con qué? ¿Cuánto le deja un cliente nuevo? Porque si la página le trae dos al mes, se pagó sola. Y se puede partir: la mitad para arrancar y la otra cuando esté lista y a usted le guste.',
    why: 'Cardone: acuerda primero y NUNCA defiendas el precio — cuantifica el costo de NO comprar con SUS números. Cede en términos (pago partido), jamás en precio. Y tras decir un precio: SILENCIO, el primero que habla cede.',
  },
  {
    // Antes que 'sobrino': "un muchacho me lo hace a mitad de precio" es
    // objeción de PRECIO contra fantasmas, no de familiar.
    id: 'mas-barato',
    triggers:
      /(el otro|otros?|un muchacho) me (cobra|cobraba|ofrecio|lo hace) (menos|mas barato|a mitad)|mas barato|a mitad de precio|lo hace en cien|en marketplace sale|cobran menos|hay quien lo hace/,
    objection: '"Otro me lo hace más barato"',
    response:
      'Seguro que sí — siempre hay más barato, como en todo… usted también tiene competencia que cobra menos que usted, ¿verdad? La pregunta es: ¿esa página le va a traer clientes, o solo va a existir? Déjeme mostrarle la diferencia con ejemplos reales: ¿mañana o el jueves?',
    why: 'No pelees precio contra fantasmas: mueve la conversación a resultados y a la cita. "Como en todo" conecta con su propia experiencia de competir contra baratos — el mismo argumento que él usa a diario para defender su precio.',
  },
  {
    id: 'sobrino',
    triggers:
      /mi (sobrino|hijo|hija|primo|hermano|pana)( me| sabe| maneja| hace| hizo| esta| la| lo)|un (amigo|muchacho|conocido|pana)( que)? me (la |lo )?(hace|hizo|esta haciendo|ayuda|maneja|ve|iba a hacer)|ya tengo quien|ya contrate a alguien|ya estoy en eso con alguien|mi disenador|un conocido que me ayuda/,
    objection: '"Mi sobrino/hijo/amigo me hace la página"',
    response:
      '¡Qué bueno, así no empieza de cero — y eso me dice que usted ya sabe que la necesita! Solo por curiosidad: ¿hace cuánto quedó en hacérsela? ¿Ya aparece en Google? … Hagamos algo justo: le mando gratis una muestra de cómo la haríamos nosotros, se la enseña a él, y deciden con las dos en la mano. No pierde nada.',
    why: 'JAMÁS compitas contra la familia — pierdes siempre. "¿Hace cuánto quedó?" hace que ÉL mismo diga "uy, ya va un año": la objeción se derrumba sola. La muestra "para enseñársela" te alía con la familia en vez de atacarla.',
  },
  {
    id: 'ya-tengo-pagina',
    triggers:
      /ya (tengo|tenemos) (mi |una |la )?(pagina|web|sitio)|eso ya lo hicimos|ya me hicieron una|si tenemos web|ahi esta la pagina|ya trabajo con (una agencia|alguien)/,
    objection: '"Ya tengo página web"',
    response:
      '¡Qué bueno, eso ya es ventaja! Y dígame honestamente: ¿le llegan clientes por ahí, o está más de adorno? … Se lo pregunto porque a la mayoría le pasa lo segundo. Le hago una revisión gratis: cinco puntos concretos de qué está frenando su página, y usted decide qué hacer con eso — hasta se la puede pasar a quien se la maneja.',
    why: '"¿Le llegan clientes o está de adorno?" desnuda el problema con humor, sin insultar su página. La revisión gratis cambia la oferta de "hacer una página" a "arreglar la suya" — y agenda la misma cita.',
  },
  {
    id: 'facebook',
    triggers:
      /(tengo|con el|con mi|puro|por) (facebook|face|instagram|insta)( me| nomas| y)?|me escribe(n)? por (el )?(face|instagram|insta|messenger)|publico en (el |mi )?(face|facebook|instagram)|para eso tengo (las redes|el whatsapp)|(facebook|instagram|las redes) me (basta|va bien|funciona)|manejo todo por (el )?(face|facebook|instagram|whatsapp)|puro whatsapp trabajo/,
    objection: '"Con Facebook/Instagram me basta"',
    response:
      'Y eso está perfecto — no lo deje, es la mitad del trabajo. Solo fíjese en un detalle: cuando alguien que NO lo conoce busca su rubro en Google, su Facebook no aparece — aparecen sus competidores. Las redes son para los que ya lo conocen; la página agarra a los que lo buscan HOY con la plata en la mano, y los manda directo a su WhatsApp.',
    why: 'Valida primero (las redes fueron SU decisión — atacarlas es atacarlo). El dato es verificable por él en 10 segundos y le revela un hueco que no sabía que tenía. No es "redes O página": es "redes Y página".',
  },
  {
    id: 'mandame-info',
    triggers:
      /mand(a|e)(me|n)? (la |una |el |algo |todo )?(info|informacion|proforma|cotizacion|detalle|precios)|pas(a|e)(me)? (la |una |todo )?(info|informacion|cotizacion)|escrib(a|e)(me)? (mejor|al correo)|por (whatsapp|correo|interno) (y yo le aviso|mejor)|dej(a|e)(me)? (tu|su) numero y yo/,
    objection: '"Mándame la información" (el adiós educado)',
    response:
      'Claro que sí, ahorita mismo le mando. Pero no le quiero mandar un catálogo genérico que nadie lee: mejor le preparo la muestra de cómo se vería SU página, con su nombre y sus colores. ¿La revisamos juntos el jueves en la tarde o el viernes en la mañana? Son 10 minutos.',
    why: '"Mándame info" sin cita = lead muerto en el 95% de los casos. Acepta (nunca pelees), sube la apuesta a la muestra personalizada CON fecha de revisión, y manda algo por WhatsApp en menos de 5 minutos: la velocidad es tu primera prueba de seriedad.',
  },
  {
    id: 'no-tiempo',
    triggers:
      /no tengo tiempo|estoy ocupad|ando (ocupad|full|a mil|de carrera)|estoy (atendiendo|en algo|con un cliente|con un paciente|con gente|en la cocina|vendiendo)|llam(a|e)(me)? (luego|despues|mas tarde|la otra semana)|ahorita no puedo|justo estoy saliendo/,
    objection: '"No tengo tiempo / estoy ocupado"',
    response:
      'Le entiendo perfecto — se nota que el negocio se mueve, y por eso no le robo ni un minuto ahora. Solo dígame: ¿le llamo hoy a las 4 o mañana a las 10? Son 10 minutos cronometrados, y corto yo.',
    why: 'Es la objeción más honesta del nicho: de verdad está atendiendo. Pelearla es suicidio; la alternativa doble convierte el "luego" eterno en hora exacta. Y llámalo A ESA HORA EN PUNTO: la puntualidad es tu primer cierre.',
  },
  {
    id: 'pensarlo',
    triggers:
      /dejame pensarlo|lo voy a pensar|dejeme pensar|tengo que pensarlo|deme unos dias|con la almohada|dejeme analizarlo|dejeme verlo con calma|mas adelante (vemos|quizas)|despues vemos/,
    objection: '"Déjame pensarlo"',
    response:
      'Le entiendo perfecto, y está bien pensarlo… pero déjeme hacerle una sola pregunta: la idea como tal, ¿le gusta? Que lo encuentren en Google y le escriban solos. … Perfecto. ¿Y qué le hace dudar: el precio, o si de verdad le va a traer clientes? Cualquiera de las dos se la aclaro en un minuto.',
    why: 'Belfort: "pensarlo" es cortina de humo — falta una de las 3 certezas. El deflector ("¿le gusta la idea?") mide el producto sin pelear; la binaria fuerza la objeción real, que sí se puede cerrar. Solo la incertidumbre se piensa; la certeza se firma.',
  },
  {
    id: 'consultar',
    triggers:
      /(hablar|consultar|ver|conversar)(lo)? con mi (esposa|esposo|senora|socio|hermano|hijo|hija|familia)|eso lo ve mi (esposa|senora|socio|hijo|hija|hermano)|no decido (eso )?(yo )?solo|lo converso en casa|dejeme comentarle a|preguntarle al que me lleva|la que decide (esas cosas )?es mi/,
    objection: '"Tengo que consultarlo con mi esposa/socio"',
    response:
      'Perfecto, así debe ser — esas decisiones se toman juntos. Para que no le toque a usted explicar todo de memoria, hagamos una de dos: les explico a los dos en cinco minutos, o le mando la muestra por WhatsApp para que la vean juntos con calma y hablamos el jueves. Y dígame, ¿a ella qué cree que le va a parecer?',
    why: 'Nunca dejes que el prospecto venda por ti: vende peor y sin convicción. Valida la dinámica familiar (sagrada en negocios locales), pide acceso al decisor o arma al mensajero con la muestra. "¿Qué cree que le va a parecer?" revela si era excusa: si titubea, la objeción real es otra.',
  },
  {
    id: 'desconfianza',
    triggers:
      /quien (es usted|eres|habla|los conoce)|no los conozco|de donde (me )?llama|sera estafa|no sera estafa|me estafaron|puro cuento|no confio|numero desconocido|esto es serio|sinverguenza|ya me han (llamado|ofrecido) (con )?eso( mismo)?|eso mismo me dijeron|como se yo|no hago tratos por telefono/,
    objection: 'Desconfianza / "¿y ustedes quiénes son?"',
    response:
      'Hace muy bien en desconfiar — hay mucho vendedor de humo llamando. Soy Martín, fundador de ZerionStudio, aquí mismo en Ecuador, y por eso no le pido ni un dólar hoy: le mando ahorita por WhatsApp trabajos nuestros y el número de un cliente para que le pregunte directo. Usted decide viendo, no creyendo. ¿A este número se lo mando?',
    why: 'Acordar con la desconfianza te separa del estafador — defenderte te iguala a uno. Prueba verificable EN VIVO (no adjetivos como "somos serios") + riesgo cero es la única moneda que compra confianza en frío. Confirmar el número regala un micro-sí y deja tu WhatsApp en su teléfono.',
  },
  {
    id: 'ventas-flojas',
    triggers:
      /ventas estan (bajas|flojas|malas)|esta (dura|dificil|lenta|muerta) la (cosa|situacion)|esta muerto el negocio|la economia|temporada baja|apenas (estamos )?sobreviviendo|este mes (ando|vengo) (corto|apretado)|estamos apretados|con esta economia|el (otro|proximo) (mes|ano) (vemos|hablamos|quizas)/,
    objection: '"Las ventas están flojas / la situación está dura"',
    response:
      'Le creo, así está para muchos — y justamente por eso lo llamo: cuando las ventas están flojas es cuando más duele que el cliente que SÍ está buscando termine donde la competencia. Empecemos por lo que no cuesta nada: le hago la muestra gratis, la ve y decide sin presión. Y si arrancamos, se parte en pagos para que no le pese.',
    why: 'El judo clásico: la razón del no ES la razón del sí — en vaca flaca necesita clientes más que nunca. El primer paso gratis elimina el conflicto con la caja vacía; los términos flexibles hacen el resto.',
  },
  {
    id: 'recomendacion',
    triggers:
      /por recomendacion|boca a boca|boca en boca|mis clientes (ya )?me conocen|mi clientela (ya )?me conoce|todos me conocen|no necesito publicidad|asi he trabajado toda la vida|son (de aqui )?del barrio|la gente (ya )?sabe donde|me recomiendan/,
    objection: '"Trabajo por recomendación, no necesito eso"',
    response:
      'Y eso habla excelente de su trabajo — la recomendación no se compra, y eso nadie se lo quita. Ahora fíjese qué hace hoy el recomendado ANTES de llamarlo: lo busca en Google. Si no encuentra nada, esa recomendación se enfría y se va donde el que sí aparece. La página no reemplaza su boca a boca: lo remata.',
    why: 'Es la objeción de ORGULLO: atacarla es atacar su trayectoria. Móntate encima: "el recomendado te googlea primero" es algo que él mismo hace cuando le recomiendan algo — no lo puede negar. Dale un lugar a su orgullo dentro de tu solución.',
  },
  {
    id: 'no-interesa',
    triggers:
      /(no|tampoco|ni) me interesa|no estoy interesad|no,? gracias|no necesito (nada|eso)|no quiero nada|asi (estamos|estoy) bien|estamos bien asi|eso no es para mi|no estoy buscando eso/,
    objection: '"No me interesa"',
    response:
      'Le entiendo — yo contesto igual cuando no sé de qué se trata. Una sola pregunta y le dejo tranquilo: cuando un cliente lo busca en Google, ¿usted aparece? … Porque yo lo busqué antes de llamarlo, y le cuento lo que encontré si me regala un minuto.',
    why: 'El "no me interesa" en los primeros segundos es REFLEJO, no decisión: aún no sabe qué rechaza. Empatiza (nunca pelees) y reabre con la pregunta que solo él puede responder + el gancho de "yo ya lo busqué". Si repite el no, agradece y suelta con fecha: ese sí es real.',
  },

  // --- Preguntas trampa del producto (matan la confianza si titubeas) ------
  {
    id: 'garantia-google',
    triggers:
      /me (garantiza|asegura) (que )?(salgo|aparezco|me encuentren)|salgo primer(o|ito)|aparezco de primero|puesto uno en google|numero uno en google/,
    objection: '"¿Me garantiza que salgo primero en Google?"',
    response:
      'El que le promete salir número uno mañana le está mintiendo — y usted ya sabe cómo terminan esos cuentos. Lo que sí le garantizo, y se lo muestro medible cada mes, es aparecer cuando lo busquen en su zona, con mapa y WhatsApp listos para que le escriban. Haga la prueba ahorita: busque su rubro en Google y vea quién le está ganando esos clientes hoy.',
    why: 'La pregunta más peligrosa: prometer el #1 es mentir (te iguala al estafador anterior); desinflarte pierde la venta. Honestidad guionada + garantía verificable (reporte mensual) + experimento en vivo.',
  },
  {
    id: 'tiempo-google',
    triggers:
      /en cuanto tiempo (aparezco|salgo|me ven)|cuando salgo en google|demora en verse|cuando me (empiezan a )?(encuentran|encuentren|buscan)|cuanto tarda en aparecer/,
    objection: '"¿En cuánto tiempo salgo en Google?"',
    response:
      'La página queda lista en dos semanas, y desde ese día ya lo encuentran por su nombre y en el mapa. Aparecer cuando buscan el servicio en su zona toma entre uno y tres meses, y cada mes le muestro el avance en un reporte que se entiende de un vistazo. Desconfíe del que le diga "mañana" — ya sabe por qué.',
    why: 'Trampa de tiempos: prometer de más revienta a los 30 días; ser vago suena a evasiva. Números honestos y escalonados (nombre YA / zona en 1-3 meses) = expectativa que puedes cumplir y superar.',
  },
  {
    id: 'dominio-mio',
    triggers:
      /queda a mi nombre|el dominio es mio|la pagina es mia|quien queda como dueno|dueno de la pagina|es mia o suya/,
    objection: '"¿La página y el dominio quedan a mi nombre?"',
    response:
      'Todo queda a su nombre: el dominio se registra con sus datos y le entrego las claves por escrito — como las escrituras de una casa. Yo soy el arquitecto, pero la casa es suya. Si mañana quiere trabajar con otra persona, se la lleva completa y aquí no ha pasado nada.',
    why: 'Es el miedo a la estafa clásica del vendedor que secuestra dominios. La analogía casa/escrituras hace tangible la propiedad digital, y ofrecer tú mismo la salida elimina la última desconfianza.',
  },
  {
    id: 'dejo-de-pagar',
    triggers:
      /si dejo de pagar|si no pago el mensual|me la quitan|pierdo la pagina|me van a dejar botado|si ya no sigo con ustedes/,
    objection: '"¿Y si dejo de pagar el mantenimiento, pierdo todo?"',
    response:
      'No pierde nada: la página y el dominio siguen siendo suyos y siguen funcionando. El mantenimiento es como el del carro — sin él, el carro sigue siendo suyo y sigue andando; solo que ya nadie le hace los cambios ni le responde si algo falla. Y no hay contrato de permanencia: usted se queda porque le sirve, no porque está amarrado.',
    why: 'Propiedad sin salida libre no tranquiliza a nadie. La analogía del carro explica el plan mensual sin tecnicismos, y "se queda porque le sirve" voltea la relación a tu favor.',
  },
  {
    id: 'automatizacion',
    triggers:
      /eso de las automatizaciones|automati ?que|con que se come|que es eso de (la |las )?automatiza/,
    objection: '"¿Y eso de las automatizaciones qué es?"',
    response:
      'Se lo pongo con su negocio: son las nueve de la noche y alguien le escribe al WhatsApp preguntando precios. Hoy ese mensaje espera hasta mañana — y ese cliente ya le compró a otro. Con la automatización, el WhatsApp contesta solo, al instante, con sus precios y horarios, y a usted le llega el cliente ya listo para agendar.',
    why: 'Jamás definas con tecnicismos ("software", "bot", "IA"): siempre UNA escena de SU rubro con hora concreta y plata perdida/ganada. La escena vende lo que la definición espanta.',
  },
  {
    id: 'no-entiendo-computadoras',
    triggers:
      /no entiendo (nada )?de computadoras|yo de esas cosas no se|quien (me )?la maneja despues|quien la mueve luego|yo no se de (internet|tecnologia|esas cosas)/,
    objection: '"Yo no entiendo de computadoras, ¿quién la maneja?"',
    response:
      'Esa es la mejor parte: usted no tiene que manejar nada — para eso me paga. Usted atiende su negocio y los clientes le llegan al WhatsApp que ya sabe usar. Si quiere cambiar algo, me manda un mensaje: "súbeme el precio del corte", y yo lo hago ese mismo día. ¿Sabe usar WhatsApp? Entonces ya sabe todo lo que necesita.',
    why: 'Es miedo a hacer el ridículo disfrazado de objeción. "Yo le enseño, es facilito" le confirma que tendrá tarea y lo espanta; "usted no la toca, para eso me paga" le quita el trabajo de encima. Ancla en WhatsApp, que ya domina.',
  },
  {
    id: 'redes-seguidores',
    triggers:
      /me manejan las redes|me consiguen seguidores|publicidad en facebook|me suben los seguidores|manejan (el )?(instagram|facebook) tambien/,
    objection: '"¿También me manejan las redes / seguidores?"',
    response:
      'Mi especialidad es que lo encuentren en Google y que el WhatsApp le venda solo — ahí es donde está la plata. Los seguidores miran; el que busca en Google, compra. Arranquemos por donde entra el dinero, y si después quiere redes, yo mismo le conecto con gente buena de eso.',
    why: 'Trampa de alcance: decir "sí" a todo revienta la entrega y la confianza; el "no" a secas pierde el trato. Verdad + enseñanza ("miran vs. compran") + puerta abierta. Delimitar con seguridad transmite más experticia que aceptar todo.',
  },
  {
    id: 'suena-robot',
    triggers:
      /suena (muy |a )?robot|hablar con personas|queda muy frio|que le contesten de verdad|muy impersonal/,
    objection: '"Eso suena muy robot, mis clientes quieren personas"',
    response:
      'Tiene toda la razón, y por eso el sistema no reemplaza a nadie: solo contesta lo repetido — precios, horarios, ubicación — y al instante. Apenas el cliente quiere algo más, se lo pasa a usted con toda la conversación adelantada. Y le digo algo: peor que un robot amable es un WhatsApp que no contesta hasta el otro día.',
    why: 'Acuerda primero (Cardone), nunca discutas. El reencuadre clave: la comparación real es respuesta instantánea vs. silencio en visto — no bot vs. humano.',
  },

  // --- El dinero (cierre y cobro) ------------------------------------------
  {
    id: 'fiado',
    triggers:
      /empiece y (yo )?le voy pagando|arranque nomas y ahi vemos|cuando este list[ao] le pago|le pago cuando (vea|este)|primero muestreme algo y ahi|no le voy a quedar mal|hagalo y cuando este listo/,
    objection: '"Mejor empiece y yo le voy pagando" (fiado)',
    response:
      'Le entiendo, pero así no trabajo con ningún cliente: el anticipo es lo que me deja bloquear al equipo solo para usted. Lo que sí puedo hacer es bajarle el arranque: en vez del 50%, empezamos con el 30% y el resto en dos partes. ¿Le cuadra así?',
    why: 'Sostén la regla como política universal (no es desconfianza hacia ÉL) y negocia el monto, nunca la existencia del anticipo. Piso: 30% o plan 30/35/35. Ceder aquí convierte la venta en cuenta por cobrar.',
  },
  {
    id: 'yo-le-aviso',
    triggers:
      /yo (lo|le) llamo( despues| luego)?|yo le aviso|ahi le aviso|le aviso cualquier cosa|dejeme ver mi semana|yo le escribo|deme unos dias y le confirmo|yo me comunico con usted|cualquier cosa yo le (aviso|digo)/,
    objection: '"Yo le aviso / déjeme ver y le digo"',
    response:
      'Claro que sí. Y para no estarle cayendo a cada rato, dejémoslo apuntado de una vez: ¿martes en la mañana o miércoles en la tarde? Si algo se le cruza, lo movemos sin problema.',
    why: '"Yo le aviso" es la antesala del ghosting en 9 de cada 10 casos. Fijar fecha con permiso explícito de moverla le da a él una salida digna y a ti un ancla real en el calendario.',
  },
  {
    id: 'planton',
    triggers:
      /se me olvido|se me paso (por completo)?|uy,? verdad,? era hoy|me salio un imprevisto|se me cruzo algo|que pena no le avise|disculpe,? no pude/,
    objection: 'Se disculpa por el plantón',
    response:
      'No se preocupe, así es esto — uno no para en el negocio. ¿Lo dejamos mejor para mañana a las 10 o el jueves a las 4?',
    why: 'Absuelve rápido y sin drama (etiqueta Voss: el avergonzado no reagenda, desaparece) y encadena la alternativa doble DE INMEDIATO: la disculpa se convierte en cita nueva antes de que cuelgue con la culpa a cuestas.',
  },
];
