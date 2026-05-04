# 04 — API Endpoints (Rutas)

## ¿Qué es un endpoint?

Un **endpoint** es una URL + método HTTP que realiza una acción. Por ejemplo:

- `POST /api/v1/payments` → crear un pago
- `GET /api/v1/payments` → listar pagos
- `GET /api/v1/payments/123` → obtener detalle del pago 123

## Estructura de URLs

Nuestros endpoints siguen este patrón:

```
/api/v1/{recurso}/{id?}/{acción?}
 ↑  ↑   ↑       ↑       ↑
 |  |   |       |       └─ Acción opcional (refund, status, etc)
 |  |   |       └─ ID opcional
 |  |   └─ Recurso (payments, settlements, etc)
 |  └─ Versión de API
 └─ Significa que es una ruta del servidor
```

**Ventajas de versionar (`v1`)**:

- Puedes cambiar la API sin romper clientes antiguos
- Clientes usan `/api/v1/` y cuando hay cambios crear `/api/v2/`

## Endpoint 1: Crear un pago

**Ruta**: `POST /api/v1/payments`

**Descripción**: Buyer App llama esto para crear un pago. Retorna un checkout URL.

### Request

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-Service-Token: mi-secreto-super-seguro-123" \
  -H "Idempotency-Key: opt_unique_key_123" \
  -d '{
    "order_id": "ord_buyer_456",
    "buyer_profile_id": "buyer_789",
    "amount_cents": 50000,
    "currency": "ARS"
  }'
```

### Request (explicación campo por campo)

| Campo              | Tipo   | Descripción                             |
| ------------------ | ------ | --------------------------------------- |
| `order_id`         | string | ID del pedido en Buyer App              |
| `buyer_profile_id` | string | ID del perfil del comprador             |
| `amount_cents`     | int    | Monto en centavos (50000 = $500)        |
| `currency`         | string | Moneda (`ARS`, `USD`, etc)              |
| `idempotency_key`  | string | Clave para evitar duplicados (opcional) |

### Headers importantes

| Header            | Descripción                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `X-Service-Token` | Token secreto para autenticación inter-app. Debe coincidir con `SERVICE_TOKEN_SECRET`              |
| `Idempotency-Key` | Clave única. Si llamamos 2 veces con la misma key, retorna el mismo resultado (no crea duplicados) |
| `Content-Type`    | Debe ser `application/json`                                                                        |

### Response (éxito - 201)

```json
{
  "data": {
    "id": "pay_clk7p3q1b0000qz088z8z8z8z",
    "order_id": "ord_buyer_456",
    "buyer_profile_id": "buyer_789",
    "amount_cents": 50000,
    "currency": "ARS",
    "status": "pending",
    "gateway_reference": "mp_pref_1234567890",
    "checkout_url": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=mp_pref_1234567890",
    "created_at": "2026-04-30T10:00:00Z",
    "updated_at": "2026-04-30T10:00:00Z"
  }
}
```

### Response (error - 401 sin token)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid service token"
  }
}
```

### Response (error - 400 payload incorrecto)

```json
{
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "order_id and amount_cents required"
  }
}
```

## Endpoint 2: Listar pagos

**Ruta**: `GET /api/v1/payments`

**Descripción**: Obtiene lista de pagos (útil para admins, ver historial).

### Request

```bash
curl -X GET http://localhost:3000/api/v1/payments
```

### Response

```json
{
  "data": [
    {
      "id": "pay_xyz123",
      "order_id": "ord_456",
      "amount_cents": 50000,
      "status": "approved",
      "created_at": "2026-04-30T10:00:00Z"
    },
    {
      "id": "pay_abc789",
      "order_id": "ord_789",
      "amount_cents": 25000,
      "status": "pending",
      "created_at": "2026-04-30T11:00:00Z"
    }
  ]
}
```

## Endpoint 3: Obtener detalle de un pago

**Ruta**: `GET /api/v1/payments/{id}`

**Descripción**: Obtiene todos los detalles de UN pago.

### Request

```bash
curl -X GET http://localhost:3000/api/v1/payments/pay_xyz123
```

### Response

