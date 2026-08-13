# Integración Meta (Facebook / Instagram) ↔ ZerioCRM

Dos flujos, independientes y complementarios:

| Flujo | Función | Dirección | Para qué |
|-------|---------|-----------|----------|
| **Inbound** | `meta-leadgen` | Meta → CRM | Trae los leads de Lead Ads al pipeline (columna **Nuevo**, `source = meta`). |
| **Outbound** | `meta-capi` | CRM → Meta | Avisa a Meta cada cambio de etapa (Conversions API) para que el algoritmo de ads optimice. **No trae leads.** |

Quedan enlazados por `meta_lead_id`: el inbound guarda el `leadgen_id` de Meta en cada lead, y el outbound lo reusa como llave de match perfecto en la Conversions API.

---

## 0) Prerrequisito — migración de base de datos

Corre la migración (agrega `source='meta'`, `leads.meta_lead_id`, `leads.fbclid` y el índice único idempotente):

```bash
supabase db push
# o pega supabase/schema.sql completo en el SQL Editor (es idempotente / espejo)
```

---

## 1) OUTBOUND — Conversions API (`meta-capi`)

Ya está cableado en el CRM: cada vez que un lead cambia de etapa (drag, Sales Copilot,
o el selector del modal de edición) se dispara el evento **fire-and-forget**. Mapa:

| Etapa CRM | Evento Meta |
|-----------|-------------|
| `nuevo` | `Lead` |
| `tibio` / `caliente` | `QualifiedLead` |
| `reunion` | `MeetingScheduled` |
| `cliente` | `Purchase` |
| `frio`, `no-acepto`, `perdido` | *(no se envía)* |

### Deploy + secrets

```bash
supabase functions deploy meta-capi

# ⚠️ REGENERA el access token en Events Manager antes de esto (el anterior se
#    compartió en chat y quedó comprometido). Data set → Configuración → token.
supabase secrets set META_CAPI_TOKEN=<nuevo access token del dataset>

# Opcionales (tienen default sensato):
supabase secrets set META_DATASET_ID=1561051434948784      # ya es el default
supabase secrets set META_LEAD_EVENT_SOURCE=ZerioCRM       # nombre que ve Meta
```

### Probar sin ensuciar datos reales (Test Events)

```bash
# 1) Copia el test_event_code del tab "Test Events" en Events Manager.
# 2) Setéalo como secret temporal — TODOS los eventos irán al tab de pruebas:
supabase secrets set META_TEST_EVENT_CODE=TEST12345

# 3) En el CRM, mueve cualquier lead (con email o teléfono) a "Tibio".
# 4) El evento aparece en segundos bajo Events Manager → Test Events.
# 5) Cuando confirmes, QUITA el secret para pasar a producción:
supabase secrets unset META_TEST_EVENT_CODE
```

Verificar versión deployada:

```bash
curl -sI -X OPTIONS https://<PROJECT>.supabase.co/functions/v1/meta-capi | grep x-meta-capi-version
```

---

## 2) INBOUND — Lead Ads webhook (`meta-leadgen`)

Trae los leads de los formularios de Facebook/Instagram al CRM.

### 2.1 Deploy (SIN verificación de JWT — el caller es Meta, no un usuario)

```bash
supabase functions deploy meta-leadgen --no-verify-jwt
```

La URL del webhook queda en:
`https://<PROJECT>.supabase.co/functions/v1/meta-leadgen`

### 2.2 Secrets

```bash
# Un string que TÚ inventas; lo pondrás igual en Meta en el paso 2.4.
supabase secrets set META_VERIFY_TOKEN=<inventa-un-string-secreto>

# App Secret de tu app de Meta (Configuración → Básica → Clave secreta).
supabase secrets set META_APP_SECRET=<app secret>

# Page Access Token con permiso leads_retrieval (ver 2.3).
supabase secrets set META_PAGE_TOKEN=<page access token>

# Opcional: uuid del profile dueño de los leads entrantes.
# Sin esto se asignan al primer admin activo.
supabase secrets set META_DEFAULT_ASSIGNEE=<uuid de un profile>
```

### 2.3 Permisos y Page Access Token (en developers.facebook.com)

1. App de Meta → **Add Product** → **Webhooks** y **Facebook Login** (o Graph API).
2. Permisos necesarios: `leads_retrieval`, `pages_show_list`, `pages_read_engagement`,
   `pages_manage_metadata`. Para producción con páginas de terceros: **App Review**.
3. Genera un **Page Access Token** de la página que corre los anuncios
   (Graph API Explorer → selecciona la página → genera token → conviértelo a
   token de larga duración). Ese es el `META_PAGE_TOKEN`.

### 2.4 Suscribir el webhook

1. App → **Webhooks** → objeto **Page** → **Subscribe to this object**.
2. **Callback URL**: la URL de la función (2.1).
3. **Verify Token**: el mismo string de `META_VERIFY_TOKEN`.
4. Meta hace un GET de verificación; la función devuelve el `hub.challenge`. ✅
5. En **Page** suscribe el campo **`leadgen`**.
6. Suscribe la página específica al webhook:

```bash
curl -X POST "https://graph.facebook.com/v26.0/<PAGE_ID>/subscribed_apps" \
  -d "subscribed_fields=leadgen" \
  -d "access_token=<PAGE_ACCESS_TOKEN>"
```

### 2.5 Probar

- Meta → **Lead Ads Testing Tool**
  (https://developers.facebook.com/tools/lead-ads-testing) → elige página y
  formulario → **Create Lead**.
- En segundos aparece un prospecto nuevo en la columna **Nuevo** del CRM, con
  `Fuente = Facebook / Meta` y el `meta_lead_id` poblado.
- Si reenvías el mismo lead de prueba, NO se duplica (índice único).

Verificar versión deployada:

```bash
curl -sI https://<PROJECT>.supabase.co/functions/v1/meta-leadgen | grep x-meta-leadgen-version
```

---

## Seguridad — notas

- **`meta-capi`**: exige usuario autenticado y dueño del lead (o admin). El PII se
  hashea SHA-256 en el servidor; el token vive solo en el secret, nunca en el bundle.
- **`meta-leadgen`**: valida la firma **HMAC-SHA256** (`X-Hub-Signature-256`) del
  body crudo con el App Secret **antes** de procesar. Fail-closed: sin `META_APP_SECRET`
  no procesa nada. Comparación en tiempo constante contra timing attacks.
- **Idempotencia**: `leads.meta_lead_id` tiene índice único parcial → los reintentos
  del webhook de Meta no crean leads duplicados.
