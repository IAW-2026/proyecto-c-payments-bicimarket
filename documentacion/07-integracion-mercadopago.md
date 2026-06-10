# 7. Integracion de Mercado Pago en Payments

> **Archivo nuevo — no existía en `documentacion-vieja`**. Se creó porque el nivel de detalle de la integración real (SDK, Wallet Brick, webhook processor, state machine, idempotencia, mapa de archivos) excedía lo que cabía en `03-apis.md`. Las secciones §3, §7, §11 y §12 son las que más valor agregaron respecto al esquema previo.

> **Objetivo**: documentar como Payments se integra con Mercado Pago (Checkout Pro), describiendo el flujo real implementado, los componentes involucrados y la trazabilidad de cada operacion.

## 1. Stack tecnologico

| Componente | Libreria | Version |
|---|---|---|
| SDK servidor (crear preferencias) | `mercadopago` | 3.0.0 |
| SDK frontend (Wallet brick) | `@mercadopago/sdk-react` | 1.0.7 |
| HTTP client (consultas/refunds REST) | `axios` | 1.15 |

## 2. Arquitectura general

Payments usa **Checkout Pro** con redireccion al checkout hospedado por Mercado Pago, complementado con el **Wallet Brick** de Checkout Bricks para experiencia de pago embebida. El backend crea la preferencia, devuelve la URL de checkout + preference_id, y el frontend renderiza tanto el Wallet Brick como botones de redireccion directa. Procesa notificaciones via webhook. No se usa Checkout API (solo Preferencias y Wallet Brick).

### Flujo completo

```
Buyer App → POST /api/v1/payments → Payments
  ├─ Valida service token + Idempotency-Key
  ├─ Crea Payment record (status: pending)
  ├─ Crea preferencia en MP (POST /checkout/preferences)
  ├─ Registra PaymentAttempt (audit)
  └─ Devuelve { payment_id, checkout_url, preference_id, public_key }

Buyer App renderiza Wallet Brick + redirect buttons
  └─ Usuario paga via Wallet Brick o redireccion → MP → return_url + webhook

POST /webhooks/mercadopago ← MP
  ├─ Valida x-signature (HMAC-SHA256 + timestamp freshness)
  ├─ Persiste MpWebhookEvent (dedup)
  ├─ GET /v1/payments/{id} (consulta estado real)
  ├─ Reconoce Payment por external_reference / preference_id
  ├─ Crea PaymentAttempt (audit)
  ├─ Actualiza Payment (status, gateway_reference, method, card_last4)
  ├─ Si approved → crea Receipt
  └─ Marca MpWebhookEvent como processed

Shipping App → POST /api/v1/internal/shipment-delivered
  └─ Crea Settlement por seller (gross, 10% fee, net → pending)
```

## 3. Variables de entorno

### Credenciales MP

```
# Modo sandbox/testing
MERCADOPAGO_SANDBOX_MODE=true
MERCADOPAGO_SANDBOX_ACCESS_TOKEN=TEST-...
MERCADOPAGO_SANDBOX_PUBLIC_KEY=TEST-...

# Produccion
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...

# Expuesta al frontend (NEXT_PUBLIC_)
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-... (o APP_USR-...)
```

### Logica de seleccion (`src/services/mercado-pago.service.ts:4-14`)

Cuando `MERCADOPAGO_SANDBOX_MODE=true` se usan las credenciales `SANDBOX_*`. Si la SANDBOX no esta configurada, cae a la credencial de produccion como fallback. En produccion (`SANDBOX_MODE=false` o ausente), se usa la credencial `MERCADOPAGO_ACCESS_TOKEN` con el mismo fallback inverso.

### Webhook

```
MERCADOPAGO_WEBHOOK_SECRET=<hmac-secret>
MERCADOPAGO_WEBHOOK_URL=https://<app>/webhooks/mercadopago
```

Validacion en `src/lib/env.ts:39-54`: al menos una credencial (sandbox o prod) debe existir.

