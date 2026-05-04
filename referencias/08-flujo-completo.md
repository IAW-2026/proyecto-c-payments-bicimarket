# 08 — Flujo Completo: Un Pago Paso a Paso

## Escenario

Un usuario compra productos de 2 vendedores por $500 ARS.

- Vendedor A: $300
- Vendedor B: $200
- Comisión del marketplace: 20% ($100)
- Vendedor A cobra: $240 ($300 - 20%)
- Vendedor B cobra: $160 ($200 - 20%)

## Paso 1: Usuario hace clic "Comprar"

### En Buyer App

Usuario está en `buyer.bicimarket.com/order/checkout` y hace clic en "Pagar".

```typescript
// En Buyer App, env vars:
// PAYMENTS_APP_URL=https://payments.bicimarket.com
// SERVICE_TOKEN_SECRET=secreto-compartido

const response = await fetch(
  "https://payments.bicimarket.com/api/v1/payments",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": "secreto-compartido", // Enviamos token
      "Idempotency-Key": "opt_unique_123", // Evitar duplicados
    },
    body: JSON.stringify({
      order_id: "ord_buyer_456",
      buyer_profile_id: "buyer_789",
      amount_cents: 50000, // $500
      currency: "ARS",
    }),
  },
);

const { data } = await response.json();
// {
//   id: 'pay_xyz123',
//   checkout_url: 'https://www.mercadopago.com/checkout/v1/...',
//   ...
// }

// Redirigir al usuario a MercadoPago
window.location.href = data.checkout_url;
```

## Paso 2: Server Payments App procesa la solicitud

### En `POST /api/v1/payments`

```typescript
// 1. Validar X-Service-Token
const svcToken = req.headers.get("X-Service-Token");
if (!validateServiceToken(svcToken)) {
  return res(401, { error: "UNAUTHORIZED" });
}

// 2. Validar idempotencia
const idempotencyKey = req.headers.get("Idempotency-Key");
const existing = await findByIdempotencyKey(idempotencyKey);
if (existing) {
  return res(200, { data: existing }); // Retornar duplicado
}

// 3. Crear Payment en BD
const payment = await prisma.payment.create({
  data: {
    order_id: "ord_buyer_456",
    buyer_profile_id: "buyer_789",
    amount_cents: 50000,
    status: "pending",
    idempotency_key: idempotencyKey,
  },
});
// → BD: INSERT INTO payments VALUES (id: 'pay_xyz123', ...)

// 4. Crear preferencia en MercadoPago
const pref = await createCheckoutPreference({
  amount: 50000,
  external_reference: "ord_buyer_456",
});
// → MP: POST /v1/checkout/preferences
// ← MP: { id: 'mp_pref_789', init_point: 'https://mp.com/checkout/...' }

// 5. Guardar referencia en BD
await prisma.payment.update({
  where: { id: "pay_xyz123" },
  data: { gateway_reference: "mp_pref_789" },
});
// → BD: UPDATE payments SET gateway_reference = 'mp_pref_789'

// 6. Retornar respuesta
return res(201, {
  data: {
    id: "pay_xyz123",
    checkout_url: "https://mp.com/checkout/...",
    status: "pending",
  },
});
```

**BD después de Paso 2**:

```
PAYMENTS:
├─ id: pay_xyz123
├─ order_id: ord_buyer_456
├─ amount_cents: 50000
├─ status: pending
├─ gateway_reference: mp_pref_789
└─ created_at: 2026-04-30 10:00:00
```

## Paso 3: Usuario paga en MercadoPago

Usuario es redirigido a MercadoPago y completa el pago con su tarjeta.

```
Usuario → Navega a checkout MP
       → Ingresa datos de tarjeta
       → MercadoPago procesa
       → Pago aprobado
```

## Paso 4: MercadoPago nos envía webhook

### Webhook POST `/webhooks/mercadopago`

MercadoPago nos notifica (automáticamente):

```json
{
  "id": "1234567890",
  "type": "payment.updated",
  "data": {
    "id": 999888777, // ID de pago en MP
    "external_reference": "ord_buyer_456", // Nuestro order_id
    "status": "approved",
    "amount": 500
  }
}
```

### En Payments App

```typescript
// src/webhooks/mercadopago/route.ts

export async function POST(req: Request) {
  const payload = await req.json();

  // 1. Validar que es de MP (verificar firma)
  // TODO: Implementar validación de firma con MP_WEBHOOK_KEY

  // 2. Guardar evento (deduplicar por mp_event_id)
  const webhook = await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: payload.id,
      event_type: payload.type,
      payload: payload,
      status: "received",
    },
  });

  // 3. Si es pago aprobado, procesar
  if (
    payload.type === "payment.updated" &&
    payload.data.status === "approved"
  ) {
    // Buscar nuestro Payment por external_reference
    const payment = await prisma.payment.findFirst({
      where: { order_id: payload.data.external_reference },
    });

    if (payment) {
      // Actualizar status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "approved",
          approved_at: new Date(),
        },
      });

      // AQUÍ iría la lógica para:
      // 1. Crear Settlements para cada vendedor
      // 2. Notificar a Buyer App
      // 3. Notificar a Seller App
      // 4. Crear Receipts
      // Pero por ahora es esqueleto
    }
  }

  // 4. Retornar 200 rápidamente
  return res(200, { received: true });
}
```

