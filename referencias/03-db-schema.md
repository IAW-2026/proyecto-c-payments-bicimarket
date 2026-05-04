# 03 — Entendiendo la Base de Datos

## ¿Qué es Prisma?

Prisma es un **ORM** (Object-Relational Mapping). Simplificando: es una herramienta que:

1. **Define la estructura de la BD** en un archivo llamado `schema.prisma`
2. **Genera código automático** para interactuar con la BD sin escribir SQL
3. **Crea migraciones** (cambios en la BD) automáticamente

## El archivo `schema.prisma`

Abre `prisma/schema.prisma`. Contiene **modelos** como este:

```prisma
model Payment {
  id                 String   @id @default(cuid())      // ID único
  order_id           String                               // ID del pedido
  buyer_profile_id   String                               // ID del comprador
  amount_cents       Int                                  // Monto en centavos
  currency           String   @default("ARS")            // Moneda (ARS, USD, etc)
  status             String   @default("pending")        // Estado: pending, approved, rejected
  gateway_reference  String?                              // ID en MercadoPago (? = opcional)
  created_at         DateTime @default(now())            // Fecha creación (auto)
  updated_at         DateTime @updatedAt                 // Fecha actualización (auto)

  payment_attempts   PaymentAttempt[]                    // Relación: muchos intentos
  receipts           Receipt[]                           // Relación: muchos recibos
  settlements        Settlement[]                        // Relación: muchas liquidaciones
  refunds            Refund[]                            // Relación: muchos reembolsos
}
```

### Explicación de atributos

| Atributo           | Qué significa                                                |
| ------------------ | ------------------------------------------------------------ |
| `@id`              | Este es el identificador único                               |
| `@default(cuid())` | Genera automáticamente un ID único                           |
| `@default(now())`  | Usa la fecha/hora actual                                     |
| `@updatedAt`       | Se actualiza automáticamente cada vez que el registro cambia |
| `?`                | Campo opcional (puede ser null)                              |
| `String`           | Texto                                                        |
| `Int`              | Número entero                                                |
| `DateTime`         | Fecha y hora                                                 |
| `Boolean`          | Verdadero/Falso                                              |
| `Json`             | Objeto JSON                                                  |

## Todas las tablas de Payments App

### 1. **Payment** (Pagos principales)

Representa UN pago completo del usuario.

```
┌─────────────────────────────────────┐
│ Payment                             │
├─────────────────────────────────────┤
│ id: pay_xyz123                      │
│ order_id: ord_abc456                │
│ buyer_profile_id: usr_789           │
│ amount_cents: 50000 ($500)          │
│ currency: ARS                       │
│ status: approved                    │
│ gateway_reference: mp_pay_123       │
│ created_at: 2026-04-30 10:00:00    │
└─────────────────────────────────────┘
```

**Campos clave**:

- `status`: Ciclo de vida del pago
  - `pending` → espera confirmación de MP
  - `approved` → pago confirmado
  - `rejected` → MP rechazó el pago
  - `cancelled` → usuario canceló

### 2. **Settlement** (Liquidaciones por vendedor)

UN Payment puede tener múltiples Settlements.

**Ejemplo**: Usuario compra a 3 vendedores diferentes → 1 Payment + 3 Settlements

```
Payment (ord_abc456, $500)
│
├─ Settlement (seller_A, $160 bruto, $120 neto)
├─ Settlement (seller_B, $200 bruto, $160 neto)
└─ Settlement (seller_C, $140 bruto, $112 neto)
```

**Cálculo de montos**:

- **gross** = lo que recibe el vendedor (antes de comisión)
- **fee** = comisión del marketplace (20% por defecto)
- **net** = lo que el vendedor cobra = gross - fee

### 3. **Payout** (Transferencias a vendedores)

Son las transferencias REALES de dinero. Vinculadas a un Settlement.

```
Settlement → Payout (transferencia en MercadoPago)
            ↓
        transfer_id: "mp_trx_789"
        status: "completed"
        completed_at: 2026-04-30 14:00:00
```

### 4. **PaymentAttempt** (Intentos de pago)

Registro de cada intento de crear el pago en MercadoPago.

Útil para debugging (si falló el primer intento, hay reintentos).

### 5. **Receipt** (Recibos)

