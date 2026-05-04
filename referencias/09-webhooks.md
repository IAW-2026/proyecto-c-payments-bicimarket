# 09 — Webhooks (Notificaciones de MercadoPago)

## ¿Qué es un Webhook?

Un **webhook** es una forma de que un servidor (MercadoPago) notifique a otro servidor (nosotros) cuando algo importante sucede.

**Sin webhook** (polling - ineficiente):

```
1. Cada 5 segundos, llamamos a MP: "¿Cambió algo?"
2. MP responde: "No"
3. Esperamos 5 segundos
4. Repetir...
```

**Con webhook** (eficiente):

```
1. Configuramos webhook: "Llama a https://payments.app/webhooks/mercadopago"
2. Usuario paga
3. MP automáticamente: POST /webhooks/mercadopago
4. Procesamos pago inmediatamente
```

## Registrar webhook en MercadoPago

### En dashboard de MP

1. Ve a [developers.mercadopago.com](https://developers.mercadopago.com)
2. Accounts → Webhook settings
3. Crear nuevo:
   - **URL**: `https://payments.bicimarket.com/webhooks/mercadopago`
   - **Events**: Selecciona `payment.created`, `payment.updated`

4. Copiar **Webhook Secret Key** (usamos para validar firma)
5. Guardar en `.env.local`:
   ```
   MP_WEBHOOK_KEY=abc123xyz...
   ```

## Tipos de eventos

| Evento              | Cuándo          | Datos                                        |
| ------------------- | --------------- | -------------------------------------------- |
| `payment.created`   | Se crea un pago | `{ id, amount, status, external_reference }` |
| `payment.updated`   | Cambia estado   | `{ id, status: "approved" \| "rejected" }`   |
| `payment.completed` | Pago procesado  | Similar a `updated`                          |
| `plan.updated`      | Cambios en plan | Plan info                                    |

## Estructura del webhook

### Request que MP envía

```json
{
  "id": "1234567890",
  "type": "payment.updated",
  "date_created": "2026-04-30T10:00:15.000Z",
  "user_id": 123456,
  "live_mode": true,
  "api_version": "v1",
  "data": {
    "id": 999888777
  },
  "action": "payment.updated"
}
```

### Headers que MP envía

```
X-Signature: SHA256=xyz123...
X-Request-Id: req_abc123
X-Timestamp: 1234567890
```

**`X-Signature`**: Firma HMAC-SHA256 que usamos para validar que es realmente de MP.

## Implementar validación de firma (TODO)

En `src/webhooks/mercadopago/route.ts`:

```typescript
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("X-Signature");
  const timestamp = req.headers.get("X-Timestamp");

  // 1. Validar firma
  const secret = process.env.MP_WEBHOOK_KEY;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  if (signature !== expectedSignature) {
    return res(401, { error: "Invalid signature" });
  }

  // 2. Procesar webhook
  const payload = JSON.parse(body);

  // ... resto del código
}
```

## Procesar webhook

### 1. Deduplicación

MercadoPago puede enviar el webhook múltiples veces. Evitar procesar duplicados:

```typescript
// 1. Buscar si ya procesamos este evento
const existing = await prisma.mpWebhookEvent.findUnique({
  where: { mp_event_id: payload.id },
});

if (existing && existing.status === "processed") {
  return res(200, { received: true }); // Ya fue procesado
}

// 2. Crear registro de evento
const event = await prisma.mpWebhookEvent.create({
  data: {
    mp_event_id: payload.id,
    event_type: payload.type,
    payload: payload,
    status: "received",
  },
});
```

### 2. Procesar según tipo de evento

```typescript
if (payload.type === "payment.updated") {
  const mpPaymentId = payload.data.id;

  // Buscar nuestro payment por external_reference
  const payment = await prisma.payment.findFirst({
    where: { gateway_reference: mpPaymentId },
  });

  if (!payment) {
    return res(200, { received: true }); // No es nuestro
  }

  // Consultar estado actual en MP
  const mpPayment = await getPaymentStatus(mpPaymentId);

  // Actualizar según status
  if (mpPayment.status === "approved") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "approved" },
    });
    // TODO: Crear settlements, notificar otras apps, etc.
  }
}

// Marcar evento como procesado
await prisma.mpWebhookEvent.update({
  where: { id: event.id },
  data: { status: "processed" },
});
```

### 3. Responder rápido

Importante: **responder 200 rápidamente**, incluso si aún estamos procesando:

```typescript
// Responder inmediatamente
const response = res(200, { received: true });

// Procesar en background (opcional, sin await)
handlePaymentAsync(payment).catch((err) => {
  console.error("Background error:", err);
  // Registrar en logs
});

return response;
```

## Reintentos automáticos de MP

Si retornamos error (no 200), MP reintentará:

```
Intento 1: Inmediato
Intento 2: 1 minuto después
Intento 3: 5 minutos después
Intento 4: 30 minutos después
Intento 5: 2 horas después
```

Si nunca respondemos 200, MP sigue intentando hasta 24 horas.

## Testear webhook localmente

### Usar ngrok para exponer servidor local

```bash
# Instalar ngrok
npm install -g ngrok

# En otra terminal, exponer puerto 3000
ngrok http 3000
# Output: https://abc123def.ngrok.io
```

### Configurar webhook en MP

Usar URL de ngrok: `https://abc123def.ngrok.io/webhooks/mercadopago`

### Enviar webhook manual

```bash
curl -X POST http://localhost:3000/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "X-Signature: test" \
  -H "X-Timestamp: $(date +%s)" \
  -d '{
    "id": "test_1234",
    "type": "payment.updated",
    "data": {
      "id": 999,
      "external_reference": "ord_buyer_456",
      "status": "approved"
    }
  }'
```

Deberías ver status 200 y el evento guardado en BD.

## Monitorear webhooks

### En Prisma Studio

```bash
npx prisma studio
# Ve a MpWebhookEvent y filtra por status = 'received'
# (significa: aún no procesado)
```

### Logs

```typescript
// Registrar todo
console.log(`[Webhook] ${payload.type} - ${payload.data.id}`);
console.log(`[Webhook] Payment: ${payment.id}`);
console.log(`[Webhook] New status: ${mpPayment.status}`);
```

## Manejo de errores

### Si el webhook falla

```typescript
try {
  await handlePayment(payment);
} catch (err) {
  // Registrar error
  await prisma.mpWebhookEvent.update({
    where: { id: event.id },
    data: {
      status: "failed",
      last_error: err.message,
    },
  });

  // Aún retornar 500 para que MP reintente
  return res(500, { error: "Processing failed" });
}
```

### Casos especiales

**Payment no encontrado**:

```typescript
if (!payment) {
  // Retornar 200 igual (no es error nuestro)
  return res(200, { received: true });
}
```

**Evento duplicado**:

```typescript
if (existing && existing.status === "processed") {
  return res(200, { received: true }); // Silenciosamente ignorar
}
```

## Testing automático

```typescript
// tests/webhooks.test.ts
import { POST } from "@/webhooks/mercadopago/route";

test("webhook payment.updated - approved", async () => {
  const req = new Request("http://localhost/webhooks/mercadopago", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "evt_test_1",
      type: "payment.updated",
      data: { id: 999, status: "approved", external_reference: "ord_123" },
    }),
  });

  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.received).toBe(true);

  // Verificar que se actualizó payment
  const payment = await prisma.payment.findUnique({ where: { id: "..." } });
  expect(payment.status).toBe("approved");
});
```

## Próximos pasos

- Lee `10-idempotencia-seguridad.md` para entender cómo evitar duplicados
- Lee `11-troubleshooting.md` para resolver problemas