## 4. Servicio MP (`src/services/mercado-pago.service.ts`)

Encapsula toda la comunicacion con Mercado Pago. Tres funciones exportadas:

| Funcion | Endpoint MP | Proposito |
|---|---|---|
| `createPreference(preference)` | `POST /checkout/preferences` | Crea preferencia de pago via SDK `mercadopago` |
| `fetchPaymentDetails(paymentId)` | `GET /v1/payments/{id}` | Consulta estado real del pago (via axios directo) |
| `createRefund(paymentId, amountCents?)` | `POST /v1/payments/{id}/refunds` | Procesa reembolso parcial o total (via axios directo) |
| `getPublicKey()` | — | Retorna la public key segun modo sandbox/prod |

Se usa axios directo para `fetchPaymentDetails` y `createRefund` en vez del SDK para evitar comportamientos inconsistentes entre versiones. Timeout configurado a 10s.

## 5. Creacion de pago (`src/app/api/v1/payments/route.ts:POST`)

### Request

```http
POST /api/v1/payments
X-Service-Token: <buyer-to-payments-secret>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "order_id": "...",
  "buyer_profile_id": "...",
  "buyer_clerk_user_id": "...",
  "buyer_email": "...",
  "amount_cents": 15000,
  "currency": "ARS",
  "items_summary": [
    {
      "seller_profile_id": "...",
      "subtotal_cents": 10000,
      "shipping_cost_cents": 5000,
      "order_seller_group_id": "...",
      "items": [
        { "product_id": "...", "product_name_snapshot": "Producto", "unit_price_cents": 5000, "quantity": 2 }
      ]
    }
  ],
  "return_urls": {
    "success": "https://.../checkout?result=success",
    "failure": "https://.../checkout?result=failure",
    "pending": "https://.../checkout?result=pending"
  }
}
```

### Procesamiento

1. **Auth**: valida `X-Service-Token` (Buyer App) o admin Clerk JWT.
2. **Idempotencia**: requiere `Idempotency-Key`; si ya existe, retorna respuesta cacheada.
3. **Validacion**: Zod schema (`src/schemas/payment.ts`) — `createPaymentSchema`.
4. **Consistencia**: si se envio `items_summary`, verifica que `sum(subtotal_cents + shipping_cost_cents) === amount_cents`.
5. **`return_urls` opcional**: si no se envian, MP usa defaults y el Wallet Brick funciona igual.
6. **Payment record**: crea registro en DB con `status: 'pending'`.
7. **Preferencia MP**: construye el payload con `items` (mapeados desde `items_summary`), `payer.email` (tomado del request — no se persiste en DB), `external_reference: payment.id`, `auto_return: 'approved'`, `back_urls`.
7. **Audit**: registra `PaymentAttempt` con request/response payloads.
8. **Response** (201):

```json
{
  "data": {
    "payment_id": "...",
    "checkout_url": "https://mercadopago.com/...",
    "preference_id": "..."
  },
  "public_key": "TEST-..."
}
```

Si MP falla, registra `PaymentAttempt` con `status: 'rejected'` y retorna 502.

## 6. Frontend (`src/components/payments/checkout-form.tsx`)

Componente React del lado del cliente que:

1. Inicializa el SDK con `initMercadoPago(NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY)` (se ejecuta una vez via ref).
2. Boton "Pagar" → mutation que llama a `POST /api/v1/payments`.
3. Tras crear la preferencia, renderiza el Wallet brick de MP:
   ```tsx
   <Wallet initialization={{ preferenceId }} />
   ```
4. Tambien provee botones de "Ir al Checkout" (redirect) y "Abrir en nueva ventana".
5. Muestra resumen del pedido con items agrupados por seller.

## 7. Webhook (`src/app/webhooks/mercadopago/route.ts`)

### Recepcion

```http
POST /webhooks/mercadopago
x-signature: ts=1234567890,v1=abcdef123456...
x-request-id: uuid
Content-Type: application/json

{
  "action": "payment.updated",
  "data": { "id": "123456789" }
}
```