Comprobante PDF del pago. Generado después de que se aprobó.

```
Receipt
├─ id: rec_456
├─ payment_id: pay_xyz123
├─ receipt_url: "https://cdn.example.com/receipt_123.pdf"
└─ issued_at: 2026-04-30 10:05:00
```

### 6. **Refund** (Reembolsos)

Solicitud de devolución de dinero.

```
Refund
├─ id: ref_111
├─ payment_id: pay_xyz123
├─ amount_cents: 25000 (mitad del pago)
├─ reason: "not_delivered" (no llegó)
└─ status: "pending" → "approved" → "completed"
```

### 7. **MpWebhookEvent** (Webhooks de MercadoPago)

Registro de eventos que MercadoPago nos envía.

MercadoPago nos notifica cuando:

- Se crea un pago (`payment.created`)
- Se aprueba un pago (`payment.updated` con status=approved)
- Se rechaza un pago (`payment.updated` con status=rejected)

```
MpWebhookEvent
├─ id: whe_999
├─ mp_event_id: "123456789" (ID único en MP)
├─ event_type: "payment.created"
├─ payload: { "id": 123, "amount": 500, ... }
├─ status: "received" → "processed"
└─ created_at: 2026-04-30 10:00:01
```

### 8. **OutboundCallLog** (Registro de llamadas salientes)

Auditoría de llamadas que HACEMOS a otras apps (Buyer, Seller, Shipping).

```
OutboundCallLog
├─ id: oc_555
├─ target_app: "buyer"
├─ method: "PATCH"
├─ path: "/api/v1/orders/ord_abc456/payment-status"
├─ request_body: { "status": "approved" }
├─ response_status: 200
└─ succeeded_at: 2026-04-30 10:00:05
```

## Relaciones entre tablas

```
                    ┌──────────────────┐
                    │ Payment          │
                    │ (pago principal) │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
       ┌─────────┐    ┌───────────┐    ┌──────────┐
       │ Receipt │    │Settlement │    │ Refund   │
       │(recibos)│    │(liquidac.)│    │(reemb.)  │
       └─────────┘    └─────┬─────┘    └──────────┘
                            │
                            ▼
                       ┌──────────┐
                       │ Payout   │
                       │(transfer)│
                       └──────────┘
```

## Cómo interactuar con la BD desde código

### Crear un pago

```typescript
import { prisma } from "@/lib/prisma";

const payment = await prisma.payment.create({
  data: {
    order_id: "ord_123",
    buyer_profile_id: "user_456",
    amount_cents: 50000,
    currency: "ARS",
    status: "pending",
  },
});

console.log(payment.id); // pay_xyz...
```

### Buscar un pago

```typescript
const payment = await prisma.payment.findUnique({
  where: { id: "pay_xyz..." },
});

console.log(payment.status); // "approved"
```

### Actualizar estado

```typescript
await prisma.payment.update({
  where: { id: "pay_xyz..." },
  data: { status: "approved" },
});
```

### Listar pagos (con filtros)

```typescript
const payments = await prisma.payment.findMany({
  where: { status: "approved" },
  take: 10, // Primeros 10
  skip: 0, // Desde el 0
});
```

### Crear settlement (vinculado a pago)

```typescript
const settlement = await prisma.settlement.create({
  data: {
    payment_id: payment.id,
    order_id: payment.order_id,
    seller_profile_id: "seller_789",
    gross_amount_cents: 40000, // $400
    fee_amount_cents: 10000, // $100 (25%)
    net_amount_cents: 30000, // $300 (lo que cobra)
    status: "pending",
  },
});
```

## Tipos TypeScript

Todos los tipos están en `src/types/payments.ts`. Úsalos así:

```typescript
import { Payment, Settlement } from "@/types/payments";

const handlePayment = (payment: Payment) => {
  console.log(payment.amount_cents);
};
```

## Ver datos en la BD

Abre Prisma Studio:

```bash
npx prisma studio
```

Luego ve a `http://localhost:5555`. Ahí ves todas las tablas, filas, y puedes editar datos.

## Próximos pasos

- Lee `04-api-endpoints.md` para aprender cómo hacer llamadas a la API
- Lee `05-servicios.md` para entender la lógica de negocios
