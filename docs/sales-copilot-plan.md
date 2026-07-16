# Sales Copilot — Plan de implementación

> Cuarto módulo del CRM: un copiloto de ventas en tiempo real estilo **Cluely**, pero
> enfocado 100% en ventas y integrado al pipeline (Lead Finder → CRM → **Copilot**).
> Investigado 2026-07-16 (fuentes al final).

---

## 1. Cómo funciona Cluely (lo investigado)

**Producto.** Cluely es un asistente AI que escucha la conversación en vivo y muestra
sugerencias en pantalla que solo ve el vendedor. Nació como herramienta para
entrevistas ("cheat on everything"), levantó $15M de a16z (jun 2025, valuación $120M)
y pivoteó a **copiloto de ventas/reuniones** para empresas. Pricing: plan base ~$15-20/mes,
Pro con "undetectability" ~$75/mes, Enterprise por cotización (Shadow Mode, Playbook
Mode, deal scoring, SSO).

**Arquitectura (pipeline confirmado por múltiples fuentes + clones open-source):**

```
audio del sistema/mic → buffer → STT (Whisper/ElevenLabs) → contexto + docs del
usuario → LLM (GPT/Claude) → overlay flotante en pantalla
```

- **Captura**: driver de audio virtual (audio del sistema) + micrófono; OCR de pantalla
  como contexto adicional.
- **Overlay invisible**: renderizado a nivel GPU (DirectX/Metal) para que no salga en
  el screen-share de Zoom/Meet/Teams. *(Solo relevante para apps de escritorio — en
  nuestro caso web NO aplica ni hace falta: el vendedor tiene el CRM en su pantalla.)*
- **Latencia**: 1-2s desde que el prospecto termina la frase hasta la sugerencia
  (fuentes discrepan: hasta 3-5s con buffering; el objetivo práctico es <2s).
- **Contexto**: documentos de venta subidos por el usuario (playbooks) + transcripción
  acumulada de la llamada.

**Lo esencial a copiar:** no es el overlay invisible (eso es para hacer trampa en
entrevistas). Es el **loop transcripción→conocimiento→sugerencia en <2s** + una
**base de conocimiento de ventas** que hace que la sugerencia sea experta y específica.

**Competidores que ya lo hacen para ventas** (validación del mercado):
- **Trellus** — el más parecido a nosotros: extensión de Chrome que se monta sobre el
  dialer/CRM existente; detecta la objeción ("está caro") y muestra la battlecard al
  instante. 100% browser.
- **Nooks** — "Live Battlecards": aparece el talk track correcto cuando surge la
  objeción o se menciona un competidor.
- **Balto** — guía de cumplimiento del guión en vivo, para call centers.
- **Gong/Attention** — más post-llamada (análisis, coaching diferido).

---

## 2. La decisión clave: ¿cómo "escucha" la llamada?

René llama hoy por teléfono/WhatsApp desde el celular. Un navegador no puede
escuchar esa llamada. Tres modos, complementarios:

| Modo | Cómo | Costo audio | Cuándo |
|---|---|---|---|
| **A. Altavoz + micrófono** (MVP) | René pone el celular en altavoz junto a la laptop; el CRM captura con `getUserMedia` y transcribe todo (ambas voces entran por el mic) | $0 (Web Speech API) o ~$0.008/min (Deepgram) | **Fase 1.** Funciona con CUALQUIER llamada (teléfono, WhatsApp, lo que sea). Cero fricción de setup. |
| **B. Llamada en la misma pestaña** (tab audio) | Si la llamada es WhatsApp Web / Meet / Zoom en el navegador, `getDisplayMedia` captura el audio de la pestaña + mic | igual que A | Fase 1.5 — mejora de calidad cuando la llamada es web. |
| **C. Dialer integrado** (Twilio) | Llamar directamente desde el CRM (Voice JS SDK); Twilio Media Streams entrega el audio de ambos lados separado (diarización perfecta) | leg navegador $0.004/min + leg telefónico: **EE.UU. ~$0.014/min**, **Ecuador fijo $0.32/min, móvil $0.53/min** ⚠️ | Fase 3 — para agencias que venden a EE.UU./Canadá es barato y profesional. Para Ecuador es caro: mantener modo A. |

