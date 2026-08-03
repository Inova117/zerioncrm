# 08 — PIVOT V3: Llamadas + WhatsApp (supersede el canal email)

> **Fecha:** 2026-07-15 · **Decisión del founder:** el canal de salida es **cold calling + WhatsApp manual**, no email frío. La presentación de leads es el **dashboard de la app** (cola de llamadas), no un CSV.
> Este documento supersede las partes de email de los reportes 03, 04, 05 y 06. Los reportes 01/02 siguen vigentes salvo lo marcado abajo.

## 1. Qué se elimina del stack

| Se va | Ahorro | Nota |
|---|---|---|
| Instantly Growth | $47/mes | ya no hay envío que tercerizar |
| 4 buzones Workspace/M365 | $28/mes | no se crean |
| Reoon + waterfall de emails | ~$4/mes | sin envío no hay bounce que proteger |
| Exportador CSV + contrato Instantly (reporte 05) | — | queda archivado por si se agrega email después |
| Stack de deliverability completo (SPF/DKIM/DMARC, warmup, ramp 7 semanas, Postmaster) | — | **desaparece la espera de 2 semanas: se puede llamar desde el día 1** |
| Los 2 dominios ya comprados | ($22 hechos) | quedan en reserva — si algún día se agrega el canal email, sirven |

## 2. Stack V3 final

| Pieza | Rol | $/mes |
|---|---|---|
| Apify Google Maps | fuente de leads (teléfono = dato clave, 90%+ cobertura) | $5-29 según volumen (25-50 leads/día) |
| Pipeline TS + SQLite (hecho días 1-3) | ingesta, dedupe, perfiles, costos | $0 |
| Serper | confirmar segmento sin-website | $0 (2,500 gratis) |
| Triage + PSI + screenshot | **municiones para la llamada** + colateral para WhatsApp | $0 |
| Claude Haiku 4.5 | qué hacen + dolor por reviews + talking points es/en (ficha de llamada) | ~$4-8 |
| Dashboard Next.js | **el producto**: cola de llamadas con tel:/wa.me + registro de resultados | $0 |
| Hosting | laptop del founder (VPS opcional después) | $0 |
| **TOTAL** | | **~$10-37/mes** (vs $122.50 del plan email) |

## 3. El dashboard como cola de trabajo

Por lead (ordenado por score): ficha (qué hacen, rating ★, hallazgos de auditoría, dolor en una frase, idioma), botón **llamar** (`tel:`), botón **WhatsApp** (`wa.me/<tel>?text=<mensaje personalizado>` + screenshot móvil listo para adjuntar), botones de resultado (no contestó / devolver llamada / interesado / **reunión** / no interesado / no llamar más), recordatorios de follow-up y digest matinal.

## 4. Economía V3 (órdenes de magnitud — SIN benchmark propio aún)

- **Capacidad solo-founder:** ~25 llamadas/día (2-3 h) + 10-15 WhatsApps/día.
- ASSUMPTION: contacto en llamada fría a SMB 20-30%; conversación→reunión 8-15% → 500 intentos/mes ≈ **8-22 reuniones/mes**. WhatsApp click-to-chat: reply 10-20% (benchmark del gap-fill V2) → +3-6.
- La meta de 10 reuniones/mes es alcanzable; **la restricción es tu tiempo, no el dinero**. Regla de re-calibración: tras 2 semanas de llamadas reales, reemplazar estas tasas por las medidas.
- Costo por reunión ≈ $1-4 en efectivo + tu tiempo.

## 5. Nichos re-rankeados (la restricción de email desaparece)

El ranking del reporte 01 pesaba 20% la encontrabilidad de emails — con teléfono al 90%+ ese criterio se cae:

1. **Contratistas hispanos Houston** — sigue #1 (ticket $3-8K, dolor de cotizaciones, español hablado).
2. **Restaurantes mexicanos Houston** — **REHABILITADO** (3,627 negocios, 42.6% sin website, dolor: comisiones delivery 30-45%, llamadas perdidas $35-85 c/u; descartado antes SOLO por el 4.1% de emails).
3. **Paisajistas Houston** — mismo metro, misma infra.

## 6. Legal V3 (más simple que email, no cero)

- Llamadas B2B en frío: legales en EE.UU. El registro Do-Not-Call cubre líneas residenciales/personales — muchos dueños usan su celular personal: **marcado manual** (sin autodialer → sin problema TCPA), horario laboral del huso del lead, y el "no me llames más" se respeta al instante (tabla `suppression` ahora también guarda teléfonos).
- WhatsApp: **solo manual desde WhatsApp Business App** (número dedicado, ramp 10→20/día). La API de WhatsApp para primer contacto frío sigue NO-GO (política de opt-in de Meta).
- Ecuador→US: llamar por VoIP (Google Voice o similar) para costo ~$0.

## 7. Plan revisado (días restantes)

| Día | Trabajo | Done-criteria |
|---|---|---|
| 1-3 ✓ | scaffold + esquema + ingesta/dedupe | hecho y verificado |
| **4** | segmentación (SERP) + triage sin navegador + idioma | cada lead con segment, triage y language |
| 5 | PSI + Playwright (screenshot = colateral WhatsApp) + findings rankeados | top-2 hallazgos por lead, trazables |
| 6 | dolor por reviews + scoring + **ficha de llamada** (talking points es/en) | ficha completa para el top del batch |
| 7 | dashboard: cola de llamadas, tarjetas, tel:/wa.me, registro de resultados | flujo llamar→registrar end-to-end |
| 8 | follow-ups + digest + cron local + QA | mañana típica: abrir app → 25 fichas listas |
| 9 | batch real de Houston (necesita `APIFY_TOKEN`) + calibración de campos del actor | primeras llamadas reales |

**Fuera del MVP V3:** todo lo de email (archivado, reversible), VPS (hasta que moleste la laptop), multi-usuario, grabación/notas de llamada avanzadas.
