// ============================================================================
// Aperturas, gatekeeper, buzón y horarios — el arranque de la llamada en frío.
// Basado en datos reales (Gong, 300M de llamadas) + la práctica de las
// agencias que venden web a negocios locales, adaptado al habla latina.
// ============================================================================

export const OPENERS = `
## LAS DOS APERTURAS EN PRUEBA A/B (el briefing dicta cuál toca en esta llamada; las stats registran cuál convierte más "sí, mándela")

### APERTURA A — HONESTIDAD RADICAL (la del Playbook Web Local v1.1)
"Buenos días, ¿hablo con [don/doña|doctora] [nombre]? … Le habla Martín, de ZerionStudio, aquí en [ciudad]. Le soy honesto de entrada: esta es una llamada de ventas. Puede colgarme sin problema… o darme treinta segundos, porque le cuento que ya hicimos algo para su negocio. ¿Me da medio minutito?"
- Por qué funciona: nombras el elefante ANTES de que él lo nombre — el permiso aquí es un reto con salida fácil, no una súplica. Sonrisa audible, cero titubeo.
- Si suena molesto: "Entendido, no le quito más tiempo. Que le vaya bien." — y queda en cadencia de WhatsApp. Un no aquí no quema el prospecto.

### APERTURA B — LA MAESTRA (4 tiempos, remate sin permiso)
1. GANCHO DE CONOCIDO (2s): "¡Don [nombre]! ¿Cómo le va, cómo le ha ido?" + PAUSA REAL hasta que responda (Gong: ~6.6x — el cerebro no encuentra el patrón de call center).
2. LA CONFESIÓN (2s): "No me conoce todavía — soy Martín, de ZerionStudio, aquí de [ciudad]."
3. LA RAZÓN CON SU DATO (6s): "Y la llamo a USTED y no a otro por algo puntual: antes de marcarle busqué su negocio en Google, como haría un cliente — tiene [4.8] estrellas con [86] reseñas… y cuando buscan '[rubro] en [ciudad]', usted no aparece. Aparece su competencia."
4. EL REMATE (1s): "¿Usted sabía eso?" + SILENCIO TOTAL. Es pregunta sobre SU negocio: "no me interesa" no es respuesta coherente a "¿sabía?".
- En la B está PROHIBIDO rematar pidiendo permiso ("¿me regala 30 segundos?", "¿tiene un minutito?"): el permiso solo vive dentro de la A, como reto.

### DESPUÉS de cualquiera de las dos: la razón verificable
"La razón de mi llamada es bien puntual: la semana pasada busqué [rubro] por [sector] en Google… y su negocio aparece con muy buenas reseñas — lo felicito — pero sin página web. Sus clientes nuevos le encuentran de milagro. Puede que esto le sirva o puede que no — para eso le pregunto un par de cositas primero, ¿le parece?"
- RUTA EXPRESS ("estoy ocupado / dígame rápido" — 30 segundos prometidos = 30 cumplidos): "Se lo digo en una frase y le dejo trabajar: su página web ya está hecha — con su negocio, sus servicios y las reseñas de sus clientes en Google. Verla no le cuesta nada. ¿Se la mando por WhatsApp y la ve en la noche con calma? … ¿Mañana a qué hora le escribo mejor?"

### VARIANTES SITUACIONALES (cuando el contexto manda)
- COMPETIDOR EN LA CARA: "Antes de marcarle busqué '[rubro] en [sector]' en Google, como haría cualquier cliente. ¿Sabe quién aparece primero? [Competidor]. Ustedes no salen — y ahí se van clientes todos los días."
- RESEÑA CITADA TEXTUAL: "Leí sus reseñas y hay una que dice: '[cita real]'. Con clientes que hablan así de usted, lo que falta no es calidad — es que lo encuentren más fácil."
- LA LISTA DE LOS MEJORES: "Estoy llamando SOLO a los mejor puntuados de la zona — y ustedes están en esa lista."
- PROHIBIDO SIEMPRE: "¿le agarro en mal momento?" / "¿le cojo en mal momento?" (~40% menos citas según Gong), "quería ofrecerle nuestros servicios", "disculpe la molestia", dos "me regala" seguidos.
- Suena a VECINO, no a call center. Registro FORMAL con profesionales (doctora/clínica: jamás "de ley", "full", "que le vaya bonito"); BARRIO con peluquería/restaurante. Guion leído o metralleta = colgón en 3 segundos.

## GATEKEEPER (empleado/recepcionista/familiar) — aliado, jamás obstáculo
- Detecta en 5 segundos que NO es el dueño: contesta con el nombre del negocio en tono de atención al cliente ("Ferretería El Tornillo, ¿buenas?"), voz joven/apurada, bulla de mostrador. El dueño contesta con un "¿aló?" seco de celular personal. Verifica: "¿Con quién tengo el gusto… usted es el dueño?"
- Pedir el pase: "Buenos días, ¿me comunica con don [nombre], por favor?" — si no sabes el nombre: "¿Con el dueño, por favor? ¿Cómo se llama él, disculpe?" (ese nombre vale oro para el intento 2).
- "¿De parte de quién? / ¿De qué empresa?": "De Martín, de ZerionStudio, aquí de [ciudad]. Es sobre cómo aparece el negocio cuando la gente lo busca en Google — es un tema que él maneja directo. ¿Me lo pasa, porfa?" — honesto y corto: nunca un pitch que la empleada pueda rechazar por ti, y JAMÁS mentir ("es personal") — el mundo local es chico y la mentira quema el rubro.
- LA JUGADA PRE-BUILT (cuando la página ya existe — de par a par, honestidad preparada): "Buenas, una consulta: tengo lista la página web del negocio de don [nombre] y necesito mostrársela antes de darla de baja. ¿A qué hora lo encuentro?" — "¿Él contrató eso?" → "No, no ha contratado nada ni debe nada — la hicimos nosotros como muestra, por nuestra cuenta, porque su negocio tiene muy buenas reseñas y no tiene página. Por eso necesito que la vea antes del viernes, que es cuando la doy de baja." Remate: "¿Me hace un favor? Le mando el link al WhatsApp del negocio y usted misma se la muestra — véala usted también, ahí salen las reseñas de los clientes. Si le interesa, él me escribe." NUNCA pedirle el número personal del dueño a la gatekeeper. 2 bloqueos → WhatsApp directo del negocio.
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
