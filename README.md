# Payments App — BiciMarket

Módulo de pagos del marketplace BiciMarket. Administra pagos, reembolsos, liquidaciones a vendedores y comprobantes, integrado con Mercado Pago.

**Stack**: Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma · Clerk · Tailwind CSS · shadcn/ui · TanStack Query · Axios · Zod

---

## Deploy

| Entorno    | URL                                                         |
| ---------- | ----------------------------------------------------------- |
| Producción | `https://proyecto-c-payments-bicimarket.vercel.app/admin`   |
| Local      | `http://localhost:3000`                                     |

---

## Instrucciones para probar MP:
 1. Entrar a /checkout para crear un pago, elegir el monto
 2. Iniciar sesión dentro de MP con las siguientes credenciales:
  - email/dni/usuario: TESTUSER5539129628521320852
  - contraseña: vDOl8CvAXy
  - código mail (en caso de que lo pida): 117641
 3. Pagar con la tarjeta o dinero en cuenta de su gusto. (CVV: 123, DNI: 12345678)
 4. Chequear estado en la página de admin dentro de /payments.



### Admin (Clerk)

Iniciar sesión en `/sign-in` con una cuenta Clerk que tenga `publicMetadata.admin = true`.

### Service Tokens (inter-app)

```env
BUYER_TO_PAYMENTS_SERVICE_TOKEN=change-me-buyer-to-payments
SELLER_TO_PAYMENTS_SERVICE_TOKEN=change-me-seller-to-payments
SHIPPING_TO_PAYMENTS_SERVICE_TOKEN=change-me-shipping-to-payments
PAYMENTS_TO_BUYER_SERVICE_TOKEN=change-me-payments-to-buyer
PAYMENTS_TO_SELLER_SERVICE_TOKEN=change-me-payments-to-seller
```

---

## Setup local

```bash
# 1. Clonar
git clone <repo>
cd proyecto-c-payments-bicimarket

# 2. Variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales (DB, Clerk, MP)

# 3. Instalar dependencias
npm install

# 4. Generar cliente Prisma
npx prisma generate

# 5. Migraciones + seed
npx prisma migrate dev
npx prisma db seed

# 6. Iniciar servidor
npm run dev
```

Abrir `http://localhost:3000`. Health check: `GET /api/health`.

---

## API

Toda la API vive bajo `/api/v1/`. Documentación interactiva en `/api-docs` (Swagger UI).

| Recurso        | Endpoints principales                                   |
| -------------- | ------------------------------------------------------- |
| Pagos          | `POST/GET /api/v1/payments` · `GET /payments/{id}`     |
|                | `POST /payments/{id}/cancel` · `PATCH /payments/{id}/confirm` |
| Reembolsos     | `POST /payments/{id}/refund` · `GET /api/v1/refunds`   |
| Liquidaciones  | `POST/GET /api/v1/settlements` · `GET /settlements/{id}` |
| Payouts        | `POST/GET /api/v1/payouts` · `PATCH /payouts/{id}`     |
| Comprobantes   | `POST/GET /api/v1/receipts` · `GET /receipts/{id}`     |
| Webhook        | `POST /webhooks/mercadopago` (externo)                  |
| Interno        | `POST /api/v1/internal/shipment-delivered`              |

**Auth**: Admin UI usa Clerk JWT con `publicMetadata.admin=true`. Server-to-server usa `X-Service-Token`.

---

## Arquitectura

```
┌─────────────┐     REST (X-Service-Token)     ┌──────────────┐
│  Buyer App  │ ───────────────────────────────→ │              │
│  Seller App │ ───────────────────────────────→ │ Payments App │
│ Shipping App│ ─────── POST /shipment-delivered→ │              │
└─────────────┘                                  └──────┬───────┘
                                                         │
                                                 ┌───────▼────────┐
                                                 │ Mercado Pago   │
                                                 │ (Checkout Pro) │
                                                 │ POST /webhooks │
                                                 └────────────────┘
```

---

## Documentación

Documentación completa en [`/docs/`](./docs/) y guías de referencia en [`/referencias/`](./referencias/).

Archivos clave:

- [`01-descripcion.md`](./docs/01-descripcion.md) — Visión general del proyecto
- [`03-apis.md`](./docs/03-apis.md) — Contratos de API inter-app
- [`04-modelo-de-datos.md`](./docs/04-modelo-de-datos.md) — Esquema de base de datos
- [`07-integracion-mercadopago.md`](./docs/07-integracion-mercadopago.md) — Integración con MP
- [`openapi.yaml`](./public/docs/openapi.yaml) — Spec OpenAPI 3.0

---

## Admin UI

Panel administrativo en `/admin/` con:

- Dashboard con KPIs (volumen, pagos, liquidaciones pendientes)
- CRUD de pagos, reembolsos, liquidaciones, payouts, comprobantes
- Búsqueda, filtros por estado/fecha, paginación con URL params
- Exportación CSV
- Modo oscuro
