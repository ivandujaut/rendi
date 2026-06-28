# Setup — Rendi

Guía operativa para levantar Rendi de cero: **Next.js + Supabase (Postgres + RLS) + Clerk**.
Seguí los pasos en orden; el paso 6 (claim `role`) es el que más se olvida y rompe todo en silencio.

## 0. Requisitos

- Node 18+ y npm
- Una cuenta en [Supabase](https://supabase.com) y otra en [Clerk](https://clerk.com)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Variables de entorno

Copiá el template y completá las claves:

```bash
cp .env.local.example .env.local
```

| Variable | De dónde sale |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (⚠️ secreta, solo backend) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API keys → `pk_...` |
| `CLERK_SECRET_KEY` | Clerk → API keys → `sk_...` (⚠️ secreta) |

`.env.local` está en `.gitignore`: nunca se commitea.

## 3. Base de datos (Supabase SQL Editor)

Ejecutá los scripts **en orden** (o pegá `db/all_in_one.sql` que los concatena):

```
db/01_schema.sql   → tablas + helpers clerk_uid() / is_teacher()
db/02_rls.sql      → Row Level Security + grade_attempt()
db/03_seed.sql     → Examen Modelo OATec 2026 (40 preguntas, publicado)
db/04_app_patch.sql→ per_topic + estadísticas docente
db/05_authoring_and_review.sql → create_exam() + revisión alumno
```

Corré una sola vez (las políticas `create policy` no son idempotentes).
Verificación rápida:

```sql
select count(*) from questions;        -- 40
select title, is_published from exams; -- "Examen Modelo OATec 2026" | true
```

## 4. Storage: bucket `figs` + figuras

1. Supabase → **Storage** → **New bucket** → nombre `figs` → **Public bucket: ON**.
2. Subí las 6 figuras del examen (`q9, q11, q14, q27, q28, q30`). Vienen aparte del
   repo (son contenido del examen). Con la `service_role` key y la carpeta local:

```bash
set -a; . ./.env.local; set +a
SRC="/ruta/a/figuras_oatec_2026"
for f in q9 q11 q14 q27 q28 q30; do
  curl -s -o /dev/null -w "$f.jpg -> %{http_code}\n" -X POST \
    "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/figs/$f.jpg" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: image/jpeg" -H "x-upsert: true" \
    --data-binary "@$SRC/$f.jpg"
done
```

Los paths `figs/qN.jpg` del seed resuelven a `/storage/v1/object/public/figs/qN.jpg`
(ver `publicFigureUrl()` en `lib/types.ts`).

## 5. Clerk: app + páginas de auth

1. Clerk Dashboard → **Create application** (nombre: Rendi) → habilitá Email/Password
   (y Google si querés).
2. Las URLs de sign-in/up ya están cableadas vía las variables
   `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` etc. del `.env.local`. No toques nada más.

## 6. Clerk ↔ Supabase (Third-Party Auth) — el paso crítico

Sin esto, el token de Clerk no incluye `role: authenticated`, Supabase trata cada
consulta como anónima y el RLS devuelve **todo vacío** (login funciona pero `/exams`
no muestra nada).

1. **En Clerk** → Configure → **Integrations** → activá **Supabase**.
   Esto agrega el claim `"role": "authenticated"` al session token. Status debe quedar **Enabled**.
2. Clerk te da un **Clerk domain** (ej. `https://<algo>.clerk.accounts.dev`).
3. **En Supabase** → Authentication → Sign In / Providers → **Third-Party Auth** →
   **Add provider → Clerk** → pegá el domain → guardá.

Para verificar que el token trae el claim, decodificá la cookie `__session` en el
navegador (logueado): debe figurar `"role": "authenticated"`.

## 7. Convertirte en docente

Después del primer login se crea tu fila en `profiles`. Para ver `/teacher`:

```sql
update profiles set role = 'teacher' where id = '<tu_clerk_user_id>';
```

Tu id (formato `user_...`) lo ves en `select id, full_name from profiles;` o en
Clerk → Users.

> Nota: el rol propio lo lee `getRole()` filtrando por tu `id`. Si tenés varias
> cuentas de prueba, asegurate de marcar la que realmente usás.

## 8. Correr

```bash
npm run dev
```

Entrá a `http://localhost:3000` → registrate/login → `/exams` muestra el simulacro
con sus figuras. Marcate teacher para ver `/teacher` (selector de examen +
estadísticas por pregunta y por tema).