**Recomendación:** empezar con **A** (sirve para todos, cuesta ~cero), diseñar el código
para enchufar **C** después sin reescribir (la transcripción es una interfaz).

---

## 3. Arquitectura en nuestro stack

```
┌─ CRM (React) ─────────────────────────────────────────────────┐
│  Sala de llamada (nueva sección "Copilot")                    │
│  ├─ 🎤 useTranscript() ── Web Speech API (MVP, gratis, es)    │
│  │                        └─ upgrade: Deepgram WS (Nova-3)    │
│  ├─ Transcripción en vivo (rolling)                           │
│  ├─ Panel de sugerencias (streaming)                          │
│  └─ Botones: objeción detectada / pedir ayuda / cerrar        │
└──────────────┬────────────────────────────────────────────────┘
               │ SSE / fetch stream
┌─ Supabase ───▼────────────────────────────────────────────────┐
│  Edge Function `copilot`                                      │
│  ├─ auth (usuario activo del CRM)                             │
│  ├─ carga playbook (industria del lead) + ficha del lead      │
│  ├─ Claude API (streaming, prompt caching):                   │
│  │    system = personalidad coach + metodologías + battlecards│
│  │    (cacheado) · user = transcript reciente + evento        │
│  └─ devuelve sugerencia en stream (<2s primer token)          │
│                                                               │
│  Tablas nuevas:                                               │
│  ├─ sales_playbooks  (la BASE DE CONOCIMIENTO)                │
│  │    industry, methodology, stage, objection, response,      │
│  │    script, tips — editable desde el CRM                    │
│  └─ call_sessions    (una por llamada)                        │
│       lead_id, user_id, transcript, suggestions, summary,     │
│       outcome, duration — historial + análisis                │
└───────────────────────────────────────────────────────────────┘
```

**Modelos Claude** (vía Edge Function, API key server-side):
- **Coach en vivo**: `claude-opus-4-8` con `output_config: {effort: "low"}` + streaming
  (primer token rápido, máxima calidad de venta). Alternativa económica seleccionable:
  `claude-haiku-4-5` (~10x más barato, latencia mínima).
- **Resumen post-llamada + scoring**: `claude-opus-4-8` (una sola llamada al colgar).
- **Prompt caching**: el system prompt (metodologías + battlecards de la industria +
  ficha del lead) se cachea al inicio de la llamada → cada sugerencia solo paga el
  delta del transcript (~90% de descuento en input).

**La base de conocimiento** (lo que pediste de "libros"): yo genero el contenido
seed — destilado de metodologías públicas (SPIN Selling, Challenger, Sandler,
Straight Line), guiones de cold calling para negocios locales, y **battlecards de
objeciones en español** por industria (peluquería, dentista, restaurante…):
"no me interesa", "está caro", "ya tengo quien me lo haga", "mándame info",
"no tengo tiempo", "déjame pensarlo"… con respuestas probadas por metodología.
Editable desde el CRM para que cada agencia meta su propio playbook (valor de venta
del producto).

---

## 4. El flujo de René (UX)

1. En el Lead Finder / Prospectos, clic **"Llamar con Copilot"** en un lead.
2. Se abre la **sala de llamada**: ficha del negocio (rating, sin-web, Google Maps) +
   **briefing pre-llamada generado por AI** (quién es, ángulo de apertura sugerido,
   3 objeciones probables con respuesta).
3. René marca desde su celular en altavoz y presiona **🎤 Iniciar**.
4. El CRM transcribe en vivo. El coach:
   - detecta **objeciones** → battlecard al instante;
   - sugiere **la siguiente pregunta** (SPIN) según la etapa de la conversación;
   - avisa **señales de compra** → guión de cierre;
   - botón "**Ayuda**" para pedir sugerencia manual en cualquier momento.
5. Al colgar: **resumen automático** → comentario en el lead + sugerencia de
   temperatura (frío/tibio/caliente) + próxima acción → tarea.

---

## 5. Fases

