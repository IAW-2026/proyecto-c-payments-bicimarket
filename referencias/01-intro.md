# 01 — Introducción a la Payments App

## ¿Qué es esta aplicación?

La **Payments App** es un servicio web que maneja todo lo relacionado con **pagos** en el marketplace. Su rol es:

1. **Recibir solicitudes de pago** desde la Buyer App (cuando un usuario compra)
2. **Crear el checkout** en MercadoPago (la plataforma de pagos que usamos)
3. **Recibir confirmaciones** de MercadoPago cuando el pago se aprobó o rechazó
4. **Calcular distribuciones** (cuánto paga cada vendedor después de comisiones)
5. **Transferir dinero** a los vendedores

## ¿Cómo fluye un pago?

```
┌─────────────┐
│ Usuario en  │  Hace clic "Comprar"
│ Buyer App   │
└──────┬──────┘
       │
       │ 1. POST /api/v1/payments
       │ (Buyer App → Payments App)
       ▼
┌─────────────────────┐
│ Payments App        │
│                     │
│ - Crea Payment      │
│ - Llama MercadoPago │
│ - Devuelve checkout │
└──────┬──────────────┘
       │
       │ 2. Devuelve checkout_url
       │ (Payments App → Buyer App)
       ▼
┌─────────────────────┐
│ Usuario redirigido  │ 3. Usuario completa pago
│ a MercadoPago       │    en checkout de MP
└─────────────────────┘
       │
       │ 4. MP confirma pago
       │ (via webhook → Payments App)
       ▼
┌─────────────────────┐
│ Payments App        │
│                     │
│ - Recibe webhook    │
│ - Actualiza estado  │
│ - Crea Settlements  │
│ - Transfiere dinero │
└─────────────────────┘
```

## Conceptos clave

### **Payment** (Pago)
Es el registro del pago completo del usuario.

- **ID**: Identificador único (ej: `pay_clk123`)
- **order_id**: ID del pedido en el Buyer App (ej: `ord_456`)
- **amount_cents**: Cantidad en centavos (ej: 50000 = $500 ARS)
- **status**: `pending` (esperando pago), `approved` (pagado), `rejected`, `cancelled`
- **gateway_reference**: ID del pago en MercadoPago

### **Settlement** (Liquidación)
Es la distribución del dinero POR CADA VENDEDOR.

Un solo Payment puede tener múltiples Settlements (uno por vendedor).

- **seller_profile_id**: A quién va el dinero
- **gross_amount_cents**: Lo que recibe el vendedor SIN descuentos
- **fee_amount_cents**: Comisión del marketplace (ej: 20%)
- **net_amount_cents**: Lo que el vendedor cobra = gross - fee
- **status**: `pending`, `paid`, `failed`

### **Payout** (Transferencia)
Es la transferencia de dinero real a la cuenta del vendedor.

- Vinculado a un Settlement
- **transfer_id**: ID de la transferencia en MercadoPago
- **status**: `pending`, `in_progress`, `completed`, `failed`

### **Refund** (Reembolso)
Cuando se devuelve dinero al comprador.

- **reason**: Por qué se reembolsa (`seller_rejected`, `buyer_cancelled`, `not_delivered`, `manual`)
- **status**: `pending`, `approved`, `failed`

### **MpWebhookEvent** (Webhook de MercadoPago)
Registro de eventos que MercadoPago nos envía.

- **event_type**: Tipo de evento (`payment.created`, `payment.updated`, etc.)
- **status**: `received`, `processed`, `failed`
- **mp_event_id**: ID único en MP (para no procesar duplicados)

## Stack tecnológico

- **Framework**: Next.js (React moderno con routing basado en archivos)
- **BD**: PostgreSQL (via Supabase)
- **ORM**: Prisma (para interactuar con BD fácilmente)
- **HTTP Client**: Axios (para llamadas HTTP)
- **Estado frontend**: TanStack Query (cache inteligente de datos)
- **Autenticación**: Clerk (gestión de usuarios)
- **Payment Gateway**: MercadoPago

## Estructura de carpetas

```
src/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── payments/       # Endpoints REST
│   │           ├── route.ts    # GET/POST /api/v1/payments
│   │           └── [id]/       # GET /api/v1/payments/{id}
│   └── payments/
│       ├── page.tsx            # Página principal (/payments)
│       └── [id]/page.tsx       # Página de detalle
├── components/
│   ├── payments/
│   │   ├── PaymentForm.tsx     # Formulario para crear
│   │   ├── PaymentsTable.tsx   # Tabla listado
│   │   └── PaymentDetail.tsx   # Detalle (si lo creamos)
│   └── ui/                      # Componentes reutilizables
├── services/
│   ├── mercado-pago.service.ts # Llamadas a MP
│   ├── settlement.service.ts   # Cálculos y creación de settlements
│   ├── inter-app-client.service.ts  # Llamadas a otras apps
│   └── refund.service.ts       # Lógica de reembolsos
├── hooks/
│   └── use-payments.ts         # Hooks TanStack Query
├── lib/
│   ├── prisma.ts              # Cliente de BD
│   ├── axios.ts               # Cliente HTTP
│   ├── idempotency.ts         # Helpers para evitar duplicados
│   └── service-token.ts       # Validación de seguridad inter-app
├── types/
│   └── payments.ts            # Tipos TypeScript
└── webhooks/
    └── mercadopago/route.ts   # Endpoint para webhooks de MP
```

## Próximos pasos

1. Lee `02-setup.md` para configurar todo localmente
2. Lee `03-db-schema.md` para entender la BD
3. Lee `04-api-endpoints.md` para aprender los endpoints
4. Lee `08-flujo-completo.md` para ver un ejemplo real

¡Empecemos!
