// ============================================================================
// Battlecards — respuesta instantánea a objeciones (sin esperar al LLM).
//
// Síntesis de la investigación profunda: cada card combina las jugadas del
// sistema (acordar primero, etiqueta + calibrada, deflector + loop) con el
// conocimiento del nicho (vender web a negocios locales latinos).
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
      'Buena pregunta. ¿Y cómo hago yo para darle la página completa a ese precio? … El monto es uno solo y se lo dije de frente — si le bajo porque me lo pide, entonces el precio era mentira. Lo que sí puedo es partírselo: la mitad ahora y la mitad a fin de mes. Y véala primero, que ya está hecha — ¿a qué hora la alcanza a ver?',
    why: 'La calibrada "¿cómo hago yo…?" lo pone en tus zapatos sin confrontar. El monto JAMÁS baja y el stack JAMÁS se recorta (precio negociable = oferta comparable = precio mentira). La única flexibilidad es de FORMA: 50/50 a fin de mes. Y como todas: desemboca en "véala primero".',
  },
  {
    id: 'caro',
    triggers:
      /\bcar(o|os|isimo|ito)\b|mucha plata|mucho dinero|no me alcanza|fuerte el precio|esta elevado|cuesta mucho|un ojo de la cara|no tengo (para|plata|dinero)|no hay (plata|presupuesto)|fuera de (mi )?presupuesto|no estoy para (esos )?gastos|es mucho eso/,
    objection: '"Está caro / no tengo presupuesto"',
    response:
      'Le entiendo, trescientos de un solo no es cualquier cosa. Véalo así: es una sola vez en la vida del negocio, y la página trabaja veinticuatro horas — como una recepcionista que nunca pide permiso. Un solo cliente nuevo la paga. Y usted mismo me decía cuánto se le va cada mes… Pero no me crea a mí: véala primero, que ya está hecha. ¿A qué hora la alcanza a ver?',
    why: 'Acuerda primero y NUNCA defiendas el precio. "Está caro" = no articulaste el valor: re-ancla a SU pérdida calculada y desemboca en "véala primero". El 50/50 NO se ofrece en este loop 1 — queda para el loop 2 (regalarlo a la primera es ceder términos sin re-articular valor). Distinto del REGATEO explícito o preguntar formas de pago: eso es señal caliente y ahí la forma se sopla de una. Tras decir un precio: SILENCIO, el primero que habla cede.',
  },
  {
    // Antes que 'sobrino': "un muchacho me lo hace a mitad de precio" es
    // objeción de PRECIO contra fantasmas, no de familiar.
    id: 'mas-barato',
    triggers:
      /(el otro|otros?|un muchacho) me (cobra|cobraba|ofrecio|lo hace) (menos|mas barato|a mitad)|mas barato|a mitad de precio|lo hace en cien|en marketplace sale|cobran menos|hay quien lo hace/,
    objection: '"Otro me lo hace más barato"',
    response:
      'Seguro que sí — siempre hay más barato, como en todo… usted también tiene competencia que cobra menos que usted, ¿verdad? La pregunta es: ¿esa página le va a traer clientes, o solo va a existir? Y eso no me lo crea a mí: la suya ya está hecha — véala hoy y compárela con calma contra cualquier cotización. ¿A qué hora la alcanza a ver?',
    why: 'No pelees precio contra fantasmas: mueve la conversación a resultados y a la PRUEBA que ya existe. Decidir no necesita tiempo, necesita información — y la página ES la información comparativa, disponible hoy. Aplazarla al jueves regala Time Delay gratis.',
  },
  {
    // La trampa del mercado: "gratis" con permanencia de 12-24 meses.
    id: 'gratis-permanencia',
    triggers:
      /me la (dan|hacen|ofrecen|ofrecieron) gratis|(una|otra) (empresa|companias?).{0,20}gratis|gratis me la (dan|hacen|ofrecieron)|sin costo me (la )?ofrecieron|hay unos que la hacen gratis/,
    objection: '"Otra empresa me la ofreció gratis"',
    response:
      'Sí las hay, y le digo cómo funcionan: la página es "gratis" pero firma permanencia de doce o veinticuatro meses de mensualidad — al final paga el triple y la página nunca es suya. Lo nuestro es al revés: paga una vez, la página es suya, y el mensual es opcional. Saque la cuenta y compare, con toda confianza. Y mientras tanto su página ya está hecha — ¿qué le impide verla?',
    why: 'Jamás digas "es mentira": explica el MECANISMO de la trampa (permanencia) y deja que él saque la cuenta. El contraste con los pilares (una vez, suya, mensual opcional) hace el resto — y el remate vuelve al embudo: véala.',
  },
  {
    id: 'sobrino',
    triggers:
      /mi (sobrino|hijo|hija|primo|hermano|pana)( me| sabe| maneja| hace| hizo| esta| la| lo)|un (amigo|muchacho|conocido|pana)( que)? me (la |lo )?(hace|hizo|esta haciendo|ayuda|maneja|ve|iba a hacer)|ya tengo quien|ya contrate a alguien|ya estoy en eso con alguien|mi disenador|un conocido que me ayuda/,
    objection: '"Mi sobrino/hijo/amigo me hace la página"',
    response:
      'Claro, y qué bueno que tenga quien le ayude. Pero mire: esta ya está terminada — véala primero. Si su sobrino le hace algo mejor, quédese con lo de él y no me paga nada. En los dos escenarios usted gana. ¿Le mando el enlace?',
    why: 'JAMÁS compitas contra la familia — pierdes siempre. La página YA HECHA cambia el juego: no le pides que elija entre tú y el sobrino, le pides que COMPARE viendo. "En los dos escenarios usted gana" = riesgo cero literal.',
  },
  {
    id: 'ya-tengo-pagina',
    triggers:
      /ya (tengo|tenemos) (mi |una |la )?(pagina|web|sitio)|eso ya lo hicimos|ya me hicieron una|si tenemos web|ahi esta la pagina|ya trabajo con (una agencia|alguien)/,
    objection: '"Ya tengo página web"',
    response:
      'Verá, la vi — por eso mismo le llamo. ¿La ha abierto últimamente desde el celular? [pausa] Se corta, ¿verdad? Hoy la mayoría busca desde el celular — ábrala usted mismo ahorita y compare. La que le hicimos es de esta época: rápida, perfecta en el teléfono, con sus reseñas integradas. ¿Se la mando?',
    why: 'Curioso, no correctivo: "¿la ha abierto desde el celular?" hace que ÉL descubra el problema en 10 segundos con su propio teléfono. La comparación en vivo contra la página nueva ya hecha vende sola — jamás insultes la vieja.',
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
      'Le soy sincero: la información ES la página, y se la mando ahorita mismo por WhatsApp. No hay folleto ni letra chiquita. Usted la ve y me dice: ¿le gustó o no le gustó? Más simple no se puede, ¿verdad? ¿A qué hora cree que la alcanza a ver?',
    why: '"Mándame info" es el adiós educado — pero en demo-first la evasiva se desarma sola: la info ES la página ya hecha. La ancla de hora ("¿a qué hora la ve?") es el test de compromiso; sin hora, no cuenta como sí.',
  },
  {
    id: 'no-tiempo',
    triggers:
      /no tengo tiempo|estoy ocupad|ando (ocupad|full|a mil|de carrera)|estoy (atendiendo|en algo|con un cliente|con un paciente|con gente|en la cocina|vendiendo)|llam(a|e)(me)? (luego|despues|mas tarde|la otra semana)|ahorita no puedo|justo estoy saliendo/,
    objection: '"No tengo tiempo / estoy ocupado"',
    response:
      'Claro, usted está atendiendo. Por eso no le pido ni cinco minutos: le mando el link ahorita y usted la ve en la noche, en dos minutitos, desde su celular. Yo le escribo mañana. ¿Le parece?',
    why: 'Es la objeción más honesta del nicho: de verdad está atendiendo. En demo-first ni siquiera necesitas re-agendar la llamada: la página se ve sola, asincrónica, cuando él pueda. El "yo le escribo mañana" mantiene el control del seguimiento.',
  },
  {
    id: 'pensarlo',
    triggers:
      /dejame pensarlo|lo voy a pensar|dejeme pensar|tengo que pensarlo|deme unos dias|con la almohada|dejeme analizarlo|dejeme verlo con calma|mas adelante (vemos|quizas)|despues vemos/,
    objection: '"Déjame pensarlo"',
    response:
      'Le entiendo perfecto, y está bien pensarlo… aunque le digo algo con respeto: esto no se piensa con tiempo, se piensa con información — y me tiene aquí mismo. La idea como tal, ¿le gusta? Que lo encuentren en Google y le escriban solos. … Perfecto. ¿Y qué le hace dudar: el precio, o si de verdad le va a traer clientes? Cualquiera de las dos se la aclaro en un minuto.',
    why: '"Pensarlo" es cortina de humo — falta uno de los tres dieces. El reframe clave: decidir no toma tiempo, toma INFORMACIÓN (y la fuente está en la llamada — colgar no le va a dar datos nuevos). El deflector ("¿le gusta la idea?") mide el producto sin pelear; la binaria fuerza la objeción real, que sí se puede cerrar.',
  },
  {
    id: 'consultar',
    triggers:
      /(hablar|consultar|ver|conversar)(lo)? con mi (esposa|esposo|senora|socio|hermano|hijo|hija|familia)|eso lo ve mi (esposa|senora|socio|hijo|hija|hermano)|no decido (eso )?(yo )?solo|lo converso en casa|dejeme comentarle a|preguntarle al que me lleva|la que decide (esas cosas )?es mi/,
    objection: '"Tengo que consultarlo con mi esposa/socio"',
    response:
      'Claro que sí, consúltelo — hace bien. Solo una pregunta antes: ¿su esposa está contenta con cómo le están llegando los clientes hoy? … Entonces en lo importante ya están de acuerdo los dos. Mándele este mismo link para que la vea ella también — así deciden viendo la página de verdad y no de oídas. ¿Y a qué hora están los dos desocupados? Le escribo el jueves a esa hora y me cuentan qué dijeron.',
    why: 'Nunca dejes que el prospecto venda por ti: vende peor y sin convicción. ANTES de soltar al mensajero, verifica que el decisor ausente YA está de acuerdo en que el status quo no funciona ("¿está contenta con cómo llegan los clientes hoy?") — sin eso, el socio evalúa la página como GASTO, no como solución. Luego los DOS frente a la página + fecha y hora amarradas.',
  },
  {
    // La herida del mercado: mensualidades escondidas. Se responde celebrando
    // la pregunta — es LA oportunidad de decir los 4 pilares.
    id: 'mensualidad-oculta',
    triggers:
      /que mensualidad|mensualidad me van a (sacar|cobrar)|me van a (cobrar|sacar) mensual|y despues cuanto (me )?cobran|cuanto es (al|el) mes despues|cobran algo mensual|hay que pagar mensual|letra (chica|chiquita)/,
    objection: '"¿Y después qué mensualidad me van a sacar?"',
    response:
      'Buena pregunta, y me gusta que la haga. Los trescientos con IVA incluido son UNA vez, y la página es suya: dominio a su nombre, accesos suyos. Mensualidad obligatoria: cero. Hay un plan de mantenimiento opcional — y lo cancela cuando quiera. Si mañana se quiere ir con otra persona, se lleva todo. Eso está por escrito. Entonces, sabiendo que es una sola vez y todo queda a su nombre… ¿la dejamos oficial esta semana?',
    why: 'Es LA herida del mercado (el "gratis" con permanencia y el hosting secuestrado). Sinceridad total sin defensividad: celebrar la pregunta + los pilares por escrito convierten la sospecha en el argumento de cierre.',
  },
  {
    // La que dispara el pattern interrupt del pre-built: usamos sus fotos
    // públicas ANTES de que nos contrate.
    id: 'mis-fotos',
    triggers:
      /con que derecho|mis fotos|quien les dio permiso|de donde sacaron (mis|las) fotos|por que (tienen|usaron) mi (foto|informacion|nombre)|usaron mi (nombre|negocio|marca)|yo no (pedi|autorice) (nada|eso)/,
    objection: '"¿Con qué derecho usaron mis fotos / mi nombre?" (o "¡yo no pedí nada!")',
    response:
      'Muy buena pregunta. Todo lo que ve ahí ya es público: sus reseñas de Google y las fotos que su propio negocio publicó en Maps — lo mismo que cualquier cliente ve hoy. La página es un borrador PRIVADO: solo la ve usted con ese link, no está publicada en ningún lado. Si me dice que no la quiere, se borra hoy mismo y no queda rastro. Y si la quiere, cambiamos cualquier foto que no le guste — la página se hace a su gusto.',
    why: 'La objeción que el modo pre-built dispara solito. Transparencia celebrando la pregunta + tres desactivadores: es información pública, es borrador privado, y se borra sin rastro. Si hay pánico ("¡yo no contraté nada!"), la línea "no ha contratado nada ni me debe nada" va ANTES de describir la página.',
  },
  {
    id: 'mi-numero',
    triggers:
      /como consiguio mi numero|quien le dio mi numero|de donde (saco|tiene|consiguio) mi numero|como tiene mi (numero|celular)|por que me llama a mi (numero|celular)/,
    objection: '"¿Cómo consiguió mi número?"',
    response:
      'De su propia información pública — su negocio está en Google Maps con este número, ahí mismo donde lo encuentran sus clientes. De hecho por eso le llamo: lo que NO está en Google es su página. ¿Le muestro la que le hicimos?',
    why: 'Transparente y sin titubear: titubear aquí = estafador confirmado. El judo: el mismo Google Maps que da el número es la prueba de que le falta la página. Y si el opt-out llega ("no me llame más"), se cumple a la primera y se borra de verdad.',
  },
  {
    // La mitad faltante del cubo "uno mismo": extrapola su fracaso pasado al
    // presente ("ya invertí en eso y no me sirvió"). Distinta de 'desconfianza'
    // (miedo al estafador) y de 'ya-tengo-pagina' (tiene una funcionando).
    id: 'ya-intente',
    triggers:
      /(ya|antes) (intente|probe|inverti|pague|hice|tuve) .{0,30}(y )?(no (me )?(funciono|sirvio|resulto)|no paso nada|y nada|fue plata perdida)|(la pagina|la publicidad|los anuncios|el facebook) no me (funciono|sirvio|trajo (nada|clientes))|puse plata en (facebook|anuncios|publicidad|una pagina) y (nada|no paso nada|no vendi)|ya me paso con (una pagina|eso)|eso ya lo (intente|probe) y (nada|no)/,
    objection: '"Ya intenté eso y no me funcionó"',
    response:
      'Le entiendo — usted ya puso plata una vez, esperó clientes, y no llegó nada. ¿Le puedo preguntar qué fue lo que le hicieron esa vez? … Mire, eso que le pasó es justo lo que esto evita: aquí usted no pone un centavo hasta VER su página terminada y funcionando. Si le pasa lo mismo que la otra vez, no me paga y ya. ¿Qué pierde con verla?',
    why: 'Extrapola el pasado al presente: su cerebro dice "esto será igual". No discutas el pasado — pregúntalo (ahí sale qué vehículo falló) y DIFERENCIA el tuyo con la estructura: la otra vez pagó a ciegas, esta vez ve el producto terminado antes de pagar. El fracaso anterior se convierte en tu mejor argumento.',
  },
  {
    id: 'desconfianza',
    triggers:
      /quien (es usted|eres|habla|los conoce)|no los conozco|de donde (me )?llama|sera estafa|no sera estafa|me estafaron|puro cuento|no confio|numero desconocido|esto es serio|sinverguenza|ya me han (llamado|ofrecido) (con )?eso( mismo)?|eso mismo me dijeron|como se yo|no hago tratos por telefono/,
    objection: 'Desconfianza / "¿y ustedes quiénes son?"',
    response:
      'Hace bien en desconfiar — en este rubro hay cada cosa… Somos ZerionStudio, estudio de aquí. Ahorita que le mando su página por WhatsApp, le va también el link de nuestro estudio: ahí hay páginas nuestras funcionando ahora mismo — ábralas todas, con calma. Y fíjese en el detalle: yo no le pido ni un centavo por adelantado, que es exactamente donde estafan. Usted ve su página terminada ANTES de pagar.',
    why: 'Acordar con la desconfianza te separa del estafador — defenderte te iguala a uno. El argumento nuclear del demo-first: "no le pido plata por adelantado, que es exactamente donde estafan" — desarma la herida del anticipo con la estructura misma de la oferta.',
  },
  {
    id: 'ventas-flojas',
    triggers:
      /ventas estan (bajas|flojas|malas)|esta (dura|dificil|lenta|muerta) la (cosa|situacion)|esta muerto el negocio|la economia|temporada baja|apenas (estamos )?sobreviviendo|este mes (ando|vengo) (corto|apretado)|estamos apretados|con esta economia|el (otro|proximo) (mes|ano) (vemos|hablamos|quizas)/,
    objection: '"Las ventas están flojas / la situación está dura"',
    response:
      'Le creo, así está para muchos — y justamente por eso lo llamo: cuando las ventas están flojas es cuando más duele que el cliente que SÍ está buscando termine donde la competencia. Empecemos por lo que no cuesta nada: su página ya está hecha, la ve y decide sin presión. Y si la quiere, se parte en dos pagos para que no le pese.',
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
      'Le entiendo perfectamente, y le apuesto que le llaman vendedores todas las semanas. Por eso mismo yo no le pido plata ni reunión — la página ya existe y verla no cuesta nada. Véala, y si no le gusta me manda un "no gracias" por WhatsApp y no le molesto nunca más. ¿Le parece justo?',
    why: 'El "no me interesa" en los primeros segundos es REFLEJO, no decisión: aún no sabe qué rechaza. El demo-first le quita todo lo que está rechazando (plata, reunión, compromiso) y deja solo "mirar" — con salida fácil escrita. Si repite el no, agradece y suelta: ese sí es real.',
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
      'Su página ya está hecha: el día que me confirme queda publicada, y desde ese mismo día lo encuentran por su nombre y en el mapa. Aparecer cuando buscan el servicio en su zona toma entre uno y tres meses, y cada mes le muestro el avance en un reporte que se entiende de un vistazo. Desconfíe del que le diga "mañana" — ya sabe por qué.',
    why: 'Trampa de tiempos: prometer de más revienta a los 30 días; ser vago suena a evasiva. La publicación es HOY (demo-first: la página ya existe — jamás digas "en dos semanas", eso infla el Time Delay que tu modelo aplasta); el SEO de zona es honesto y escalonado (1-3 meses con reporte) = expectativa que puedes cumplir y superar.',
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
    why: 'Acuerda primero, nunca discutas. El reencuadre clave: la comparación real es respuesta instantánea vs. silencio en visto — no bot vs. humano.',
  },

  // --- El dinero (cierre y cobro) ------------------------------------------
  {
    // OJO: "le pago cuando la vea / cuando esté lista" NO está aquí — en
    // demo-first eso es señal de compra (cue de senal-compra en momentos.ts),
    // no fiado. Fiado es pedir que ARRANQUES trabajo nuevo a crédito.
    id: 'fiado',
    triggers:
      /empiece y (yo )?le voy pagando|arranque nomas y ahi vemos|primero muestreme algo y ahi|no le voy a quedar mal|hagalo y cuando este listo|me la fia|se lo voy pagando (de a poco|por partes)/,
    objection: '"Mejor empiece y yo le voy pagando" (fiado)',
    response:
      'Justamente al revés, y por eso le llamé: aquí no hay anticipo. Su página YA está hecha — usted la ve terminada sin pagar un centavo, no me está fiando nada. Cuando la vea y me diga "la quiero", se paga una vez y ese mismo día queda publicada a su nombre. Lo único que no hago es publicarla sin el primer pago — y si le acomoda, la mitad ahora y la mitad a fin de mes. ¿A qué hora la alcanza a ver?',
    why: 'En demo-first el fiado NO existe: el trabajo ya está hecho y él ya lo puede VER — "le pago cuando esté" es casi señal de compra, no objeción. La única línea que no se cruza es publicar sin primer pago (50/50 como única forma). JAMÁS mencionar anticipos, 30%, ni "bloquear al equipo": esa palabra es la herida #1 del mercado y tu oferta existe para matarla.',
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
    why: 'Absuelve rápido y sin drama (etiqueta: el avergonzado no reagenda, desaparece) y encadena la alternativa doble DE INMEDIATO: la disculpa se convierte en cita nueva antes de que cuelgue con la culpa a cuestas.',
  },
];