### Validacion de firma (`src/lib/webhook-signature.ts`)

1. **Parsear** `x-signature`: extrae `ts` y `v1` del formato `ts=<valor>,v1=<hex64>`.
2. **Construir manifest**: `id:{data.id};request-id:{x-request-id};ts:{ts};` (solo incluye `id:` si data.id existe, `request-id:` si x-request-id existe).
3. **Calcular HMAC-SHA256** con `MERCADOPAGO_WEBHOOK_SECRET`.
4. **Comparacion en tiempo constante**: `crypto.timingSafeEqual` (previene timing attacks).
5. **Freshness**: el timestamp no debe tener mas de 300s de antiguedad (`isTimestampFresh`).

### Procesamiento

1. Persiste `MpWebhookEvent` con `status: 'received'` (dedup por `mp_event_id: x-request-id`).
2. Si firma invalida → retorna 400.
3. Ejecuta `processMpWebhookEvent(mpEventId)` **sincronicamente** (no fire-and-forget: serverless congela la funcion tras la respuesta).
4. Retorna 200.

### Procesador (`src/services/mp-webhook-processor.ts`)

Secuencia defensiva (todo envuelto en try/catch, nunca lanza):

1. Busca `MpWebhookEvent` por `mp_event_id`, marca como `processing`.
2. Extrae `data.id` del payload.
3. Consulta estado real: `mpService.fetchPaymentDetails(dataId)` (GET /v1/payments/{id}).
4. Enriquece payload con `mp_details`.
5. **Reconocimiento del Payment local** (3 estrategias en orden):
   - `external_reference` del pago MP → `payment.id`.
   - `preference_id` en `PaymentAttempt.response_payload`.
   - MP payment ID en `PaymentAttempt.response_payload`.
6. Mapea estado MP a `PaymentStatus`:
   - `approved` → `approved`
   - `cancelled`, `cancelled_by_user`, `cancelled_by_seller` → `cancelled`
   - `refunded`, `charged_back` → `refunded`
   - `in_process`, `pending` → `pending`
7. Crea `PaymentAttempt` de auditoria.
8. Actualiza `Payment`: `gateway_reference`, `method`, `card_last4`, `status`, `approved_at`/`cancelled_at`.
9. Crea `PaymentStatusHistory`.
10. Si `approved`: crea `Receipt` con `amount_cents` y `receipt_url` desde MP.
11. Marca `MpWebhookEvent` como `processed`.

Las notificaciones inter-app (Buyer/Seller) estan comentadas.

## 8. Reembolsos (`src/app/api/v1/payments/[paymentId]/refund/route.ts`)

### Request

```http
POST /api/v1/payments/{paymentId}/refund
X-Service-Token: <seller-to-payments-secret>
Idempotency-Key: <uuid>

{
  "amount_cents": 15000,
  "reason": "seller_rejected",
  "seller_profile_id": "..."
}
```

### Reglas

- Solo autentica con **service token del Seller** (sin fallback admin).
- Solo permitido si `payment.status === 'approved'`.
- Valida que `amount_cents` sea positivo y no exceda `payment.amount_cents`.
- Crea `Refund` record con `status: 'pending'`.
- Llama a `mpService.createRefund(gatewayReference, amountCents)`.
- Si MP responde `approved`:
  - Actualiza `Refund` a `approved` con `gateway_reference`.
  - Si el total reembolsado alcanza `payment.amount_cents`, marca Payment como `refunded`.
  - Crea `PaymentStatusHistory`.
- Si MP falla: `Refund.status = 'failed'`.

## 9. Liquidacion a sellers (`src/app/api/v1/internal/shipment-delivered/route.ts`)

Endpoint interno llamado por Shipping App cuando se entrega la orden.

1. Autentica con service token de Shipping.
2. Busca el `Payment` por `order_id`.
3. Extrae del `items_summary` el grupo del seller y calcula montos:
   - `gross = subtotal_cents + shipping_cost_cents`
   - `fee = 10%` (via `calculateSettlementAmounts`)
   - `net = gross - fee`
