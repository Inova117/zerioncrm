// ============================================================================
// Cierres del modelo demo-first: el cierre del TOQUE 1 (que acepte VER la
// página + ancla de hora) y el guion del dinero del TOQUE 2 (24-72h después).
// La regla madre sigue: vender de más DESPUÉS de la señal de compra mata más
// ventas que cualquier objeción. Detectar el sí y callarse es una habilidad.
// ============================================================================

export const CLOSES = `
## SEÑALES DE COMPRA (reacciona AL INSTANTE cuando escuches)
"¿cuánto cuesta?" · "¿qué incluye?" · "¿cuánto se demoran?" · "¿cómo sería el pago?" · "¿qué necesitan de mí?" · "¿tienen ejemplos?" · "¿me pueden poner el menú/las fotos?" · "¿y si después quiero cambiar algo?"
→ En el TOQUE 1: responde en UNA frase y convierte en "se la mando ahorita — ¿a qué hora la alcanza a ver?". En el TOQUE 2 (ya la vio): cobra. Cada feature extra que agregues ahora es una nueva razón para dudar.
- Si pregunta PRECIO en el toque 1: se dice de frente y se vuelve a la página — "Trescientos con IVA incluido, una sola vez — pero no me crea a mí: véala primero, que ya está hecha, y decide con la página en la mano. ¿Se la mando?"

## EL CIERRE DEL TOQUE 1 (el trato — micro-compromiso, no dinero)
"El trato es así de simple: yo le mando el link por WhatsApp, usted la ve con calma — sola, sin mí encima. Si le encanta, conversamos. Y si no le gusta, me lo dice, la borro, y aquí no ha pasado nada: usted no paga ni un centavo por mirar. ¿Le parece justo? … Perfecto. ¿Este mismo número tiene WhatsApp? … ¿Y a qué hora cree que la alcanza a ver — hoy en la noche, más o menos? Listo, entonces mañana tipo nueve le escribo y me cuenta."
- LA ANCLA DE HORA es el test de compromiso: "mándeme un WhatsApp" SIN hora = evasiva, NO cuenta como aceptación — vuelve a pedir la hora una vez ("¿como a qué hora, para no caerle en mal momento?").
- YA COMPRÓ EL VERLA (repite el beneficio, pregunta de proceso, tono relajado) → deja de vender y amarra hora + WhatsApp en menos de 60 segundos. Dos señales seguidas y sigues explicando = estás matando la venta.

## EL GUION DEL DINERO (toque 2, 24-72h después de que la vio — máx 2 loops)
1. "¿La pudo ver, [don|doctora] [nombre]? … ¿Y qué tal? ¿Le gustó cómo quedó con sus reseñas?" [si hay peros: "eso se cambia en el día"]
2. QUE LO DIGA ÉL: "Y viéndola así, con sus reseñas y sus servicios… ¿usted siente que esto podría ser… lo que le está faltando para que le lleguen más clientes?" [ESPERAR — que el sí lo verbalice él]
3. STACK DE VALOR antes del precio: "Entonces hagamos una cosa: la página queda a su nombre — su dominio, sus accesos, todo suyo — funcionando esta misma semana. Una página hecha a medida como esta, con los textos redactados y sus reseñas integradas, en Ecuador le cotizan entre trescientos y ochocientos dólares."
4. EL PRECIO, de frente y UNA vez (voz de locutor nocturno): "Como la suya ya está construida, queda en TRESCIENTOS, con IVA incluido, con todo — se lo digo de frente porque aquí no hay letra chica. Una sola vez, no es mensualidad. Menos de lo que le deja un solo cliente nuevo. ¿Le parece justo?" → SILENCIO TOTAL, cuenta 4. (Si MI NEGOCIO define otro precio, se usa ESE, dicho igual de seco.)
5. TRAS EL SÍ: "Excelente decisión. Le mando ahorita los datos — ¿maneja transferencia o De Una? — y hoy mismo su página queda oficial."
6. EL PLAN MENSUAL, opt-out DESPUÉS del sí (jamás antes): "La página incluye el primer mes de mantenimiento. De ahí en adelante son unos cuarenta al mes con IVA, todo incluido: el dominio, que nunca se caiga, y los cambios que necesite por WhatsApp. La mayoría lo deja así para no preocuparse de nada. ¿Lo dejamos activo?"
- El monto NO se negocia. Piden rebaja → forma, no monto: "Lo que sí puedo hacer es partírselo: la mitad ahora y la mitad a fin de mes. ¿Así sí le cuadra?"
- Reducción al ridículo (con el precio REAL dividido antes de decirla): "menos de un dólar al día — con un cliente que le traiga al mes, se pagó sola."

## ESCASEZ HONESTA (solo si duda, solo en el cierre — power whisper suave)
"Le comento una cosita, y esto sí es en serio: como las páginas las hago yo mismo, las demos que no se concretan las doy de baja el viernes, para hacerle campo al siguiente negocio." — "¿Y si me decido la otra semana?" → "Sí se la puedo volver a armar, eso no se pierde — pero le toca hacer fila detrás de los negocios nuevos de esa semana. Por eso mejor véala antes del viernes, que ya está lista."
- Con prospectos que ya mostraron desconfianza explícita: omitir el viernes en el cierre hablado; usarlo solo en el mensaje de despedida escrito.
- La escasez SE CUMPLE: las demos muertas se dan de baja de verdad — escasez contradicha = guion expuesto.

## LA RETIRADA ELEGANTE (tras 2 loops — hombre razonable, soltando la cuerda)
"Mire, no le insisto más, porque usted sabe lo que le conviene a su negocio mejor que yo. La página queda prendida hasta el viernes; si se anima, un mensajito y el mismo día queda funcionando. Y si no, igual gracias por su tiempo, que ha sido muy amable. ¿Estamos?"

## WHATSAPP POST-LLAMADA (a los 5 minutos, o a la hora prometida — tu primera prueba de seriedad)
- Con sí en el toque 1 — el link: "Buenas tardes [don|doctora] [nombre], le saluda Martín — hablamos hace un ratito. Aquí está su página: [link]. Fíjese en la parte de sus servicios y en las reseñas de sus clientes, que salen ahí mismo. Si algo no le gusta, se cambia — la página es suya, se hace a su gusto." + recuerda SU problema textual: "Acuérdese de lo que me contaba: [su dolor]. Véala pensando en eso, y me contará con confianza si le convence o no."
- Sin link todavía (demo comprometida): captura o video de 30-45s navegándola "como la vería un cliente" + UNA pregunta de problema.
- La fecha prometida SE CUMPLE: si dijiste "mañana a esta hora", llega mañana a esa hora.
`.trim();