| Fase | Alcance | Resultado |
|---|---|---|
| **1. Copilot MVP** | Sala de llamada + Web Speech API (mic/altavoz) + Edge Function `copilot` streaming + knowledge base seed (tablas + contenido es) + briefing pre-llamada + resumen post-llamada al lead | René llama con coach en vivo, gratis de operar (solo LLM) |
| **2. Playbooks editables** | CRUD de battlecards/guiones por industria en el CRM + selector de metodología + subir documentos propios | Cada agencia personaliza su copiloto (feature vendible) |
| **3. Deepgram + dialer** | Transcripción premium (Nova-3, diarización, <300ms) + Twilio dialer para mercados baratos (EE.UU.) + grabación | Calidad profesional; llamadas sin salir del CRM |
| **4. Coaching & analytics** | Scorecards por llamada, estadísticas de objeciones (cuáles matan ventas), qué respuestas convierten, leaderboard de llamadas | El fundador ve QUÉ funciona — cierra el círculo con Reportes |

---

## 6. Costo de operación (por minuto de llamada)

| Componente | MVP (Fase 1) | Premium (Fase 3) |
|---|---|---|
| Transcripción | **$0** (Web Speech API, Chrome) | Deepgram Nova-3 ~$0.0077/min |
| Coach (LLM, con caching) | Opus 4.8: ~$0.02-0.05/min · Haiku: ~$0.003/min | igual |
| Telefonía | $0 (celular de René) | Twilio: EE.UU. ~$0.018/min · EC móvil ~$0.53/min ⚠️ |
| **Total 10 min de llamada** | **~$0.20-0.50 (Opus) / ~$0.03 (Haiku)** | ~$0.30-0.70 + telefonía |

→ Margen holgado para revender como feature premium (Cluely cobra $15-75/usuario/mes;
Nooks/Balto cobran cientos por asiento).

## 7. Riesgos y mitigaciones

- **Web Speech API solo es confiable en Chrome** y corta sesiones largas → auto-restart
  del reconocimiento + upgrade path a Deepgram ya diseñado (interfaz `useTranscript`).
- **Calidad del audio en altavoz** (modo A mezcla ambas voces) → el prompt del coach se
  diseña para transcript sin diarización; Fase 3 la agrega.
- **Latencia LLM** → prompt caching + effort low + streaming; degradar a Haiku si hace falta.
- **Privacidad/consentimiento de grabación** → en Fase 1 no grabamos audio, solo
  transcripción + aviso configurable; grabación real recién con Twilio (Fase 3) y
  disclosure según jurisdicción.

## Fuentes principales

- Cluely: [comparateur-ia.com](https://comparateur-ia.com/en/ai-tools/cluely) · [finalroundai.com review](https://www.finalroundai.com/blog/cluely-review-pros-cons) · [interviewcoder review](https://www.interviewcoder.co/blog/cluely-ai-review) · [clon open-source (pipeline OCR+Whisper+LLM+overlay)](https://github.com/nwx77/cheap-cluely) · [detección técnica del overlay](https://fabrichq.ai/blogs/how-to-detect-cluely-in-interviews)
- Competidores: [Trellus real-time coaching](https://www.trellus.ai/post/real-time-ai-sales-coaching) · [Nooks Live Battlecards](https://www.nooks.ai/ai-coaching) · [Balto objection handling](https://www.balto.ai/blog/best-ai-for-objection-handling-on-outbound-sales-calls/)
- STT: [Deepgram pricing](https://deepgram.com/pricing) (~$0.0077/min streaming, es <300ms) · [comparativa 2026](https://futureagi.com/blog/speech-to-text-apis-in-2026-benchmarks-pricing-developer-s-decision-guide/) · [Web Speech API límites](https://vocafuse.com/blog/web-speech-api-vs-cloud-apis/)
- Telefonía: [Twilio Voice JS SDK](https://www.twilio.com/docs/voice/sdks/javascript) · [Media Streams + transcripción en vivo](https://www.twilio.com/docs/voice/media-streams) · [pricing Ecuador](https://www.twilio.com/en-us/voice/pricing/ec) ($0.3162/min fijo, $0.5298/min móvil; SDK $0.004/min)