4. Crea `Settlement` con `status: 'pending'` (no se auto-marca como pagado).
5. Notificaciones a Seller estan comentadas.

## 10. Modelo de datos (Prisma)

### Modelos relacionados con MP

| Modelo | Rol |
|---|---|
| `Payment` | Fuente de verdad del estado del pago |
| `PaymentAttempt` | Trazabilidad de cada interaccion con MP (request/response payloads) |
| `PaymentStatusHistory` | Auditoria de cambios de estado |
| `MpWebhookEvent` | Deduplicacion y tracking de webhooks recibidos |
| `Receipt` | Comprobante generado cuando MP confirma pago |
| `Settlement` | Liquidacion por seller (trigger por delivery, no por pago) |
| `Refund` | Reembolsos (con estado y referencia MP) |
| — | Idempotencia manejada via `idempotency_key` directo en cada recurso (Payment, Refund, Receipt, Payout) — ver abajo §12 |

### Maquina de estados (`src/lib/state-machines/payment.ts`)

```
pending ──→ approved ──→ refunded (terminal)
    │
    ├──→ rejected (terminal)
    └──→ cancelled (terminal)
```

## 11. Mapa de archivos

| Archivo | Proposito |
|---|---|
| `src/services/mercado-pago.service.ts` | SDK MP + axios calls (preference, payment details, refund) |
| `src/app/api/v1/payments/route.ts` | POST: crear pago + preferencia. GET: listar pagos |
| `src/app/api/v1/payments/[paymentId]/refund/route.ts` | Reembolso via MP |
| `src/app/api/v1/payments/[paymentId]/cancel/route.ts` | Cancelacion de pago pendiente |
| `src/app/webhooks/mercadopago/route.ts` | Recepcion y validacion de webhooks |
| `src/services/mp-webhook-processor.ts` | Procesamiento del webhook (reconciliacion, actualizacion) |
| `src/lib/webhook-signature.ts` | Validacion HMAC-SHA256 de firma MP |
| `src/components/payments/checkout-form.tsx` | UI de checkout con Wallet brick de MP |
| `src/components/payments/payment-status.tsx` | Display de resultado de pago |
| `src/schemas/payment.ts` | Schemas Zod para validacion |
| `src/lib/state-machines/payment.ts` | Maquina de estados de pagos |
| `src/lib/idempotency.ts` | Helpers de idempotencia por recurso |
| `src/lib/env.ts` | Validacion de variables de entorno |
| `prisma/schema.prisma` | Modelos de datos

## 12. Idempotencia

Las claves de idempotencia (`Idempotency-Key` header) se almacenan como columna directa en cada tabla de recurso (`Payment.idempotency_key`, `Refund.idempotency_key`, `Receipt.idempotency_key`, `Payout.idempotency_key`) en vez de una tabla separada `IdempotencyKey`.

**Decisión de diseño**: En un sistema de pagos, la garantía de idempotencia debe ser **permanente**, no una ventana de 24h. Si un cliente reintenta con la misma key un día después, no debe crearse un segundo cargo, reembolso o transferencia. La restricción `@unique` en la columna del recurso garantiza esto para siempre.

**Trade-off**: El cliente recibe el estado actual del recurso en lugar de la respuesta original exacta. Para mitigarlo en el caso de pagos, `Payment` incluye `checkout_url` y `preference_id` como columnas propias, permitiendo devolver la URL de MP aunque el pago se haya creado en un request anterior.

| Aspecto | Tabla separada (anterior) | Columna en recurso (actual) |
|---|---|---|
| Duración de garantía | 24h (TTL) | Permanente |
| Replay de respuesta | Respuesta original exacta | Estado actual del recurso |
| Migraciones por recurso | Ninguna | Una por recurso |
| Escrituras por request | 2 (payment) | 1 |
| Riesgo de cache obsoleto | Sí | No |
