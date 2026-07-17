# Zerion CRM · Outreach

CRM minimalista para **ZerionStudio**: el fundador supervisa el outreach del equipo,
clasifica prospectos de **frío → tibio → caliente → reunión → cliente** en un tablero
arrastrable, registra por qué cada empresa es un cliente potencial, deja comentarios,
gestiona tareas diarias / semanales / mensuales y mide la conversión de todo el equipo.

> **Regla clave:** nadie se registra solo. **Solo el administrador crea las cuentas**
> (usuario + contraseña) de cada empleado.

El frontend está **completo y funcionando hoy** sobre una capa de datos local
(`localStorage`), diseñada para cambiarse a **Supabase** sin tocar los componentes.

---

## 🚀 Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:5173
```

Build de producción:

```bash
npm run build && npm run preview
```

### Cuentas de demostración

| Rol       | Correo                     | Contraseña   |
| --------- | -------------------------- | ------------ |
| Admin     | `admin@zerionstudio.com`   | `zerion2026` |
| Empleada  | `lucia@zerionstudio.com`   | `lucia123`   |
| Empleado  | `diego@zerionstudio.com`   | `diego123`   |

> Los datos viven en `localStorage`. Para reiniciarlos, borra el almacenamiento del
> sitio o llama a `resetDB()` desde `src/services/db.ts`.

---

## 🧭 Funcionalidades

- **Panel (Dashboard).** Empresas contactadas, cuántas pasan a tibio/caliente, reuniones,
  clientes cerrados, valor en pipeline, valor ganado, embudo de conversión, prospectos por
  fuente y **tabla de desempeño por empleado** (solo admin).
- **Prospectos (Kanban).** Tarjetas arrastrables entre etapas de temperatura. Búsqueda,
  filtro por empleado (admin), ficha completa con todos los datos, motivo de por qué es
  cliente potencial, y **línea de tiempo de comentarios / actividad**.
- **Tareas.** Columnas diarias / semanales / mensuales con progreso, vinculables a un
  prospecto y asignables (admin).
- **Equipo (solo admin).** Crear cuentas de empleado, cambiar contraseña, activar/desactivar,
  eliminar, y ver estadísticas por persona.
- **Auth.** Login por correo/contraseña, rutas protegidas y sección de admin restringida.
  Sin registro público.

---

## 🗂️ Estructura

```
src/
├── types/            # Modelo de dominio (User, Lead, Comment, Task…)
├── lib/
│   ├── constants.ts  # Etapas, colores de temperatura, fuentes, cadencias
│   ├── utils.ts      # Formato de fechas/dinero, helpers
│   └── supabaseClient.ts   # Cliente Supabase (listo, desactivado por defecto)
├── data/seed.ts      # Datos de ejemplo para el arranque local
├── services/         # ← ÚNICA capa que toca la persistencia
│   ├── db.ts             # Store localStorage (mock de la BD)
│   ├── authService.ts    # signIn / signOut / getCurrentUser
│   ├── usersService.ts   # CRUD de usuarios (crear empleados)
│   ├── leadsService.ts   # CRUD de leads + mover etapa + comentarios
│   ├── tasksService.ts   # CRUD de tareas
│   └── metricsService.ts # Cálculo de embudo / totales / stats por empleado
├── context/
│   ├── AuthContext.tsx    # Sesión y rol
│   └── DataContext.tsx    # Estado reactivo (users/leads/tasks) + mutadores
├── components/
│   ├── layout/       # Sidebar, Topbar, AppLayout, ProtectedRoute
│   ├── ui/           # Avatar, Modal, Badge, estados vacíos…
│   ├── leads/        # KanbanBoard, KanbanColumn, LeadCard, modales de lead
│   ├── tasks/        # TaskItem, TaskFormModal
│   ├── dashboard/    # StatCard, Funnel, SourceChart, EmployeeLeaderboard
│   └── team/         # UserFormModal
├── pages/            # Login, Dashboard, Leads, Tasks, Team, 404
└── App.tsx           # Rutas
supabase/
├── schema.sql        # Tablas + tipos + RLS (pégalo en el editor SQL)
└── functions/create-employee/  # Edge Function: creación de cuentas por el admin
```

---

## 🔌 Backend Supabase (YA CABLEADO)

La app ya usa Supabase de verdad. El interruptor es automático: **si hay variables
`VITE_SUPABASE_*` en `.env`, corre contra Supabase; si no, usa el mock local** para
desarrollo (ver `USE_SUPABASE` en `src/lib/supabaseClient.ts`). Cada servicio en
`services/*` tiene su implementación Supabase y su mock; el mapeo camelCase↔snake_case
vive en `services/mappers.ts`.

| Tipo TS (`src/types`) | Tabla (`schema.sql`) |
| --------------------- | -------------------- |
| `User`                | `profiles`           |
| `Lead`                | `leads`              |
| `Comment`             | `comments`           |
| `Task`                | `tasks`              |

### ✅ Checklist de go-live (pasos en tu dashboard/CLI)

1. **SQL** — pega **todo** `supabase/schema.sql` en el editor SQL de Supabase y ejecútalo.
   Es idempotente e incluye los `GRANT` (imprescindibles), las políticas **RLS** y un
   trigger que crea el perfil al crear un usuario de Auth.
2. **Desactiva signups** — Authentication → Providers → Email → apaga **"Enable Sign Ups"**
   (solo el admin crea cuentas).
3. **Crea tu admin** — Authentication → Users → **Add user** (`admin@zerionstudio.com` +
   contraseña, marca *Auto Confirm*). Luego, en el editor SQL:
   `update public.profiles set role='admin' where email='admin@zerionstudio.com';`
4. **Despliega la Edge Function** (alta de empleados desde la app):
   ```bash
   supabase login
   supabase link --project-ref kvgrjqszmfiylqwnuhpr
   supabase functions deploy admin-users
   ```
   (`SERVICE_ROLE`, `URL` y `ANON_KEY` se inyectan solas en las Edge Functions.)
5. **Local:** `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ya creado).
   **Netlify:** Site settings → Environment variables → añade esas dos y redeploy.
6. **Lead Finder** (buscar leads de Google Maps desde la app):
   - **Re-corre `supabase/schema.sql`** (idempotente): agrega la fuente `scraper`, la
     columna `leads.enrichment` y la tabla `lead_searches` (jobs de búsqueda).
   - Despliega la función y guarda tu token de Apify (server-side):
     ```bash
     supabase functions deploy find-leads
     supabase secrets set APIFY_TOKEN=apify_api_xxxxx   # el mismo del ScraperAI
     ```
   Cómo funciona: cada búsqueda arranca un run de Apify (Google Maps, ~$0.004/lugar) y
   la app hace *polling* del job hasta que termina (nunca se cuelga, aunque el scrape
   tarde). Deduplica por place_id + teléfono e inserta las empresas como prospectos
   "nuevo". **Sin `APIFY_TOKEN` la app usa datos de demostración**, así que puedes
   probar toda la UI sin gastar en Apify.
7. **Sales Copilot** (coach de ventas en tiempo real durante la llamada):
   - Despliega la función y dale tu key de Anthropic (server-side):
     ```bash
     supabase functions deploy copilot
     supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
     # opcional, más barato/rápido: supabase secrets set COPILOT_MODEL=claude-haiku-4-5
     ```
   - **Transcripción premium (opcional, recomendada para llamadas):** despliega la
     función de token y dale tu master key de Deepgram. La app pide un **token temporal**
     (~60s) y abre el WebSocket de Deepgram `nova-2` en español; tu master key **nunca**
     sale del servidor:
     ```bash
     supabase functions deploy deepgram-token
     supabase secrets set DEEPGRAM_API_KEY=<tu master key de Deepgram>
     ```
     **Sin `DEEPGRAM_API_KEY` la app cae sola a la Web Speech API** del navegador (gratis).
     El badge en la transcripción indica qué motor está activo (`Deepgram · premium` /
     `Navegador`), y si Deepgram se cae en plena llamada, sigue con Web Speech sin cortar.
   Cómo funciona: pon el celular en **altavoz** junto a la laptop; el navegador
   transcribe la llamada (Deepgram si está configurado; si no, Web Speech, **solo
   Chrome/Edge de escritorio**) y la función consulta a Claude con el **playbook de
   ventas** (`src/data/salesPlaybook.ts`: Belfort/Cardone/SPIN/Challenger + objeciones en
   español) para soplarte qué decir en streaming (<2s). Las objeciones se detectan **al
   instante en el cliente** (battlecard sin esperar al LLM). Al colgar, genera resumen →
   comentario en el prospecto + temperatura sugerida + tarea de seguimiento.
   **Sin `ANTHROPIC_API_KEY` usa el playbook local** (mock), así que toda la UI se prueba
   sin gastar en el API.
   - **Ajustes del Copilot** (botón ⚙️ arriba a la derecha): enséñale al coach *tu* oferta,
     precios, tono y frases que te funcionan. El coach los usa **por encima** del playbook
     para dejar de sonar genérico. Se guardan en tu navegador y viajan en cada consulta.
     El coach también **reconoce al prospecto**: carga su historial (notas/llamadas previas,
     etapa, último contacto) y retoma la conversación en vez de arrancar de cero.

La seguridad (quién ve/edita qué) la garantizan las **políticas RLS** del `schema.sql`:
el admin ve todo; cada empleado solo sus propios leads y tareas. La `anon key` es pública
por diseño (viaja en el bundle); el `service_role` solo vive en la Edge Function.

---

## 🛠️ Stack

React 19 · TypeScript · Vite · Tailwind CSS · React Router · dnd-kit (drag & drop) ·
Recharts · date-fns · lucide-react · Supabase (backend previsto).
