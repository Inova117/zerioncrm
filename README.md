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

## 🔌 Migración a Supabase (el "mapa del backend")

Todo está preparado para que el cambio sea **quirúrgico**: los componentes y los contextos
llaman a `services/*`; solo hay que reimplementar esos servicios contra Supabase.

**Pasos**

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Pega `supabase/schema.sql` en el editor SQL y ejecútalo (crea tablas, tipos y **RLS**).
3. En **Authentication → Providers → Email**, **desactiva "Enable sign ups"**
   (así nadie se registra solo).
4. Despliega la Edge Function: `supabase functions deploy create-employee`.
   Es la que crea empleados con el `service_role` tras verificar que quien llama es admin.
5. `cp .env.example .env` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
6. En `src/lib/supabaseClient.ts` pon `USE_SUPABASE = true` y sustituye el cuerpo de cada
   función de `services/*`. Cada método ya lleva un comentario `// SUPABASE: …` con la consulta.

**Correspondencia tipos ⇆ tablas**

| Tipo TS (`src/types`) | Tabla (`schema.sql`) |
| --------------------- | -------------------- |
| `User`                | `profiles`           |
| `Lead`                | `leads`              |
| `Comment`             | `comments`           |
| `Task`                | `tasks`              |

**Ejemplo de reemplazo** (en `leadsService.ts`):

```ts
// Mock (hoy):
async list() { return table.get('leads'); }

// Supabase (después):
async list() {
  const { data } = await supabase!.from('leads').select('*').order('position');
  return data ?? [];
}
```

La seguridad (quién ve/edita qué) queda garantizada por las **políticas RLS** del `schema.sql`:
el admin ve todo; cada empleado solo sus propios leads y tareas.

---

## 🛠️ Stack

React 19 · TypeScript · Vite · Tailwind CSS · React Router · dnd-kit (drag & drop) ·
Recharts · date-fns · lucide-react · Supabase (backend previsto).
