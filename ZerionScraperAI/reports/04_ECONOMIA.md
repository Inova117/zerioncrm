# 04 — Modelo Económico

> Verificado 2026-07-14. Benchmarks 2025 citados de fuentes primarias; el modelo fue corregido por un pase adversarial + gap-fill que detectó un **error de unidades** en la v. inicial (ver §2). Toda tasa no verificable está marcada ASSUMPTION y sujeta a la regla de re-calibración (§6).

## 1. Anclas de benchmark (verificadas en vivo)

| Fuente | Dato | URL |
|---|---|---|
| Instantly Cold Email Benchmark Report 2026 (miles de millones de envíos, datos 2025) | Reply promedio **3.43% por email enviado**; top-25% ≥5.5%; top-10% ≥10.7%; bounce objetivo <2% | [instantly.ai/cold-email-benchmark-report-2026](https://instantly.ai/cold-email-benchmark-report-2026) |
| Belkins 2025 (7.5M emails) | Empresas de **0-10 empleados responden MÁS que ningún otro segmento** (0.72%) y founders/owners más que ninguna seniority — exactamente nuestro ICP | [belkins.io](https://belkins.io/blog/cold-email-response-rates) |
| TheDigitalBloom 2025 (sobre estudio Hunter 11M) | Personalización profunda **+52%** reply; cohortes ≤50 leads **2.76×**; 48-65% de replies son positivas; meeting rate 0.69-2.34% de contactados | [thedigitalbloom.com](https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/) |

## 2. La corrección de unidades (importante para leer todo lo demás)

El 3.43% de Instantly es **replies ÷ emails enviados**. Nuestro modelo usa **reply por lead entregado a lo largo de la secuencia de 3 pasos**. Un 6.0% por lead ≈ **2.1% por email** — es decir, el caso base está POR DEBAJO del promedio de la plataforma, a pesar de acreditar tres vientos de cola documentados (ICP owner-operated = el más respondedor; micro-lotes ≤50 = 2.76×; personalización profunda = +52%). La dispersión entre fuentes es enorme (Belkins 0.45% vs Instantly 3.43% por email = 7.6×) y **no existe benchmark para español/LATAM** — de ahí la regla de re-calibración del §6.

**Tasas finales del modelo:**

| Etapa | Conservador | Base | Ancla |
|---|---|---|---|
| Contactable (email verificado) | 35% | 42% | Waterfall del reporte de email discovery (ASSUMPTION calibrable; Houston GC medido: 64.7% con website) |
| Entregado | 95% | 97.5% | Bounce <2% con listas verificadas (heurística de industria, no cifra de Google) |
| **Reply por lead entregado (secuencia 3 pasos)** | **3.43%** | **6.0%** | Instantly 2026 / conversión de unidades §2 |
| Positivas / replies | 30% | 50% | TheDigitalBloom 48-65% con recorte por info@ (ASSUMPTION) |
| Positiva → llamada agendada | 30% | 40% | ~33-36% implícito en meeting rates (ASSUMPTION) |
| **Llamadas por lead sourceado** | **0.10%** | **0.49%** | producto |

## 3. Funnel y costos por volumen

### A 50 leads/día (1,500/mes) — volumen de diseño

| Etapa | Conservador | Base |
|---|---|---|
| Sourceados | 1,500 | 1,500 |
| Contactables | 525 | 630 |
| Entregados | 499 | 614 |
| Replies | 17 | 37 |
| Positivas | 5 | 18 |
| **Llamadas/mes (email)** | **1.5** | **7.4** |
| + WhatsApp manual (segmento no-website, 10-20 msgs/día) | +2 | +3-6 |
| **Total llamadas/mes** | **~3.5** | **~10-13** |

**Costo mensual itemizado a 50/día: $122.50** (headroom $27.50 bajo el tope de $150)

| Ítem | $/mes | Base verificada |
|---|---|---|
| Instantly Growth | 47.00 | 630 push/mes × 3 pasos = 1,890 emails ≤ 5,000; prune semanal mantiene ~440-510 contactos ≤ 1,000 |
| Apify Starter | 29.00 | uso real ≈ $13.50 (1,500 lugares + detalles + 15,000 reviews) |
| Waterfall email (Outscraper + Reoon) | 3.00 | crawler propio $0; Reoon $1.19/1k |
| Claude Haiku 4.5 | 7.50 | 1,500 × $0.005 (3K in + 400 out); Batch API lo bajaría a $3.75 |
| VPS | 6.00 | DigitalOcean 1 GiB |
| 4 buzones Workspace | 28.00 | $7/user/mes |
| 2 dominios | 2.00 | ~$11/año c/u |
| **TOTAL** | **$122.50** | (~$110 con Instantly anual + intro Workspace) |

### A 70 leads/día (2,100/mes) — **PLAN DE RECORD para 10 llamadas/mes**

- Base (6.0%): **10.3 llamadas/mes solo por email** (+3-6 de WhatsApp).
- Envíos: ~88 emails/día → cabe en 4 buzones a 22/día; 2,646 emails/mes ≤ 5,000 (Growth OK).
- Costo: **~$131/mes** → **~$13.10 por llamada agendada**.
- Downside sourceado (reply 3.43% por lead): se necesitan **119 leads/día**, 6 buzones, ~$166-177/mes en Growth = **~$17/llamada** (~$22 si el cap fuerza Hypergrowth). El riesgo cambia la *carga de trabajo*, no la viabilidad.
- Peor caso completo (todas las tasas en conservador): 330/día, ~$359/mes, ~$36/llamada — NO cabe en el ramp de 4 buzones; requeriría ~14 buzones en ~7 dominios. **No diseñar para este caso; es el trigger de arreglar copy, no de comprar volumen.**

### A 200 leads/día (6,000/mes) — escala

| Etapa | Conservador | Base |
|---|---|---|
| Contactables | 2,100 | 2,520 |
| Entregados | 1,995 | 2,457 |
| Replies | 68 | 147 |
| **Llamadas/mes (email)** | **6.1** | **29.5** |

**Costo mensual: ~$279.50** — excede el tope de $150, que fue definido para 50/día:

| Ítem | $/mes |
|---|---|
| Instantly Hypergrowth (7,560 emails/mes > 5,000) | 97.00 |
| Apify ($29 Starter + $25 overage) | 54.00 |
| Waterfall email | 10.00 |
| Haiku 4.5 | 30.00 |
| VPS | 6.00 |
| 11 buzones (252 emails/día ÷ 25) | 77.00 |
| 6 dominios | 5.50 |
| **TOTAL** | **$279.50** |

Los drivers del salto son el tier de Instantly (+$50) y la flota de buzones (+$49) — **la infraestructura de envío es 55-60% del costo a escala**, no los datos ni el LLM.

## 4. Métricas unitarias

| Métrica | 50/día | 70/día | 200/día |
|---|---|---|---|
| Costo por lead **contactable** | $0.19 (base) / $0.23 (cons.) | ~$0.15 | $0.11 / $0.13 |
| Costo por **llamada agendada** (base) | ~$14-16 | **~$13.10** | ~$9.50 |
| Costo marginal por 1,000 leads extra | ~$14-19 (LLM $5 + Apify $9 + waterfall $2-4) | | |

## 5. Sanidad de ingresos

10 llamadas/mes × cierre 15-25% × proyecto $4K-8K = **$6,000-$20,000/mes de valor esperado** contra $124-359/mes de costo → ratio **17×-164×**. Un proyecto de $4K cerrado financia la máquina a 50/día por ~2.7 años. (Corrección adversarial: "medio proyecto financia un año" solo vale si el costo ≤ ~$167/mes — cierto en el plan de record, falso en el peor caso de $359.) **La restricción real nunca es el presupuesto: es la capacidad del founder** (10+ llamadas/mes + entrega de 2-2.5 proyectos concurrentes) y la higiene de deliverability.

## 6. Sensibilidad y regla de re-calibración

**La variable que más mueve el costo por llamada es la tasa de respuesta** (swing 2.06× entre escenarios; dispersión 24× entre fuentes publicadas). Es también la más barata de atacar: profundidad de personalización es un problema de prompt a $0.005/lead; idioma correcto y micro-lotes cuestan $0.

**REGLA OBLIGATORIA:** tras los primeros **~500 leads entregados** (~17 días a 70/día), reemplazar TODAS las tasas asumidas por las medidas (reply secuencia-nivel, share positiva, tasa de agendado). **Si reply medida <3.5% → arreglar copy/targeting/nicho ANTES de escalar volumen. No agregar buzones para compensar mal copy.**

## 7. Supuestos principales (ASSUMPTION)

1. Reply 6.0% por lead entregado — inferido de benchmarks por-email convertidos de unidades + vientos de cola documentados; sin benchmark es/LATAM.
2. Contactable 42%/35% — waterfall no calibrado para el mix real; Houston GC medido sugiere el rango es plausible.
3. Positiva 50%/30% y agendado 40%/30% — anclados pero con recortes de juicio.
4. Split has-website 60/40 — el gap-fill que lo verificaría falló (error de servidor); calibrar con los primeros batches reales.
5. "Llamada agendada" = llamada realizada; no se modela no-show por separado (incluido en el 40%/30%).
6. Precios Workspace son lista US; facturación desde Ecuador puede variar levemente.
