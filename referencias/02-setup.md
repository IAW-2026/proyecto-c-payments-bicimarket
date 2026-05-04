# 02 — Setup y Configuración Local

## Requisitos previos

Antes de empezar, asegúrate de tener instalado:

- **Node.js** 18+ (descargar desde [nodejs.org](https://nodejs.org))
- **npm** (viene con Node.js)
- **Git** (para clonar/trabajar con repos)
- **PostgreSQL** o **Supabase** (BD en la nube que usamos)

Verifica que estén instalados:

```bash
node --version    # Debe ser v18 o superior
npm --version
git --version
```

## Variables de entorno

Las variables de entorno son **configuraciones secretas** que no queremos en el código (como contraseñas).

### Crear `.env.local`

En la raíz del proyecto, crea un archivo `.env.local` (no lo commits a Git):

```bash
cd c:\Users\Rocco\Desktop\proyecto-c-payments-roccopaoloni
cp .env.example .env.local
```

### Variables necesarias

Completa el archivo `.env.local` con estas variables. Si no las tienes, puedes usar valores de test:

```env
# Base de datos PostgreSQL (reemplaza con tu Supabase o local)
DATABASE_URL="postgresql://usuario:password@localhost:5432/payments_db"
DIRECT_URL="postgresql://usuario:password@localhost:5432/payments_db"

# Clerk (autenticación - opcional para tests locales)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# MercadoPago (pagos)
MP_ACCESS_TOKEN="TEST-..."  # Token de test de MP
MP_WEBHOOK_KEY="..."         # Firma para validar webhooks

# Seguridad inter-app
SERVICE_TOKEN_SECRET="mi-secreto-super-seguro-123"

# URL pública (para webhooks)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Dónde obtener cada variable

**DATABASE_URL**:

- Si usas Supabase (recomendado): copia la URL de tu proyecto en Settings → Database
- Si usas local PostgreSQL: `postgresql://postgres:password@localhost:5432/payments`

**Clerk** (opcional para desarrollo):

- Ve a [clerk.com](https://clerk.com), crea un proyecto
- Copia las keys de Dashboard → API Keys

**MercadoPago**:

- Ve a [developers.mercadopago.com](https://developers.mercadopago.com)
- Crea una cuenta de test
- Copia el Access Token del dashboard

**SERVICE_TOKEN_SECRET**:

- Puede ser cualquier string secreto (usa algo seguro)

## Paso 1: Instalar dependencias

Las dependencias son bibliotecas que el proyecto necesita.

```bash
npm install
```

Esto:

- Descarga todas las librerías del archivo `package.json`
- Crea la carpeta `node_modules/` (puede tardar 1-2 min)
- Crea `package-lock.json` (no lo toques)

## Paso 2: Generar cliente de Prisma

Prisma genera código automático basado en `schema.prisma`.

```bash
npx prisma generate
```

Esto crea la carpeta `src/generated/prisma/client.js`.

## Paso 3: Ejecutar migraciones

Las migraciones son cambios en la BD (crear tablas, columnas, etc.).

```bash
npx prisma migrate dev --name add_payments_core
```

Esto:

- Crea las tablas en tu BD
- Corre el SQL en `prisma/migrations/`

Si todo va bien, deberías ver un mensaje como:

```
✔ Created migration 20260413214353_add_payments_core
```

## Paso 4: Iniciar servidor de desarrollo

```bash
npm run dev
```

Esto:

- Compila TypeScript
- Inicia Next.js en `http://localhost:3000`
- **NO cierres esta terminal** (mantén el servidor corriendo)

Verás algo como:

```
> next dev
  ▲ Next.js
  - ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

## Paso 5: Verificar que todo funciona

Abre otra terminal y corre:

```bash
npm run smoke
```

Esto ejecuta tests básicos. Deberías ver:

```
Smoke tests: hitting /api/health
200 http://localhost:3000/api/health
...
Smoke tests: POST /api/v1/payments
201 http://localhost:3000/api/v1/payments
...
```

Si ves **201**, ¡todo funciona! ✅

## Troubleshooting

### Error: "database does not exist"

**Problema**: La BD no existe o URL es incorrecta.

**Solución**:

1. Verifica que `DATABASE_URL` en `.env.local` es correcta
2. Si usas local PostgreSQL, crea la BD:
   ```bash
   createdb payments_db
   ```
3. Re-run migraciones:
   ```bash
   npx prisma migrate dev
   ```

### Error: "Cannot find module '@/lib/prisma'"

**Problema**: El TS no compila.

**Solución**:

```bash
npx prisma generate
npm install
```

### Error en migraciones

Si `npx prisma migrate dev` falla:

```bash
# Reset BD (borra TODO, úsalo solo en dev)
npx prisma migrate reset

# O, ver qué pasó
npx prisma db push --skip-generate
```

## Acceder a la BD

Para ver datos directamente:

```bash
# Abre Prisma Studio (GUI para la BD)
npx prisma studio
```

Abre `http://localhost:5555` en el navegador. Ahí puedes:

- Ver todas las tablas
- Insertarfilas manualmente
- Editar datos

## Próximos pasos

- Lee `03-db-schema.md` para entender las tablas
- Lee `04-api-endpoints.md` para aprender los endpoints
