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

## Usuario Admin (Clerk)
Iniciar sesión con el siguiente usuario: 
 - email: adminpaymentsclerk_test@iaw.com
 - contraseña: iawuser#

---

## Instrucciones para probar MP:
 1. Entrar a /checkout para crear un pago, elegir el monto (recomendado hacerlo en incógnito)
 2. Iniciar sesión dentro de MP con las siguientes credenciales:
  - email: test_user_5539129628521320852@testuser.com (en caso de que no esté ya iniciado, se envía en el body por defecto)
  - usuario: TESTUSER5539129628521320852
  - contraseña: vDOl8CvAXy
  - código mail (en caso de que lo pida): 117641
 3. Pagar con la tarjeta o dinero en cuenta. (CVV: 123)
 4. Chequear estado del pago en la página de admin dentro de /payments.

---

## Limitaciones

Ya que el sandbox no funciona correctamente la implementación se hace tomando el init_point que devuelve MercadoPago para un pago, logueandose con las credenciales de un buyer de prueba y haciendo la compra. Además de usar las credenciales del seller de prueba para toda la implementación.
Esto lleva a otros problemas como no permitir los reembolsos automáticos (por eso siempre que se hagan van a aparecer fallidos)
O a tarjetas de prueba que no son funcionales de acuerdo a la spec de MercadoPago.

---

## Instrucciones para probar Settlements y Payouts:
En la implementación final esto en realidad va a ser llamado por Shipping, pero provisoriamente se prueba de la siguiente manera:
 1. Buscar un pago aprobado y copiar su order_id
 2. Ir a /admin/order-delivered
 3. Buscar el id de order, y seleccionar crear una liquidación para el pago
 4. Ir a /admin/settlements para ver la liquidación creada
 5. Entrar al detalle de la liquidación y hacer clic en "Generar pago"
 6. Ir a /admin/payouts para ver el payout en cola
 7. Entrar al detalle del payout y marcarlo como pagado

---

## Por qué tenemos settlements y payouts

**Settlement (liquidación):** asiento contable que registra cuánto se le debe a un vendedor. Se crea automáticamente al confirmar la entrega de una orden. Calcula el bruto (subtotal + envío), la comisión del marketplace (10%) y el neto a pagar. Una liquidación puede existir sin payout — representa un derecho de cobro pendiente.

**Payout (pago a vendedor):** la ejecución real de la transferencia de dinero. Se crea manualmente desde una liquidación `pending` y pasa por estados `in_progress` → `completed` (o `failed`/`manual_review` si algo sale mal). Tiene datos operativos como `transfer_id`, intentos y errores.

Separarlos permite:
- **Conciliación:** saber en todo momento qué está calculado (settlement) vs. qué se transfirió realmente (payout).
- **Reintentos:** si un payout falla, se puede reintentar sin duplicar el asiento contable.
- **Batch de pagos:** el área de finanzas puede procesar varios payouts juntos contra Mercado Pago sin confundir los cálculos.
- **Auditoría:** una settlement puede tener múltiples payouts (ej. reintentos), manteniendo el historial completo.

El flujo completo: `Payment` → `Settlement` (pending) → `Payout` (in_progress) → `Payout` (completed) → `Settlement` (paid).

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

Abrir `http://localhost:3000`.
Nota: mercadopago no va a funcionar en localhost, es más fácil hacer la prueba en vercel.

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
┌─────────────┐     REST (X-Service-Token)       ┌──────────────┐
│  Buyer App  │ ───────────────────────────────→ │              │
│  Seller App │ ───────────────────────────────→ │ Payments App │
│ Shipping App│ ────POST /shipment-delivered───→ │              │
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
