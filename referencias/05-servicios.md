# 05 — Servicios (Lógica de Negocio)

## ¿Qué son los servicios?

Los servicios contienen la **lógica de negocio** (reglas, cálculos, llamadas a externos).

Mantienen los endpoints limpios y reutilizables.

## Servicio 1: MercadoPago

**Archivo**: `src/services/mercado-pago.service.ts`

Este servicio hace llamadas a MercadoPago (el procesador de pagos).

### `createCheckoutPreference(data)`

Crea un "preferences" en MercadoPago (checkout) y retorna URL de pago.

```typescript
import { createCheckoutPreference } from "@/services/mercado-pago.service";

const pref = await createCheckoutPreference({
  amount: 50000, // Centavos
  external_reference: "ord_buyer_456", // ID del pedido
});

console.log(pref.id); // mp_pref_1234567890
console.log(pref.init_point); // https://www.mercadopago.com/checkout/...
```

**En producción, esto**:

1. Llama `POST https://api.mercadopago.com/checkout/preferences` con tu token
2. MercadoPago retorna un ID único de preferencia
3. Construye URL de checkout: `https://www.mercadopago.com/checkout/v1/redirect?pref_id={id}`
4. Retorna la URL para redirigir al usuario

**Actualmente** (en desarrollo): Es un mock que genera URL de test.

### `getPaymentStatus(paymentId)`

Consulta el estado de un pago en MercadoPago.

```typescript
const status = await getPaymentStatus("mp_pay_123");
// Retorna: { id: 'mp_pay_123', status: 'approved' }
```

### `createTransfer(data)`

Transfiere dinero a la cuenta del vendedor.

```typescript
const transfer = await createTransfer({
  amount: 30000, // Lo que cobra el vendedor
  recipient_id: "seller_789", // ID del vendedor
});

console.log(transfer.transfer_id); // mp_trx_123
```

## Servicio 2: Settlement (Liquidaciones)

**Archivo**: `src/services/settlement.service.ts`

Calcula y crea liquidaciones (distribución de dinero por vendedor).

### `calculateSettlementAmounts(amount, sellerSharePercent)`

Calcula cuánto paga cada vendedor después de comisión.

```typescript
import { calculateSettlementAmounts } from "@/services/settlement.service";

const amounts = calculateSettlementAmounts(50000, 80);
// Si el vendedor recibe 80% (20% es comisión):
console.log(amounts.gross); // 50000 (lo que recibió en bruto)
console.log(amounts.fee); // 10000 (comisión: 20%)
console.log(amounts.net); // 40000 (lo que cobra el vendedor)
```

### `createSettlementsForPayment(paymentId, sellers)`

Crea liquidaciones para todos los vendedores de un pago.

```typescript
import { createSettlementsForPayment } from "@/services/settlement.service";

const settlements = await createSettlementsForPayment("pay_xyz123", [
  { seller_profile_id: "seller_A", sharePercent: 80 },
  { seller_profile_id: "seller_B", sharePercent: 85 },
]);

// Retorna array de Settlements creados
// Cada uno es un registro en la BD lista para transferencia
```

**Uso típico**:

1. Usuario compra a 3 vendedores
2. Pago aprobado en MercadoPago
3. Llamamos `createSettlementsForPayment` con los 3 vendedores
4. Se crean 3 Settlements automáticamente

## Servicio 3: Inter-App Client

**Archivo**: `src/services/inter-app-client.service.ts`

Hace llamadas REST a otras apps (Buyer App, Seller App, Shipping App).

### `notifyBuyerPaymentStatus(buyerBaseUrl, orderId, status)`

Notifica a Buyer App que el pago cambió de estado.

```typescript
import { notifyBuyerPaymentStatus } from "@/services/inter-app-client.service";

await notifyBuyerPaymentStatus(
  "https://buyer-app.com", // URL de Buyer App
  "ord_buyer_456", // ID del pedido
  "approved", // Nuevo estado
);

// Hace: PATCH https://buyer-app.com/api/v1/orders/ord_buyer_456/payment-status
// Body: { status: 'approved' }
```

**En producción**:

- Usa `X-Service-Token` header para autenticación
- Implementa reintentos (si falla, reintenta 3 veces con backoff)
- Registra en `OutboundCallLog` para auditoría

### `createSellerOrders(sellerBaseUrl, payload)`

Notifica a Seller App que crear órdenes de venta.

```typescript
await createSellerOrders(
  'https://seller-app.com',
  {
    payment_id: 'pay_xyz123',
    order_id: 'ord_buyer_456',
    items: [...]
  }
)

// Hace: POST https://seller-app.com/api/v1/sales-orders
```

## Servicio 4: Refund (Reembolsos)

**Archivo**: `src/services/refund.service.ts` (esqueleto)

Maneja devoluciones de dinero.

### Casos de refund

1. **seller_rejected**: Vendedor rechaza compra
2. **buyer_cancelled**: Comprador cancela
3. **not_delivered**: Producto no llegó
4. **manual**: Devolución manual por soporte

### Flujo

```
1. Crear Refund en BD
   ↓
2. Validar que Payment existe y está en estado correcto
   ↓
3. Llamar MercadoPago para reversar pago
   ↓
4. Actualizar status a "approved"
   ↓
5. Notificar a Buyer App
```

## Cómo usar servicios desde un endpoint

### Ejemplo en `src/app/api/v1/payments/route.ts`

```typescript
import { createCheckoutPreference } from '@/services/mercado-pago.service'
import { createSettlementsForPayment } from '@/services/settlement.service'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const body = await req.json()

  // 1. Crear Payment en BD
  const payment = await prisma.payment.create({ data: {...} })

  // 2. Crear checkout en MercadoPago
  const pref = await createCheckoutPreference({
    amount: payment.amount_cents,
    external_reference: payment.order_id
  })

  // 3. Guardar referencia de MP
  await prisma.payment.update({
    where: { id: payment.id },
    data: { gateway_reference: pref.id }
  })

  // 4. Retornar URL de checkout
  return NextResponse.json({
    data: { ...payment, checkout_url: pref.init_point }
  }, { status: 201 })
}
```

## Cómo escribir tus propios servicios

Patrón recomendado:

```typescript
// src/services/my-service.ts

import { prisma } from "@/lib/prisma";
import type { Payment, Settlement } from "@/types/payments";

// Función exportada, pura y testeable
export async function myBusinessLogic(
  paymentId: string,
): Promise<Settlement[]> {
  // 1. Validar inputs
  if (!paymentId) throw new Error("paymentId required");

  // 2. Consultar datos
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) throw new Error("Payment not found");

  // 3. Aplicar lógica
  const settlements = [];
  for (const seller of sellers) {
    settlements.push(await createSettlement(payment, seller));
  }

  // 4. Retornar resultado
  return settlements;
}
```

**Ventajas**:

- Fácil de testear (entrada → proceso → salida)
- Reutilizable en múltiples endpoints
- Lógica separada de HTTP

## Próximos pasos

- Lee `06-client-hooks.md` para aprender cómo usar servicios desde React
- Lee `08-flujo-completo.md` para ver un ejemplo real end-to-end
