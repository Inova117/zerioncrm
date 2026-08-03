# 01 — Decisiones Bloqueadas

> **Fecha de verificación:** 2026-07-14 · Todos los precios y capacidades verificados en páginas oficiales por agentes independientes + pase de verificación adversarial (39 fact-checkers). Rúbrica de confianza: evidencia 40 / factibilidad solo-dev 30 / economía 20 / riesgo 10.

## Tabla de decisiones

| # | Decisión | Elección | Buy/Build | Costo mensual (50 leads/día) | Confianza | Evidencia clave |
|---|---|---|---|---|---|---|
| 1 | **Stack** | TypeScript end-to-end: Node 22 + Next.js 15 (dashboard) + SQLite/Drizzle + Playwright. Todo en un repo. | BUILD | $0 | **96** | Fortaleza declarada del founder; ningún componente exige otra cosa |
| 2 | **Fuente de leads** | **Apify** `compass/crawler-google-places` (plan Starter $29 con $29 de uso incluido). Fallback: **Outscraper** (500 gratis/30d, luego $3/1k). | BUY + glue | $29 (uso real ≈ $13.50 incl. 10 reviews/lead) | **94** | [Apify pay-per-event](https://help.apify.com/en/articles/10774732-google-maps-scraper-is-going-to-pay-per-event-pricing): $0.004/lugar + $0.0005/review — CONFIRMADO adversarialmente |
| 3 | **Places API oficial** | **RECHAZADA** como fuente de base de datos (solo se puede almacenar `place_id`; lat/lng cacheable 30 días). | — | — | **95** | [Políticas Places API](https://developers.google.com/maps/documentation/places/web-service/policies) — riesgo de terminación de cuenta Google Cloud propia |
| 4 | **Descubrimiento de email** | Waterfall **scrape-plus-verify**: crawler propio (contact/about/footer/mailto/JSON-LD) → Facebook About → Outscraper Emails ($3/1k dominios) → verificación 100% con **Reoon** POWER ($1.19/1k, créditos de por vida). Anymailfinder ($29/mes, cobra solo emails verificados) opcional mes 2+. Hunter/Snov **rechazados** (10-40× más caros, débiles en SMB local/LATAM). | HYBRID | ~$3-4 | **90** | [Reoon](https://www.reoon.com/email-verifier/), [Anymailfinder](https://anymailfinder.com/pricing), [test catch-all de Hunter](https://hunter.io/email-verification-guide/accept-all-catch-all/): 27% bounce en accept-all vs 1% en valid |
| 5 | **Política catch-all / info@** | `info@` aceptable para SMB unipersonales (grado B); catch-all → campaña separada en dominio secundario, pausa si bounce >5%; inválidos → canal WhatsApp. | — | $0 | **91** | Hunter (oficial): mantener accept-all en 2-5% de la lista; Reoon: role ≈ safe en deliverability |
| 6 | **Motor de auditoría** | BUILD híbrido: triage sin navegador (~2s/lead) → Playwright móvil en VPS (10-20s/lead, screenshot 390px como material de venta) → **PSI API gratis** solo para sitios reales. NO auto-hostear Lighthouse. No-website → 1 query SERP (Serper 2,500 gratis → Brave $5/1k) → Tier 1/2/3. | BUILD | $6 (VPS compartido) + $0 API | **92** | [PSI API gratis](https://developers.google.com/speed/docs/insights/v5/get-started), cuota 25k/día CONFIRMADA; [Custom Search API muere ene-2027](https://developers.google.com/custom-search/v1/overview) |
| 7 | **Minería de dolor** | BUILD: reviews (ya incluidas en Apify) clasificadas por Claude Haiku 4.5 contra taxonomía de dolores por industria → 1 frase con evidencia trazable. | BUILD | incl. en LLM | **93** | Reviews a $0.0005 c/u vía Apify; nada comprable produce esto |
| 8 | **LLM** | **Claude Haiku 4.5** ($1/$5 por MTok; Batch API −50%). ~$0.005/lead → $7.50/mes a 50/día. Guardrail: cada claim generado referencia un `finding_id`. | BUY API | $7.50 | **98** | [Pricing oficial Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) — CONFIRMADO adversarialmente |
| 9 | **Envío** | **Instantly Growth $47/mes**: buzones y warmup ILIMITADOS, 5,000 emails/mes, 1,000 contactos (cap fijo **reclamable vía delete** — confirmado en help center oficial). Smartlead rechazado (warmup = add-on $59). Verificación de Instantly (0.25 créditos/lead) NO usar — verificar externo con Reoon. | BUY | $47 | **95** | [instantly.ai/pricing](https://instantly.ai/pricing) + help 10273259; "Deleting leads frees up your uploaded contact limit" (oficial) |
| 10 | **Ruta de integración MVP** | **CSV-first** (spec exacta en reporte 05). Upgrade a **API push** (mismo plan Growth, incluye API) cuando la carga manual pase de ~10 min/día. Upgrade a Hypergrowth $97 SOLO si: contactos almacenados post-prune >800, o >4,500 emails/mes, o se necesitan webhooks. | — | $0 | **97** | API en todos los planes ([help 10432807](https://help.instantly.ai/en/articles/10432807-api-v2)); webhooks solo Hyper Growth+ (help 6261906) |
| 11 | **Buzones + dominios** | 4 × Google Workspace Business Starter ($7/user/mes) en 2 dominios lookalike (~$11/año c/u, 301→sitio principal). Ramp: 2 semanas solo warmup → 5→22/día/buzón en semana 7 (~88/día techo). | BUY | $28 + $2 | **91** | [Workspace pricing](https://workspace.google.com/pricing); límite oficial 2,000/día/user; 0.1%/0.3% spam confirmado en guías Google |
| 12 | **Hosting + cron** | VPS $6/mes (DigitalOcean 1GiB) con systemd timer 07:00 GMT-5. La laptop del founder solo para desarrollo. | BUY | $6 | **94** | [DO pricing](https://www.digitalocean.com/pricing/droplets) verificado |
| 13 | **Idioma de outreach** | **Bilingüe auto-detectado**: señales del dueño (html-lang, idioma de reviews, nombre del negocio) → es/en por lead; ambiguo → inglés + P.S. en español. México: siempre español formal (usted) + 1 frase en inglés como demo. | — | $0 | **90** | Gap-fill V1: Pew (38/38/24 dominancia), H Code, EF EPI México #103; sin benchmark es-vs-en de deliverability (evidencia de ausencia documentada) |
| 14 | **Segmento sin-website** | El de mayor intención (~35-40% de leads). Email cuando exista (FB About, ~15-20%); canal primario: **wa.me links manuales** desde el dashboard (10-20/día). **NO-GO** WhatsApp Business API para primer contacto frío (viola política de opt-in de Meta). | BUILD (links) | $0-10 | **90** | Gap-fill V2: política Meta + $0.074/msg LATAM; benchmarks click-to-chat 10-20% reply |
| 15 | **Reply sync** | v1.1, NO MVP: polling de la API en Growth; webhooks solo si se sube a Hypergrowth. Respuestas se leen en Instantly durante el MVP. | — | $0 | **93** | Webhooks gated (oficial); polling viable con `email_reply_count` |

## Decisiones con score < 90 (se presentan opciones, no LA respuesta)

### A. Nicho de arranque (advisory — el producto es industria-agnóstico) — score 88

Re-scoring tras verificación adversarial (los números del nicho dental fallaron el chequeo de fuentes primarias y fue **degradado**):

| Rank | Nicho × Geo | Score | Datos medidos (rentechdigital, abr-2026) |
|---|---|---|---|
| 1 | **Contratistas generales/remodelación (hispanos), Houston TX** | 84.5 | 3,394 negocios · 35.3% sin website · 22.9% emails (el mejor medido) |
| 2 | **Paisajistas, Houston TX** (sube de #3) | 76.5 | 1,919 · 43.6% sin website · 17.3% emails · reusa toda la infra del #1 |
| 3 | **Clínicas dental-tourism MX** (baja de #2) | ~74.8 | Email findability MEDIDA 24.6% (Tijuana 28.7%, Los Algodones 37%); pero no-website colapsa en hubs turísticos (Tijuana 37.8%, Algodones 16%) |

- **Recomendación:** arrancar con Houston contratistas + paisajistas (mismo metro, misma infra, 5,313 negocios).
- **Experimento barato para desambiguar dental:** pilot scrape de 200 clínicas (~$10-30 vía Apify) con gates: ≥20% emails directos Y ≥30% sin website o sin funnel de reservas. El pitch dental es "funnel de captación de pacientes que le gane al 20-30% de comisión de los directorios", no "necesitas página web".
- **Runway medido:** Houston+Dallas+San Antonio (2 verticales) = 10,700 negocios ≈ 4 meses a 2,700 leads/mes. Expansión: Dallas GC (mes 3) → Miami paisajistas (47.2% sin website, el más alto medido; mes 4) → Austin GC. **Tercer vertical debe estar activo en mes 5.**
- **Descartados con evidencia:** restaurantes mexicanos (4.1% emails — mata el email-first), clínicas dentales para mercado doméstico MX (economía de efectivo).

### B. Tasas del funnel (economía) — score 84

Las tasas de conversión no son verificables hasta enviar. El pase adversarial detectó y corrigió un **error de unidades** (el 3.43% de Instantly es por email enviado; nuestro modelo es por lead en secuencia de 3 pasos — ver reporte 04). Caso base defendible: **6.0% reply por lead entregado** (≈2.1% por email, POR DEBAJO del promedio de la plataforma). **Regla de re-calibración obligatoria:** tras los primeros ~500 leads entregados (~17 días), reemplazar TODAS las tasas asumidas por las medidas; si reply <3.5%, arreglar copy/targeting antes de escalar volumen.

## Score global de la arquitectura

Promedio ponderado de las 15 decisiones bloqueadas: **≈ 93/100** (≥ 90 → se presenta como respuesta única).
Los dos ítems <90 son advisory (nicho) e inherentemente no-verificables pre-envío (tasas), ambos con experimento de desambiguación definido.

**Nota sobre el "96% de confianza" pedido:** la rúbrica no soporta 96. Reportar 96 exigiría que las tasas del funnel estuvieran verificadas — y ningún benchmark existe para cold email en español a SMBs LATAM/hispanos (ausencia confirmada tras búsqueda dirigida). 93 es el número que la evidencia soporta; será mayor (o menor) con los datos reales de los primeros 500 envíos.
