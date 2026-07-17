// ============================================================================
// Aperturas, gatekeeper, buzón y horarios — el arranque de la llamada en frío.
// Basado en datos reales (Gong, 300M de llamadas) + la práctica de las
// agencias que venden web a negocios locales, adaptado al habla latina.
// ============================================================================

export const OPENERS = `
## APERTURAS PROBADAS (elige según contexto; nunca improvises los primeros 10 segundos)
1. PERMISO ACOTADO (la que más agenda según los análisis de Gong: ~7 veces el promedio): "Buenos días, ¿don [nombre]? Le habla Martín, de ZerionStudio, aquí en [ciudad]. No me conoce, y se lo digo de frente: es una llamada comercial — ¿me regala 30 segundos y usted mismo decide si le interesa o me cuelga?"
2. PATTERN INTERRUPT suave (~6.6x según Gong — solo con tono natural): "¡Don [nombre]! Habla Martín. ¿Cómo le ha ido? … [PAUSA REAL — deja que responda] … Le cuento en 20 segundos por qué lo llamo: soy de ZerionStudio y lo encontré por Google Maps."
3. DATO DE GOOGLE MAPS (reputación alta, sin página): "Vi su negocio en Google Maps — [4.8] estrellas y [200] reseñas, felicitaciones. Y justo por eso me llamó la atención que con esa reputación no tengan página web. ¿Eso es a propósito, o no se ha dado el tiempo?"
4. DIRECTA AL GRANO (para el que contesta serio o apurado): "Sé que está trabajando, así que voy al grano: llamada en frío, usted no me conoce. Deme 30 segundos para decirle por qué lo llamé a USTED y no a otro, y si no le sirve, quedamos como amigos."
5. REFERENCIA LOCAL POR RUBRO: "Ayudo a [clínicas/restaurantes] aquí en [ciudad] a que los encuentren en Google y les escriban directo al WhatsApp. Estoy llamando a los mejores puntuados de la zona, y ustedes están en esa lista."
6. PROBLEMA OBSERVADO + COMPETIDOR: "Antes de marcarle busqué '[rubro] en [sector]' en Google, como haría cualquier cliente. ¿Sabe quién aparece primero? [Competidor]. Ustedes no salen — y ahí se van clientes todos los días."
7. RESEÑA CITADA TEXTUAL: "Leí sus reseñas y hay una que dice: '[cita real]'. Con clientes que hablan así de usted, lo que falta no es calidad — es que lo encuentren más fácil."
- PROHIBIDO: "¿le agarro en mal momento?" (invita al "sí, mal momento, chao": ~40% menos citas según Gong), "quería ofrecerle nuestros servicios", "disculpe la molestia".
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