**BD después de Paso 4**:

```
PAYMENTS:
├─ id: pay_xyz123
├─ status: approved ← CAMBIÓ
├─ approved_at: 2026-04-30 10:00:15
└─ ...

MP_WEBHOOK_EVENTS:
├─ id: whe_123
├─ mp_event_id: 1234567890
├─ event_type: payment.updated
└─ status: received
```

## Paso 5: Crear Settlements (en producción)

Después de que el pago se aprobó, se crearían Settlements:

```typescript
// En el handler de webhook (Paso 4)
if (payment.status === "approved") {
  // Obtener información de orden de Buyer App
  const order = await notifyBuyerPaymentStatus(
    "https://buyer.bicimarket.com",
    "ord_buyer_456",
    "approved",
  );

  // order.sellers = [{ id: 'seller_A', ... }, { id: 'seller_B', ... }]

  // Crear settlement para cada vendedor
  await createSettlementsForPayment("pay_xyz123", [
    { seller_profile_id: "seller_A", sharePercent: 80 }, // Recibe 80%
    { seller_profile_id: "seller_B", sharePercent: 80 },
  ]);
}
```

**BD después**:

```
SETTLEMENTS:
├─ id: set_111
├─ payment_id: pay_xyz123
├─ seller_profile_id: seller_A
├─ gross_amount_cents: 30000
├─ fee_amount_cents: 6000
├─ net_amount_cents: 24000  ← Lo que cobra
├─ status: pending
└─ created_at: 2026-04-30 10:00:20

├─ id: set_222
├─ payment_id: pay_xyz123
├─ seller_profile_id: seller_B
├─ gross_amount_cents: 20000
├─ fee_amount_cents: 4000
├─ net_amount_cents: 16000  ← Lo que cobra
└─ status: pending
```

## Paso 6: Crear Payouts (Transferencias)

Cuando Shipping App reporta "delivered", crear transfers:

```typescript
// En handler de webhook de Shipping App
if (shipment.status === "delivered") {
  // Buscar Settlement relacionado
  const settlement = await prisma.settlement.findUnique({
    where: { payment_id: payment.id, seller_profile_id: seller.id },
  });

  // Crear Payout (transferencia)
  const payout = await prisma.payout.create({
    data: {
      settlement_id: settlement.id,
      status: "pending",
    },
  });

  // Llamar MercadoPago para transferir dinero
  const transfer = await createTransfer({
    amount: settlement.net_amount_cents,
    recipient_id: seller.mp_account_id,
  });

  // Actualizar Payout
  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      transfer_id: transfer.transfer_id,
      status: "completed",
      completed_at: new Date(),
    },
  });
}
```

## Resumen visual

```
┌─────────────────────────────────────────────────────────┐
│ Paso 1: Usuario hace clic "Comprar"                    │
│ → Buyer App llama POST /api/v1/payments                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Paso 2: Crear Payment + preferencia en MP              │
│ → Payment status = 'pending'                           │
│ → BD: INSERT Payment                                   │
│ → MP: POST /checkout/preferences                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Paso 3: Usuario paga en MercadoPago                    │
│ → Usuario completa pago con tarjeta                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Paso 4: Webhook de MP nos notifica                     │
│ → Payment status = 'approved'                          │
│ → BD: UPDATE Payment                                   │
│ → BD: INSERT MpWebhookEvent                            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Paso 5: Crear Settlements (liquidaciones)              │
│ → BD: INSERT Settlement (vendedor A)                   │
│ → BD: INSERT Settlement (vendedor B)                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Paso 6: Transferir dinero a vendedores                 │
│ → Cuando producto sea entregado                        │
│ → BD: INSERT Payout                                    │
│ → MP: POST /transfers (transferencia real)             │
└─────────────────────────────────────────────────────────┘
```

## Códigos de status HTTP

- **201**: Payment creado exitosamente
- **200**: OK, request exitosa (GET, PUT, PATCH)
- **400**: Error en datos enviados (validation error)
- **401**: Sin autenticación (falta X-Service-Token)
- **404**: No encontrado
- **500**: Error interno del servidor

## Próximos pasos

- Lee `09-webhooks.md` para entender webhooks en detalle
- Lee `10-idempotencia-seguridad.md` para entender cómo evitar duplicados
