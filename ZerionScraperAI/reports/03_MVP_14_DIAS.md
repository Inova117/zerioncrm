# 03 — Plan MVP de 14 Días

> ⚠️ **SUPERSEDIDO POR V3 (2026-07-15):** el canal cambió a llamadas + WhatsApp. El plan vigente (~9 días, sin Instantly/CSV/warmup) está en **[08_PIVOT_V3_LLAMADAS.md](08_PIVOT_V3_LLAMADAS.md)**. Los días 1-9 de este documento siguen siendo la referencia para las etapas de pipeline que sobreviven (ingesta, triage, auditoría, dolor, scoring).

> **Milestone 1 (criterio de éxito del spec):** ingesta → enriquecimiento → CSV que importa en Instantly con variables intactas y CERO edición manual.
> **Regla anti-patrón:** el dashboard se pule DESPUÉS de que el pipeline produzca leads reales end-to-end.
> **El reloj de warmup (14 días mínimo) arranca el DÍA 1** — para que los buzones estén listos justo cuando el MVP termine. No hay tiempo muerto.

## Día por día

| Día | Trabajo | Done-criteria (verificable) |
|---|---|---|
| **1** | **Infra de envío + repo.** Comprar 2 dominios lookalike (~$22/año) y 4 buzones Workspace ($28/mes); configurar SPF + DKIM 2048 + DMARC p=none con rua + MX; plan Instantly Growth; enrolar los 4 buzones en warmup ilimitado. Scaffold del repo: TS + Next.js 15 + Drizzle/SQLite + esquema completo (tablas del reporte 02) + `.env`. | `dig TXT` muestra SPF/DKIM/DMARC correctos; los 4 buzones aparecen "warming" en Instantly; `npm run db:migrate` crea la base; CI local (`tsc --noEmit`) pasa. |
| **2** | **F1 Perfiles + orquestador.** CRUD de perfiles (industria, geos, idioma, filtros, leads/día). `pipeline run --profile=X`: máquina de estados por lead, registro en `runs`, logging pino, retry con backoff, idempotencia (re-ejecutar no repite trabajo). | Perfil "Houston GC" creado; correr el pipeline 2 veces seguidas produce 1 run con trabajo y 1 run no-op. |
| **3** | **F2 Ingesta + dedupe.** Adaptador Apify (interfaz `LeadSource` para poder enchufar Outscraper después): llamada al actor, polling del dataset, normalización de campos, reviews incluidas. Dedupe duro: `place_id` UNIQUE + dominio normalizado + teléfono E.164 contra TODO el histórico. | 100 leads reales de Houston GC en SQLite con rating/review_count/website nullable; re-run trae 0 duplicados; costo del run registrado en `costs`. |
| **4** | **Segmentación + triage.** Confirmación no-website: 1 query SERP (Serper) + clasificación Tier 1/2/3 (sin presencia / solo-social / roto). Triage sin navegador para los que tienen sitio: DNS/status/parked, SSL válido+expiración, año de copyright, idioma (html-lang + detector), regex de analytics. | Cada lead tiene `segment` y triage JSON; muestreo manual de 10 leads confirma 0 falsos "no-website". |
| **5** | **F3 Waterfall de emails.** Crawler propio (home + /contact + /contacto + /about + /nosotros + footer): mailto, regex anti-ofuscación, JSON-LD, links wa.me (capturar teléfono WhatsApp). Verificación bulk Reoon POWER → `lead_emails` con grado A/B/C según §política del reporte 01. | % contactable del batch de 100 medido y visible; ningún email sin `verification_status`; catch-all marcados grado C. |
| **6** | **F4 Auditoría Playwright.** Worker móvil-emulado (390px): viewport/overflow, scan de CTAs (tel:/wa.me/booking/quote/form), peso de página, socials muertos, hasta 20 links internos, screenshot guardado. Concurrencia 2, timeout duro. | 100% de leads con sitio auditados; screenshots en disco; ninguna auditoría cuelga el run. |
| **7** | **PSI + findings.** Cliente PageSpeed API (cola, ~4 concurrentes, retry en 500) → LCP/score móvil. Generador de `findings`: cada hallazgo con tipo, ranking de hook (tabla del reporte 01 §6), claim_es/claim_en y evidencia JSON. **Día buffer** para lo que se atrasó. | Top-2 findings por lead seleccionados por ranking; cada finding tiene evidencia trazable; semana 1 cerrada con pipeline ingesta→findings completo. |
| **8** | **F5 Minería de dolor.** Prompt de taxonomía de dolores por industria (playbook contratistas/paisajistas) + reviews del lead → Haiku 4.5 → 1 frase de dolor + evidencia (review citada o playbook). Structured output vía tool-use. | 100 hipótesis de dolor generadas; muestreo de 15 a mano: ≥13 defendibles; costo LLM por lead registrado. |
| **9** | **F6 Scoring + F10 variables.** Reglas de score con razones visibles (email verificado +20, no-website +25, rating bajo con muchas reviews +15, etc.). Generador de variables: FirstLine (cita UN finding verificado), PainPoint, PsLine, Language — **cada claim referencia `finding_id`** (guardrail duro: si no hay finding, no hay frase). | Variables para el top-30 del batch; validador automático rechaza cualquier variable sin finding_id; es/en según detección. |
| **10** | **F8 Exportador CSV Instantly.** Spec exacta del reporte 05 (UTF-8, headers ≤20 chars, Email primera, predefinidos + customs). Chequeo de supresión + solo grados A/B. **LA PRUEBA:** importar 10 leads a una campaña de prueba en Instantly. | Los 10 leads importan con **cero edición manual**, variables visibles en el variable picker, duplicate-check ON, verify OFF. **← Milestone 1 cumplido.** |
| **11** | **F7 Dashboard mínimo.** Tabla con filtros (perfil/fecha/score/segmento), badges de score con razones, card expandible (findings, dolor, variables, screenshot, emails con grado), vista de batch diario + digest (nuevos, top 10, costo del batch). | El founder revisa el batch del día en `localhost:3000` en <5 min y entiende POR QUÉ cada lead tiene su score. |
| **12** | **Flujo de aprobación.** Editar FirstLine/PainPoint inline, aprobar/descartar leads, export selectivo de aprobados, botón wa.me por lead del segmento no-website (link con opener personalizado URL-encoded). | Flujo mañanero completo: revisar → editar 2-3 → aprobar top-20 → descargar CSV → import OK. |
| **13** | **Producción.** Deploy a VPS $6 (systemd service + timer 07:00 GMT-5), migración de la base, run e2e con el volumen real del perfil (50/día), manejo de fallo de APIs (Apify caído → run marcado failed, alerta, sin corrupción). | El pipeline corre solo a las 07:00; a las 08:00 hay digest con ~50 leads nuevos enriquecidos y puntuados; matar una API key a medio run no corrompe nada. |
| **14** | **Campaña + QA final.** Secuencias de 3 pasos es/en en Instantly con {{variables}}, footer CAN-SPAM (dirección postal + opt-out en el idioma del email), spintax mínimo. QA humano de los primeros 100 leads aprobados; import CSV final. | Campaña configurada con 100 leads personalizados cargados; checklist CAN-SPAM del reporte 06 pasada; **el envío arranca cuando el warmup cumpla 14 días** (día ~15-16), a 5/día/buzón según ramp. |

