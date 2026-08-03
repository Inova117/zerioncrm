# 00 — Resumen Ejecutivo: ZerionStudio Lead Machine

> ⚠️ **PIVOT V3 (2026-07-15):** el founder cambió el canal de salida a **cold calling + WhatsApp manual** — sin email frío, sin Instantly, costo ~$10-37/mes. Ver **[08_PIVOT_V3_LLAMADAS.md](08_PIVOT_V3_LLAMADAS.md)**, que supersede las partes de email de este documento y de los reportes 03/04/05/06. La investigación y decisiones de datos/auditoría/LLM siguen vigentes.

**Fecha:** 2026-07-14 · **Confianza global: 93/100** (rúbrica: evidencia 40 / factibilidad 30 / economía 20 / riesgo 10) · **Proceso:** 57 agentes de investigación, 221 fuentes, 39 verificaciones adversariales contra fuentes primarias, 6 gap-fills.

## El veredicto

**Construir la Lead Machine tal como la define el spec V2 es viable, entra en presupuesto y las decisiones están bloqueadas con evidencia.** El sistema: perfiles por industria+geo → ingesta diaria vía **Apify** → dedupe → waterfall de emails propio + **Reoon** → auditoría web híbrida (triage + Playwright + **PSI API gratis**) → dolor por reviews + variables con **Claude Haiku 4.5** → scoring → dashboard **Next.js/SQLite** → **CSV exacto para Instantly Growth** (API push en v1.1). Instantly es dueño del envío; nosotros de todo lo anterior. Stack 100% TypeScript, operable por una persona, en un VPS de $6.

## Los números

| Métrica | Valor |
|---|---|
| Costo mensual a 50 leads/día | **$122.50** (tope: $150 — headroom $27.50) |
| Costo mensual a 200 leads/día | **~$279.50** (el salto es Instantly Hypergrowth + flota de buzones) |
| **Plan de record para 10 llamadas/mes** | **70 leads/día → ~$131/mes → ~$13.10 por llamada agendada** (+3-6 llamadas extra/mes vía WhatsApp manual del segmento sin-website) |
| Costo por lead contactable | $0.15-0.19 |
| Valor esperado vs costo | 10 llamadas × 15-25% cierre × $4-8K = **$6K-20K/mes vs ~$131/mes → 17×-164×** |
| Esfuerzo de construcción | **14 días** (plan día a día en reporte 03); el moat (auditoría+dolor+personalización) es más de la mitad |

## Las 5 decisiones que más importan (todas verificadas en páginas oficiales)

1. **Datos: Apify** ($0.004/lugar + $0.0005/review) — la Places API oficial queda **rechazada** (su ToS prohíbe almacenar leads); Yelp rechazada ($229/mes sin website URL).
2. **Emails: scrape-plus-verify propio + Reoon** ($1.19/1k) — Hunter/Snov rechazados: 10-40× más caros y estructuralmente ciegos para SMBs locales y para el segmento sin-website (35-44% de los leads, el de mayor intención).
3. **Envío: Instantly Growth $47** — warmup y buzones ilimitados; el cap de 1,000 contactos es **reclamable borrando leads** (confirmado en docs oficiales) → no hace falta el plan de $97. **CSV-first**; la API (incluida en Growth) entra en v1.1.
4. **LLM: Claude Haiku 4.5** — $0.005/lead; el costo de personalización es ruido ($7.50/mes). Guardrail duro: cada frase generada debe trazar a un hallazgo verificado.
5. **Nicho de arranque (advisory):** contratistas hispanos + paisajistas en Houston (5,313 negocios medidos, 22.9%/17.3% emails, 35-44% sin website). Dental-tourism MX degradado a #3 tras verificación adversarial. Idioma: **bilingüe auto-detectado** por señales del dueño.

## Lo que la verificación adversarial corrigió (por qué este número es honesto)

- **Error de unidades en el funnel:** el benchmark de 3.43% de Instantly es *por email*, nuestro modelo es *por lead en secuencia* — el caso base corregido (6.0% por lead ≈ 2.1% por email) queda POR DEBAJO del promedio de plataforma. El "96% de confianza" pedido no es alcanzable con rigor: no existe benchmark de cold email es/en a SMBs hispanos, así que las tasas del funnel (score 84) se re-calibran con datos reales tras las primeras **500 entregas** (~día 17).
- El nicho dental falló el chequeo de fuentes primarias (volumen de pacientes no verificable, no-website colapsa en hubs turísticos) → degradado, con experimento de $10-30 definido para revivirlo.
- "Medio proyecto financia un año de máquina" era falso en el peor caso → corregido.

## Riesgo #1 y su mitigación

**Que la tasa de respuesta real aterrice en ~3.4% en vez de 6.0%.** Consecuencia: ~6 llamadas/mes en vez de 10-13 — sigue siendo 17× ROI, pero falla la meta. Mitigación integrada: regla de las 500 entregas (medir → arreglar copy antes de escalar), palancas gratis documentadas (micro-lotes 2.76×, personalización +52%, idioma por lead), y plan de capacidad pre-calculado para el downside (119 leads/día, 6 buzones, ~$17/llamada).

## Próxima acción

**Este es el GATE de la fase 1.** Con tu **«GO»**: día 1 = comprar dominios/buzones/planes y arrancar el warmup (checklist al final del reporte 03) + scaffold del repo. Día 10 = primer CSV importando en Instantly sin edición manual. Día ~15 = primeros envíos con buzones calientes.

| Leer más | |
|---|---|
| Tabla completa de decisiones + scores | [01_DECISIONES.md](01_DECISIONES.md) |
| Arquitectura + modelo de datos | [02_ARQUITECTURA.md](02_ARQUITECTURA.md) |
| Plan día a día | [03_MVP_14_DIAS.md](03_MVP_14_DIAS.md) |
| Funnel y costos | [04_ECONOMIA.md](04_ECONOMIA.md) |
| Contrato Instantly (CSV + API) | [05_INSTANTLY_CONTRATO.md](05_INSTANTLY_CONTRATO.md) |
| Riesgos y compliance | [06_RIESGOS_COMPLIANCE.md](06_RIESGOS_COMPLIANCE.md) |
| Las 221 fuentes | [07_FUENTES.md](07_FUENTES.md) |
