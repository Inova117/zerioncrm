// ============================================================================
// Aperturas, gatekeeper, buzón y horarios — el arranque de la llamada en frío.
// Basado en datos reales (Gong, 300M de llamadas) + la práctica de las
// agencias que venden web a negocios locales, adaptado al habla latina.
// ============================================================================

export const OPENERS = `
## LA APERTURA MAESTRA (los primeros 12 segundos — estructura fija en 4 tiempos)
El objetivo de la apertura NO es que te dé permiso: es que responda algo sobre SU negocio. Pedir permiso te clasifica de telemarketer y le carga el "no gracias" en la boca; la pregunta sobre SU dato lo mete a la conversación sin que se dé cuenta.
1. GANCHO DE CONOCIDO (2s): "¡Don [nombre]! ¿Cómo le va, cómo le ha ido?" + PAUSA REAL hasta que responda. Tono de alguien que lo conoce (Gong: ~6.6x más citas — el cerebro no encuentra el patrón de call center y te regala 10 segundos mientras averigua de dónde te conoce).
2. LA CONFESIÓN (2s): "No me conoce todavía — soy Martín, de ZerionStudio, aquí de [ciudad]." Segundo pattern interrupt: él esperaba que fingieras familiaridad (eso hace el telemarketer descubierto) y la rompes tú mismo. La honestidad desarma y compra credibilidad para el dato que viene.
3. LA RAZÓN CON SU DATO (6s): "Y la llamo a USTED y no a otro por algo puntual: antes de marcarle busqué su negocio en Google, como haría un cliente — tiene [4.8] estrellas con [86] reseñas… y cuando buscan '[rubro] en [ciudad]', usted no aparece. Aparece su competencia." La tarea hecha ES la diferenciación (nadie más que llama la hizo), y la tensión reputación-alta-pero-invisible abre el curiosity gap.
4. EL REMATE (1s): "¿Usted sabía eso?" + SILENCIO TOTAL. Es una pregunta sobre SU negocio, no sobre tu pitch: "no me interesa" no es respuesta coherente a "¿sabía?". Conteste lo que conteste, ya hay conversación.
- PROHIBIDO rematar la apertura con "¿me regala 30 segundos?", "¿tiene un minutito?", "¿le puedo contar?": es el cierre del telemarketer educado y dispara el "no gracias" automático. El permiso solo existe DENTRO de la honestidad radical (abajo), como reto con salida — nunca como cortesía.

## VARIANTES (la maestra es la default; estas entran cuando el contexto manda)
- HONESTIDAD RADICAL (contestó seco, apurado o a la defensiva): "Don [nombre], le soy 100% honesto: esta es una llamada comercial y usted no me conoce. Puede colgarme ahora sin pena… o darme 20 segundos y le cuento qué encontré en Google de SU negocio. ¿Qué prefiere?" — aquí el permiso SÍ funciona porque primero nombraste el elefante: es un reto con salida fácil, no una súplica.
- COMPETIDOR EN LA CARA: "Antes de marcarle busqué '[rubro] en [sector]' en Google, como haría cualquier cliente. ¿Sabe quién aparece primero? [Competidor]. Ustedes no salen — y ahí se van clientes todos los días."
- RESEÑA CITADA TEXTUAL: "Leí sus reseñas y hay una que dice: '[cita real]'. Con clientes que hablan así de usted, lo que falta no es calidad — es que lo encuentren más fácil."
- LA LISTA DE LOS MEJORES: "Ayudo a [rubro] aquí en [ciudad] a que los encuentren en Google y les escriban directo al WhatsApp. Estoy llamando SOLO a los mejor puntuados de la zona — y ustedes están en esa lista."
- PROHIBIDO SIEMPRE: "¿le agarro en mal momento?" (invita al "sí, mal momento, chao": ~40% menos citas según Gong), "quería ofrecerle nuestros servicios", "disculpe la molestia".
- Suena a VECINO, no a call center: "don/doña + nombre", menciona la ciudad o el sector, nombra otro negocio del rubro con el que trabajas. Guion leído o velocidad de metralleta = colgón en 3 segundos.

## GATEKEEPER (empleado/recepcionista/familiar) — aliado, jamás obstáculo
- Detecta en 5 segundos que NO es el dueño: contesta con el nombre del negocio en tono de atención al cliente ("Ferretería El Tornillo, ¿buenas?"), voz joven/apurada, bulla de mostrador. El dueño contesta con un "¿aló?" seco de celular personal. Verifica: "¿Con quién tengo el gusto… usted es el dueño?"
- Pedir el pase: "Buenos días, ¿me comunica con don [nombre], por favor?" — si no sabes el nombre: "¿Con el dueño, por favor? ¿Cómo se llama él, disculpe?" (ese nombre vale oro para el intento 2).
- "¿De parte de quién? / ¿De qué empresa?": "De Martín, de ZerionStudio, aquí de [ciudad]. Es sobre cómo aparece el negocio cuando la gente lo busca en Google — es un tema que él maneja directo. ¿Me lo pasa, porfa?" — honesto y corto: nunca un pitch que la empleada pueda rechazar por ti, y JAMÁS mentir ("es personal") — el mundo local es chico y la mentira quema el rubro.
- "No se encuentra / está ocupado": "No se preocupe. ¿A qué hora lo encuentro por aquí normalmente? … Perfecto, lo llamo mañana a las 10 entonces. ¿Y me recuerda su nombre, para agradecerle cuando vuelva a llamar?" — sales con la hora real del dueño + una aliada con nombre.
- "Déjeme su número y él le devuelve la llamada": NUNCA aceptes (el dueño jamás devuelve llamadas a desconocidos). "Se lo agradezco, pero ando entre reuniones y es difícil que me encuentre. Mejor lo llamo yo — ¿mañana en la mañana está? Le dejo mi nombre eso sí: Martín, de ZerionStudio."
- NO pitchees al gatekeeper. Tono casual de aliado: "¿me ayuda porfa?" activa reciprocidad. SIEMPRE de usted — tutear a una recepcionista mayor cae de confianzudo y quema a la aliada; tutea solo si la voz es claramente joven Y te tutea primero.

## BUZÓN DE VOZ Y WHATSAPP (en LatAm el buzón casi no existe: tu voicemail ES WhatsApp)
- Máximo 1-2 buzones en TODA la secuencia, de 12-15 segundos: "Don [nombre], le habla Martín de ZerionStudio, aquí en [ciudad]. Lo llamaba por cómo aparece su negocio cuando lo buscan en Google — tengo algo puntual que mostrarle. Le mando el detalle por WhatsApp a este mismo número. ¡Que esté muy bien!" (El buzón no genera llamadas de vuelta, pero DUPLICA la respuesta del WhatsApp que mandas después. Al tercer buzón el efecto se invierte: ya no dejes mensaje.)
- SIEMPRE manda el WhatsApp en los 2 minutos siguientes: nombre + el dato del negocio que encontraste + una pregunta.

## CUÁNDO LLAMAR (la hora equivocada mata al mejor guion)
- Restaurantes: 9:30-11:00 o 15:00-17:00. JAMÁS de 12 a 15 ni viernes/sábado noche.
- Clínicas y consultorios: antes de las 9:00, almuerzo (13:00-14:00) o después de las 17:00 — en horario de pacientes contesta solo la recepcionista.
- Salones de belleza: martes a jueves, 10:30 o 14:00-15:00. Nunca viernes/sábado (sus días fuertes).
- Ferreterías y talleres: 8:00-9:30 apenas abren, o 16:00-17:30.
- Martes a jueves rinden más que lunes (poniéndose al día) y viernes (desconectados). Se necesitan 5-8 intentos en 2-3 semanas para agarrar al dueño: rota las ventanas horarias y lleva ángulo NUEVO en cada intento (1.º el dato de Maps, 2.º la reseña, 3.º la muestra ya hecha).
`.trim();
