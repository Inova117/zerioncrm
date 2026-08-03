# 05 — Contrato de Integración con Instantly

> Verificado 2026-07-14 contra fuentes oficiales: developer.instantly.ai, help.instantly.ai, instantly.ai/pricing, instantly.ai/terms. Confirmado por pase adversarial independiente.

## 1. Datos duros de la plataforma

- **API vigente: v2.** La v1 fue **deprecada el 19 de enero de 2026**; las keys v1 NO funcionan en v2. Construir SOLO sobre v2. ([help 10432807](https://help.instantly.ai/en/articles/10432807-api-v2))
- **Auth:** `Authorization: Bearer {api_key}` — keys con scopes granulares (`leads:create`, `campaigns:read`, etc.), generadas en Settings → Integrations → API.
- **API incluida en TODOS los planes Email Outreach, Growth incluido.** Solo los **webhooks** requieren Hyper Growth ($97) o superior.
- **Rate limits (workspace-wide, todas las keys):** 100 req/s y 6,000 req/min → HTTP 429. Irrelevante a nuestra escala (1 llamada bulk/día).
- **Planes:** Growth $47/mes ($37.60 anual) = 1,000 contactos subidos (cap FIJO, no mensual) + 5,000 emails/mes + buzones y warmup ilimitados. Hypergrowth $97 = 25,000 contactos + 100k emails (la página de pricing dice 100k; el help center dice 125k — planificar con 100k).

### El cap de 1,000 contactos es VIVIBLE en Growth (confirmado)

El help center oficial dice textualmente: **"Deleting leads from the campaign frees up your uploaded contact limit"** — es un cap de contactos *almacenados*, no una asignación acumulativa. Con ~700-880 contactos push/mes, secuencia de 2 semanas y prune semanal, el pico es ~440-510 almacenados (≈50% del cap).

**Reglas del prune job (endpoint `DELETE /api/v2/leads`, hasta 10,000/llamada):**
1. Filtrar SIEMPRE por `campaign_id` — borrar desde Lists NO decrementa el contador.
2. Borrar solo estados terminales (Completed / Bounced / Unsubscribed / Skipped) — nunca cortar una secuencia activa.
3. **Exportar antes de borrar** (List Leads) — el borrado es irreversible.
4. Releer el medidor de billing ≥10 min después del prune (lag de 5-10 min).
5. Dedupe entre campañas antes de subir — los duplicados consumen cap una vez por campaña.

**Triggers de upgrade a Hypergrowth ($97):** contactos post-prune >800 dos semanas seguidas, o proyección de pico >900, o >4,500 emails/mes, o necesidad de webhooks. Growth NO puede comprar add-ons de contactos.

## 2. Spec CSV (ruta MVP — el criterio de éxito es importar con CERO edición manual)

**Reglas de archivo:** UTF-8, delimitado por comas (Excel: "CSV UTF-8 (comma delimited)"). Primera fila = headers. Headers: **máx. 20 caracteres**, únicos, inicio con mayúscula (recomendación oficial, no requisito duro). Máx. **50 columnas de variables custom**. La columna Email es obligatoria y debe *mapearse* al campo predefinido Email (no necesita ser la primera — corrección del pase adversarial —, pero la ponemos primera igual: es gratis y elimina un paso de mapeo).

**Columnas que genera nuestro exportador:**

| Header CSV | Mapea a | Tag en template | Notas |
|---|---|---|---|
| `Email` | Email (predefinido, obligatorio) | — | Solo verification `valid`/`role` (grado A/B) |
| `First Name` | First name | `{{firstName}}` | Nombre del decisor si se encontró; si no, vacío + fallback en template |
| `Last Name` | Last name | `{{lastName}}` | |
| `Company Name` | Company name | `{{companyName}}` | Nombre del negocio (de Maps) |
| `Phone` | Phone (predefinido) | — | E.164 |
| `Website` | Website (predefinido) | — | vacío para segmento no-website |
| `Personalization` | Personalization | `{{personalization}}` | — |
| `FirstLine` | Custom | `{{FirstLine}}` | Primera línea: referencia UN hallazgo verificado |
| `PainPoint` | Custom | `{{PainPoint}}` | Frase de dolor con evidencia |
| `PsLine` | Custom | `{{PsLine}}` | P.S. opcional (p.ej. switch de idioma) |
| `Language` | Custom | `{{Language}}` | `es` / `en` — para filtrar por campaña |
| `GoogleRating` | Custom | `{{GoogleRating}}` | |
| `ReviewCount` | Custom | `{{ReviewCount}}` | |
| `Segment` | Custom | `{{Segment}}` | `no_website` / `has_website` / `social_only` |
| `LeadScore` | Custom | `{{LeadScore}}` | 0-100 (para ordenar en Instantly) |

**Regla de oro de variables:** el tag `{{X}}` debe coincidir con el header **EXACTAMENTE, case-sensitive** (columna `FirstLine` → `{{FirstLine}}`). Tokens únicos sin espacios. No nombrar customs parecido a predefinidos. Confirmar los tags predefinidos exactos en el variable picker del editor la primera vez (ASSUMPTION: camelCase más allá de `{{firstName}}`/`{{companyName}}` inferido).

**En el diálogo de import:** "Check for Duplicates Across All Campaigns/Lists" = **ON**; "Verify leads" = **OFF** (0.25 créditos/lead — ya verificamos externo con Reoon, que es ~10× más barato).

## 3. Contrato API (ruta v1.1 — mismo plan Growth)

| Método | Path | Campos clave | Límites |
|---|---|---|---|
| POST | `/api/v2/leads/add` | `campaign_id` **XOR** `list_id`; `leads[]` con email, first_name, last_name, company_name, website, phone, personalization + **`custom_variables`** (objeto raíz por lead, valores string/number/boolean); `skip_if_in_workspace: true`; `verify_leads_on_import: false` | **Máx. 1,000 leads/request.** Respuesta: `leads_uploaded`, `duplicated_leads`, `invalid_email_count`, `remaining_in_plan` |
| POST | `/api/v2/leads` | Lead individual, mismos campos | 402 si no hay plan activo |
| GET | `/api/v2/campaigns` | `search`, `status` (0 Draft/1 Active/2 Paused/3 Completed), `limit` ≤100, cursor `starting_after` | Para resolver campaign_id por nombre |
| DELETE | `/api/v2/leads` | filtro por `campaign_id` + status | Hasta 10,000/llamada — el prune job |
| POST | `/api/v2/email-verification` | `email` | 0.25 créditos/lead — NO usar |

**Flujo diario v1.1:** `GET campaigns?search=` → 1 × `POST /leads/add` (batch del día, `skip_if_in_workspace: true`) → registrar `pushes` por lead → semanal: export + `DELETE` de terminales.

**Webhooks (solo si Hypergrowth):** eventos `reply_received`, `lead_interested`, `email_bounced`, `lead_unsubscribed`, `lead_meeting_booked`, etc. (17+). En Growth: polling de `email_reply_count` en el objeto Lead.

## 4. ToS de Instantly — lo que nos aplica

- Cold outreach B2B NO está prohibido (es el caso de uso core), pero el suscriptor es "the sole sender and initiator": responsabilidad CAN-SPAM es nuestra.
- **Opt-out prominente obligatorio** en cada campaña + supresión inmediata.
- **"Data Resale Activity" = breach material no-curable** → nunca revender/empaquetar los datos de leads.
- Listas compradas/desactualizadas = spam traps → suspensión. Mitigación: scrape fresco + verificación Reoon pre-push + bounce <2%.

## 5. Disparadores de upgrade (resumen)

| De → A | Disparador |
|---|---|
| CSV → API push | Carga manual >10 min/día, o se quiere dedupe automático vía `skip_if_in_workspace` |
| Growth → Hypergrowth | Contactos post-prune >800 (2 semanas seguidas) · pico proyectado >900 · >4,500 emails/mes · webhooks para reply-sync en dashboard |
