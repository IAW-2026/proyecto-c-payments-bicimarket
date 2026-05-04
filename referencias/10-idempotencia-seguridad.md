# 10 — Idempotencia y Seguridad Inter-App

## ¿Qué es idempotencia?

**Idempotencia** significa que hacer la misma operación múltiples veces tiene el MISMO resultado que hacerla una vez.

**Problema sin idempotencia**:

```
Buyer App hace: POST /api/v1/payments
               ↓
Payments App crea Payment
               ↓
Buyer App no recibe respuesta (error de red)
               ↓
Buyer App reintenta: POST /api/v1/payments (MISMO payload)
               ↓
Payments App crea OTRO Payment (❌ duplicado)
```

**Con idempotencia**:

```
Buyer App hace: POST /api/v1/payments + Idempotency-Key: opt_123
               ↓
Payments App crea Payment (guarda en BD el opt_123)
               ↓
Buyer App no recibe respuesta (error de red)
               ↓
Buyer App reintenta: POST /api/v1/payments + Idempotency-Key: opt_123
               ↓
Payments App busca opt_123 → ya existe
               ↓
Retorna MISMO Payment (✅ no duplica)
```

## Implementar idempotencia

### 1. Agregar `idempotency_key` a Payment

Ya está en el schema:

```prisma
model Payment {
  id              String    @id @default(cuid())
  idempotency_key String?   @unique  // Clave única
  // ...
}
```

### 2. Enviar header desde cliente

```typescript
// Buyer App
const response = await fetch("https://payments.app/api/v1/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": `opt_${Date.now()}_${Math.random()}`, // Generar único
  },
  body: JSON.stringify({
    order_id: "ord_456",
    amount_cents: 50000,
  }),
});
```

### 3. Verificar en servidor

```typescript
// src/lib/idempotency.ts

export async function findByIdempotencyKey(key?: string) {
  if (!key) return null;
  return prisma.payment.findFirst({
    where: { idempotency_key: key },
  });
}

// En endpoint POST /api/v1/payments

const idempotencyKey = req.headers.get("Idempotency-Key");

// Buscar si ya existe
const existing = await findByIdempotencyKey(idempotencyKey);
if (existing) {
  return res(200, { data: existing }); // Retornar el mismo
}

// Crear nuevo
const payment = await prisma.payment.create({
  data: {
    order_id: body.order_id,
    idempotency_key: idempotencyKey,
    // ...
  },
});

return res(201, { data: payment });
```

## Seguridad Inter-App: X-Service-Token

### ¿Por qué necesitamos X-Service-Token?

Sin él, cualquiera podría hacer:

```bash
# Cualquier persona en internet:
curl -X POST https://payments.app/api/v1/payments \
  -d '{ "order_id": "ord_123", "amount_cents": 1000000 }'
# ❌ Crear pagos fraudulentos
```

### Solución: Token secreto compartido

1. **Buyer App** y **Payments App** comparten un secreto: `SERVICE_TOKEN_SECRET=secreto123`
2. Buyer App envía el secreto en header
3. Payments App valida que sea correcto

### Implementar validación

```typescript
// src/lib/service-token.ts

export function validateServiceToken(token?: string): boolean {
  const secret = process.env.SERVICE_TOKEN_SECRET;
  if (!secret) return false;
  if (!token) return false;
  return token === secret; // Comparación simple (en prod: HMAC-SHA256)
}

// En endpoint

const token = req.headers.get("X-Service-Token");
if (!validateServiceToken(token)) {
  return res(401, { error: { code: "UNAUTHORIZED" } });
}
```

### Enviar desde cliente

```typescript
// Buyer App
const response = await fetch('https://payments.app/api/v1/payments', {
  method: 'POST',
  headers: {
    'X-Service-Token': process.env.SERVICE_TOKEN_SECRET,  // Token secreto
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
})
```

## Mejora: HMAC-SHA256 (más seguro)