## Explícitamente FUERA del MVP

| Qué | Cuándo |
|---|---|
| Push API a Instantly (`POST /api/v2/leads/add`) + prune job automático | v1.1 — trigger: carga manual >10 min/día |
| Reply sync (polling en Growth; webhooks si Hypergrowth) | v1.1 |
| Módulo WhatsApp más allá del link wa.me manual | v1.1 — los links del día 12 ya capturan el quick win |
| Optimización Batch API del LLM (−50%) | v1.2 — ahorra $3.75/mes; no vale el día de trabajo aún |
| Multi-usuario, auth, SaaS-ización | Decisión separada post-validación |
| CRM completo / gestión de propuestas | Nunca en este producto (anti-patrón) |
| Auto-envío sin revisión humana | Nunca en validación — el QA humano del batch es un gate de calidad |
| Segundo nicho (paisajistas) y expansión Dallas | Semana 5+ — solo cambiar el perfil, el código ya es industria-agnóstico |
| Fallback Outscraper implementado | Cuando Apify falle por primera vez (la interfaz `LeadSource` ya lo deja listo) |

## Dependencias externas a comprar el día 1 (checklist)

- [ ] 2 dominios (~$22/año, Porkbun/Cloudflare) — `zerionstudio.net`, `tryzerion.com` o similares
- [ ] Google Workspace Business Starter × 4 ($28/mes)
- [ ] Instantly Growth ($47/mes — anual $37.60 si hay convicción)
- [ ] Apify Starter ($29/mes) + token
- [ ] Reoon: pack 10k lifetime ($11.90, dura ~8 meses)
- [ ] Serper.dev cuenta (2,500 queries gratis)
- [ ] Anthropic API key (Haiku 4.5)
- [ ] VPS $6 (puede esperar al día 13; desarrollo local hasta entonces)