```json
{
  "data": {
    "id": "pay_xyz123",
    "order_id": "ord_456",
    "buyer_profile_id": "buyer_789",
    "amount_cents": 50000,
    "currency": "ARS",
    "status": "approved",
    "gateway_reference": "mp_pay_5678",
    "approved_at": "2026-04-30T10:05:00Z",
    "created_at": "2026-04-30T10:00:00Z",
    "updated_at": "2026-04-30T10:05:00Z"
  }
}
```

### Response (error - 404 no encontrado)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Payment not found"
  }
}
```

## Endpoint 4: Webhook de MercadoPago

**Ruta**: `POST /webhooks/mercadopago`

**Descripción**: MercadoPago nos llama aquí cuando algo sucede con un pago.

**NO LLAMES ESTO TÚ** — es MercadoPago quien lo llama automáticamente.

### Cuándo MercadoPago nos llama

Eventos típicos:

- `payment.created` — Se creó un pago
- `payment.updated` — Cambió el estado (ej: pending → approved)
- `payment.completed` — Pago completado

### Request (ejemplo de lo que MP envía)

```json
{
  "id": "1234567890",
  "type": "payment.created",
  "data": {
    "id": "123456",
    "external_reference": "ord_buyer_456",
    "status": "approved"
  }
}
```

### Response

```json
{
  "received": true
}
```

## Endpoint 5: Listar Settlements (liquidaciones)

**Ruta**: `GET /api/v1/settlements?sellerId={sellerId}`

**Descripción**: Obtiene liquidaciones pendientes/completadas para un vendedor.

### Request

```bash
curl -X GET "http://localhost:3000/api/v1/settlements?sellerId=seller_789"
```

### Response

```json
{
  "data": [
    {
      "id": "set_111",
      "payment_id": "pay_xyz123",
      "seller_profile_id": "seller_789",
      "gross_amount_cents": 40000,
      "fee_amount_cents": 10000,
      "net_amount_cents": 30000,
      "status": "pending",
      "created_at": "2026-04-30T10:00:00Z"
    }
  ]
}
```

## Cómo usar estos endpoints desde JavaScript (cliente)

### Con fetch (vanilla JavaScript)

```javascript
// 1. Crear pago
const response = await fetch("/api/v1/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Service-Token": "mi-secreto-super-seguro-123",
    "Idempotency-Key": `opt_${Date.now()}`,
  },
  body: JSON.stringify({
    order_id: "ord_buyer_456",
    buyer_profile_id: "buyer_789",
    amount_cents: 50000,
  }),
});

const { data } = await response.json();
console.log(data.checkout_url); // Redirigir aquí al usuario
```

### Con Axios (recomendado en este proyecto)

```typescript
import axios from "@/lib/axios";

const response = await axios.post("/api/v1/payments", {
  order_id: "ord_buyer_456",
  buyer_profile_id: "buyer_789",
  amount_cents: 50000,
});

console.log(response.data); // { data: { ... } }
```

### Con TanStack Query (recomendado para React)

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";

// Para lectura (GET)
const { data, isLoading } = useQuery({
  queryKey: ["payments"],
  queryFn: () => axios.get("/api/v1/payments"),
});

// Para escritura (POST)
const mutation = useMutation({
  mutationFn: (payload) => axios.post("/api/v1/payments", payload),
  onSuccess: () => {
    // Refrescar la lista después de crear
    queryClient.invalidateQueries(["payments"]);
  },
});

mutation.mutate({ order_id: "ord_123", amount_cents: 5000 });
```

## Códigos de status HTTP

| Código | Significado                                  |
| ------ | -------------------------------------------- |
| `200`  | OK — la operación fue exitosa                |
| `201`  | Created — algo nuevo fue creado              |
| `400`  | Bad Request — enviaste datos incorrectos     |
| `401`  | Unauthorized — falta token o es inválido     |
| `404`  | Not Found — no existe                        |
| `500`  | Internal Server Error — error en el servidor |

## Próximos pasos

- Lee `05-servicios.md` para entender la lógica tras estos endpoints
- Lee `06-client-hooks.md` para aprender a usar desde React