En producción, usar HMAC en lugar de comparación simple:

```typescript
import crypto from "crypto";

export function generateServiceTokenHMAC(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function validateServiceTokenHMAC(
  payload: string,
  token: string,
  secret: string,
) {
  const expected = generateServiceTokenHMAC(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// Uso
const payload = JSON.stringify(body);
const token = req.headers.get("X-Service-Token");
const isValid = validateServiceTokenHMAC(
  payload,
  token,
  process.env.SERVICE_TOKEN_SECRET!,
);
```

## Headers de seguridad recomendados

```typescript
// En todas las llamadas inter-app

headers: {
  'X-Service-Token': token,           // Autenticación
  'X-Request-Id': `req_${Date.now()}`, // Rastreo de requests
  'User-Agent': 'PaymentsApp/1.0',    // Identificar qué app llama
  'Content-Type': 'application/json'
}
```

## Auditoría: Registrar llamadas salientes

Guardar todas las llamadas que hacemos a otras apps:

```typescript
// src/services/inter-app-client.service.ts

export async function notifyBuyerPaymentStatus(
  buyerUrl: string,
  orderId: string,
  status: string,
) {
  const payload = { status };

  try {
    const res = await axios.patch(
      `${buyerUrl}/api/v1/orders/${orderId}/payment-status`,
      payload,
      { headers: { "X-Service-Token": process.env.SERVICE_TOKEN_SECRET } },
    );

    // Registrar éxito
    await prisma.outboundCallLog.create({
      data: {
        target_app: "buyer",
        method: "PATCH",
        path: `/api/v1/orders/${orderId}/payment-status`,
        request_body: payload,
        response_status: res.status,
        response_body: res.data,
        succeeded_at: new Date(),
      },
    });

    return res.data;
  } catch (err: any) {
    // Registrar error
    await prisma.outboundCallLog.create({
      data: {
        target_app: "buyer",
        method: "PATCH",
        path: `/api/v1/orders/${orderId}/payment-status`,
        request_body: payload,
        response_status: err.response?.status,
        response_body: err.response?.data,
        last_error: err.message,
      },
    });

    throw err;
  }
}
```

**Beneficios**:

- Ver qué apps se comunican
- Debuggear problemas inter-app
- Auditoría de seguridad

## Reintentos con backoff

Si Buyer App no responde, reintentar:

```typescript
async function notifyWithRetry(url: string, payload: any, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await axios.post(url, payload);
      return res.data;
    } catch (err) {
      lastError = err;

      // Esperar antes de reintentar (backoff exponencial)
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Uso
await notifyWithRetry(
  "https://buyer.app/api/v1/orders/ord_123/payment-status",
  { status: "approved" },
);
```

## Validar autorización en cada endpoint

```typescript
// Middleware para proteger endpoints
export async function validateServiceToken(req: Request) {
  const token = req.headers.get("X-Service-Token");

  if (!validateServiceToken(token)) {
    throw new Error("UNAUTHORIZED");
  }
}

// En cada endpoint POST/PATCH/DELETE
export async function POST(req: Request) {
  await validateServiceToken(req); // Validar primero
  // ... resto del código
}
```

## Checklist de seguridad

- [ ] ¿Validamos `X-Service-Token` en todos los endpoints protegidos?
- [ ] ¿Usamos `Idempotency-Key` para evitar duplicados?
- [ ] ¿Registramos todas las llamadas salientes en `OutboundCallLog`?
- [ ] ¿Implementamos reintentos con backoff?
- [ ] ¿Verificamos signatures de webhooks de MP?
- [ ] ¿Las variables secretas están en `.env.local` (no en git)?
- [ ] ¿Usamos HTTPS en producción?

## Próximos pasos

- Lee `11-troubleshooting.md` para resolver problemas comunes
- Lee `12-ejemplo-paso-a-paso.md` para un tutorial práctico
