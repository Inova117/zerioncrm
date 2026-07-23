// ============================================================================
// El después del toque 1: la cadencia de WhatsApp del modelo demo-first
// (día 0 → 24h → audio día 7 → breakup día 14 → opt-out), el cobro tras el
// sí, y la reactivación. Donde de verdad se gana la plata es entre "le mandé
// el link" y "llegó el pago".
// ============================================================================

import { GARANTIA_ENTREGA } from './garantia';

export const POSTVENTA = `
## LA CADENCIA DE WHATSAPP (v1.1 — cada mensaje con el dato específico; variar 2-3 palabras siempre)
- DÍA 0, a los 5 min de la llamada (o a la hora prometida): el link con contexto — "Aquí está su página: [link]. Fíjese en sus servicios y en las reseñas de sus clientes, que salen ahí mismo. Si algo no le gusta, se cambia." + el recuerdo de SU dolor textual de la llamada.
- FRÍO SIN LLAMADA (día 0, sin link, con dato verificable): "Buenos días, [don|doctor] [nombre]. Le escribe Martín, de ZerionStudio. Vi su negocio en Google — [4.8] estrellas y más de [40] reseñas, lo felicito — y noté que sus clientes no tienen una página donde ver sus [servicios] ni escribirle directo. Le preparamos una de muestra, ya con su información. ¿Le puedo mandar una captura por aquí? Si no le convence, la borro y no le quito más tiempo." (Captura o video nativo primero; el link solo con conversación activa.)
- SEGUIMIENTO 24h (sin presión): "¿Alcanzó a ver su página? Sin apuro — y si prefiere la vemos juntos en una llamada de cinco minutos, usted me dice no más."
- AUDIO DÍA 7 (20-30 segundos, tono de colega, cero robot): "Buenas tardes, le saluda Martín, de ZerionStudio. Le escribí estos días por la página que armamos de muestra para su negocio. Sé que anda a full, así que le resumo: la página ya está lista, con sus reseñas y todo, y me encantaría que le dé una miradita — 30 segunditos. Si le gusta, conversamos, y si no, no pasa nada y quedamos como amigos. Que tenga muy buen día."
- BREAKUP DÍA 14 (puerta abierta): "Le escribo por última vez para no ser impertinente. Le dejo guardada la página de muestra por si más adelante le interesa: con nosotros usted primero ve su página funcionando y solo paga si le gusta. Cuando guste, aquí estoy. ¡Muchos éxitos con su negocio!"
- OPT-OUT a la primera, SIEMPRE (y borrar de verdad): "Con mucho gusto, disculpe la molestia. Borro su contacto ahora mismo y no le volvemos a escribir. ¡Éxitos con su negocio!"
- Regla anti-quemado: NINGÚN mensaje sin ángulo nuevo. "Le escribo para dar seguimiento" y "¿ya lo pensó?" están PROHIBIDOS. Máximo 3 toques de recordatorio en total (límite real de WhatsApp además del de cortesía).

## DEL SÍ AL PAGO (donde más ventas mueren en LatAm)
- En la llamada del sí, amarra ANTES de colgar: "Le mando ahorita por WhatsApp los datos de pago — ¿maneja transferencia o De Una? ¿Me confirma hoy para dejarla oficial hoy mismo?"
- WhatsApp de cierre en <5 minutos (una pantalla): qué incluye + el precio ([PRECIO], una sola vez) + todo queda a su nombre (dominio, accesos — por escrito) + LA GARANTÍA DE ENTREGA por escrito ("${GARANTIA_ENTREGA}") + datos bancarios COMPLETOS + lo que necesitas de él si quiere cambios (logo, fotos que prefiera). Cierra con pregunta: "¿Me confirma hoy y su página queda oficial esta misma tarde?"
- Cobra como COORDINADOR, no como cobrador. Prohibido "¿ya me depositó?". El pago atado a un evento: "apenas llegue, la dejo oficial y le mando sus accesos".
- Escalada: Día 1 → excusa de valor ("ya dejé su página lista para publicar — ¿alguna duda con el pago?") + reenvía los datos bancarios. Día 3 → límite real: "la dejo guardada hasta el viernes; pasado eso la doy de baja para hacerle campo al siguiente negocio. ¿Lo alcanza?" Día 7 → soltar con puerta abierta (a veces revive la venta ese mismo día).
- Pago partido (solo si salió el loop de "está caro"): mitad ahora, mitad a fin de mes — y la página se publica con el primer pago.
- "¿Me da factura?" = SEÑAL DE COMPRA. "Claro, factura electrónica. Páseme su RUC y correo y le facturo apenas llegue el pago." Sin titubear. El precio ES con IVA incluido — dilo por escrito.
- Llegó el pago → confirma en MINUTOS: "¡Recibido! Su página queda oficial hoy y le mando sus accesos esta misma tarde." El silencio después de pagar es lo que fabrica arrepentimiento.

## EL REFUERZO POST-PAGO (las primeras 24h son un SEGUNDO cierre — contra el arrepentimiento)
Cobraste la tarjeta, no la confianza: en un mercado quemado por anticipos, el silencio post-pago es doblemente letal. La secuencia:
- LA VICTORIA EL MISMO DÍA: la página se PUBLICA el día del pago y el link viaja de inmediato — "Ya está viva. Mañana búsquese en Google por su nombre y me cuenta qué se siente." La victoria emocional va lo más cerca posible de la compra.
- EL AUDIO PERSONAL en la primera hora (30 segundos, no plantilla): "Don [nombre], bienvenido — buena decisión. Ya estamos con su página; mañana a las [5] le llegan sus claves y le enseño a pedir cambios. Cualquier cosa, este es mi número directo."
- LA LLAMADA DE ENTREGA agendada ANTES de colgar el cobro (nunca "cualquier cosa me escribe"): claves + cómo pedir cambios + qué esperar del reporte mensual. Ahí mismo, el pedido de referido con el orgullo fresco: "¿Conoce otro negocio por aquí que le vendría bien aparecer en Google? Con gusto le hago su muestra."
- La fecha prometida SE CUMPLE al minuto — la puntualidad post-pago es la prueba de que no era cuento. Cada promesa cumplida en las primeras 48h vale más que diez argumentos de la llamada.

## GHOSTING Y REACTIVACIÓN
- La vio y elogió pero no paga → aísla con el sí previo: "La página sí le gustó, ¿cierto? Entonces lo que hay que pensar es la inversión — ¿es eso, o hay otra cosa?" Si hay esposa/socio: "mándele este mismo link para que la vea él también — ¿le escribo el jueves para ver qué dijeron los dos?"
- La cadencia (24h → audio día 7 → breakup día 14) ES el anti-ghosting: cada toque entrega algo (la página, un video, la puerta abierta), nunca pide "¿ya lo pensó?".
- Las demos muertas SE DAN DE BAJA el viernes (la escasez se cumple) — y quedan guardadas para reactivar.
- REACTIVACIÓN (90 días, conversación NUEVA, nunca el hilo viejo): caso de éxito del MISMO rubro con número concreto: "Acabamos de entregar la página de [negocio del rubro] y en el primer mes le entraron [N] pedidos por WhatsApp. Me acordé de su negocio — todavía tengo guardada la muestra que le habíamos hecho. La actualizo en un día, ¿le mando el enlace?"
- "No" definitivo → premia la franqueza: "Se lo agradezco de verdad por decírmelo de frente — así no lo molesto por gusto. Si más adelante quiere aparecer en Google, este número es el mío."
`.trim();
