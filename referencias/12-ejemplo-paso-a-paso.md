# 12 — Tutorial Paso a Paso: Tu Primer Pago

## Objetivo

Crear un pago de $500 ARS desde cero y verlo aprobado.

## Paso 1: Configurar .env.local

Abre `.env.local` en la raíz del proyecto y asegúrate de tener:

```env
# Base de datos (usa Supabase o local PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/payments_db"
DIRECT_URL="postgresql://user:password@localhost:5432/payments_db"

# Inter-app security
SERVICE_TOKEN_SECRET="secreto-compartido-123"

# App URL (para webhooks)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# MercadoPago (opcional en desarrollo)
MP_ACCESS_TOKEN="TEST-..."
MP_WEBHOOK_KEY="..."

# Clerk (opcional)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
```

Si no tienes algunos valores, puedes usar los defaults con "test-" prefijo.

## Paso 2: Instalar y migrar

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name add_payments_core
```

Deberías ver:

```
✔ Your database is now in sync with your schema.
```

## Paso 3: Iniciar el servidor

En una terminal:

```bash
npm run dev
```

Deberías ver:

```
> next dev
  ▲ Next.js ready on http://localhost:3000
```

**No cierres esta terminal, la dejarás corriendo**.

## Paso 4: Verificar que todo funciona

Abre otra terminal y ejecuta los smoke tests:

```bash
npm run smoke
```

Deberías ver:

```
Smoke tests: hitting /api/health
200 http://localhost:3000/api/health
...
```

✅ Si ves `200`, ¡todo está bien!

## Paso 5: Crear un pago via API (cURL)

Abre otra terminal y crea un pago:

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-Service-Token: secreto-compartido-123" \
  -H "Idempotency-Key: opt_first_payment_$(date +%s)" \
  -d '{
    "order_id": "ord_my_first_payment",
    "buyer_profile_id": "buyer_rocco",
    "amount_cents": 50000,
    "currency": "ARS"
  }'
```

**Explicación**:

- `X-Service-Token`: El secreto que configuramos en `.env.local`
- `Idempotency-Key`: Clave única para evitar duplicados
- `order_id`: ID único del pedido
- `amount_cents`: 50000 centavos = $500 ARS

**Response esperado** (201):

```json
{
  "data": {
    "id": "pay_clk7p3q1b0000qz088z8z8z8z",
    "order_id": "ord_my_first_payment",
    "buyer_profile_id": "buyer_rocco",
    "amount_cents": 50000,
    "currency": "ARS",
    "status": "pending",
    "gateway_reference": "mp_pref_1234567890",
    "checkout_url": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=mp_pref_1234567890",
    "created_at": "2026-04-30T10:00:00Z"
  }
}
```

## Paso 6: Ver el pago en la BD

Abre Prisma Studio en otra terminal:

```bash
npx prisma studio
```

Navega a `http://localhost:5555`:

- Ve a tabla `Payment`
- Deberías ver una fila con tu pago
- Status: `pending`
- Amount: 50000

## Paso 7: Simular webhook de MercadoPago

Ahora simulamos que MercadoPago aprueba el pago (normalmente esto sucedería cuando el usuario completa el checkout).

```bash
curl -X POST http://localhost:3000/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "X-Signature: test" \
  -H "X-Timestamp: $(date +%s)" \
  -d '{
    "id": "evt_test_12345",
    "type": "payment.updated",
    "data": {
      "id": 999888777,
      "external_reference": "ord_my_first_payment",
      "status": "approved"
    }
  }'
```

**Response**: `{ "received": true }` (200 OK)

## Paso 8: Verificar que el pago cambió de status

En Prisma Studio (la pestaña que dejaste abierta):

- Actualiza la tabla `Payment`
- El pago debería tener `status: "approved"`
- ¿Ves `approved_at` con la hora?

También verifica `MpWebhookEvent`:

- Deberías ver un evento con `mp_event_id: "evt_test_12345"`
- Status: `received`

## Paso 9: Ver pago en la UI (React)

Abre navegador en `http://localhost:3000/payments`

Deberías ver:

- Formulario para crear pagos (a la izquierda)
- Tabla de pagos (a la derecha)

**Crear un nuevo pago desde la UI**:

1. Ingresa `Amount (cents)`: 25000 ($ 250)
2. Haz clic "Create payment"
3. Deberías ver toast: "Payment created"
4. En la tabla, aparece nuevo pago

## Paso 10: Crear settlement (liquidación)

Para este paso, usaremos directamente Prisma (es esqueleto):

```bash
# Abre Prisma Studio
npx prisma studio

# Ve a tabla Settlement
# Crea un registro manualmente:
- payment_id: (el ID del pago que creaste)
- order_id: "ord_my_first_payment"
- order_seller_group_id: "group_123"
- seller_profile_id: "seller_juan"
- gross_amount_cents: 40000
- fee_amount_cents: 10000
- net_amount_cents: 30000
- currency: "ARS"
- status: "pending"
```

## Paso 11: Listar todos los pagos

```bash
curl -X GET http://localhost:3000/api/v1/payments
```

Response:

```json
{
  "data": [
    {
      "id": "pay_xyz123",
      "order_id": "ord_my_first_payment",
      "amount_cents": 50000,
      "status": "approved",
      "created_at": "2026-04-30T10:00:00Z"
    },
    ...
  ]
}
```

## Paso 12: Obtener detalle de UN pago

```bash
curl -X GET http://localhost:3000/api/v1/payments/pay_xyz123
```

Response:

```json
{
  "data": {
    "id": "pay_xyz123",
    "order_id": "ord_my_first_payment",
    "buyer_profile_id": "buyer_rocco",
    "amount_cents": 50000,
    "status": "approved",
    "gateway_reference": "mp_pref_1234567890",
    "approved_at": "2026-04-30T10:00:15Z",
    "created_at": "2026-04-30T10:00:00Z",
    "updated_at": "2026-04-30T10:00:15Z"
  }
}
```

## Paso 13: Probar idempotencia

Crea el mismo pago 2 veces con la misma `Idempotency-Key`:

```bash
# Primera vez
curl -X POST http://localhost:3000/api/v1/payments \
  -H "X-Service-Token: secreto-compartido-123" \
  -H "Idempotency-Key: opt_mismo_pago" \
  -d '{ "order_id": "ord_test_2", "amount_cents": 10000 }'

# Response: 201 Created, id: pay_abc123

# Segunda vez (MISMO request)
curl -X POST http://localhost:3000/api/v1/payments \
  -H "X-Service-Token: secreto-compartido-123" \
  -H "Idempotency-Key: opt_mismo_pago" \
  -d '{ "order_id": "ord_test_2", "amount_cents": 10000 }'

# Response: 200 OK, MISMO id: pay_abc123
```

✅ Notarás que ambos retornan el MISMO `id`. No se crearon 2 pagos.

## Paso 14: Test de seguridad (sin token)

```bash
# SIN X-Service-Token
curl -X POST http://localhost:3000/api/v1/payments \
  -d '{ "order_id": "test", "amount_cents": 5000 }'

# Response: 401 Unauthorized
# {
#   "error": {
#     "code": "UNAUTHORIZED",
#     "message": "Invalid service token"
#   }
# }
```

✅ Confirma que la seguridad funciona.

## Resumen del flujo que hicimos

```
1. ✅ Configurar .env.local
2. ✅ Instalar dependencias y migrar BD
3. ✅ Iniciar servidor
4. ✅ Verificar con smoke tests
5. ✅ Crear pago via API
6. ✅ Ver en BD
7. ✅ Simular webhook MP
8. ✅ Verificar status cambió
9. ✅ Usar UI React
10. ✅ Crear settlement
11. ✅ Listar pagos
12. ✅ Ver detalle
13. ✅ Probar idempotencia
14. ✅ Probar seguridad
```

## Próximos pasos recomendados

1. **Leer el código**: Abre `src/app/api/v1/payments/route.ts` y entiende cada línea
2. **Modificar**: Intenta cambiar el mensaje de error o agregar un field nuevo
3. **Tests**: Escribe tests unitarios con Vitest
4. **Integración real**: Cuando tengas credenciales MP, reemplaza el mock
5. **Desplegar**: Deploy a Vercel o tu servidor preferido

## Comandos útiles para recordar

```bash
npm run dev              # Iniciar servidor
npm run smoke            # Ejecutar tests básicos
npx prisma studio       # Ver/editar BD
npx prisma generate     # Regenerar cliente
npx prisma migrate dev  # Crear migración
npx prisma db push      # Sincronizar BD
```

## ¿Qué sigue?

- Implementar lógica de settlements
- Integrar con MercadoPago real
- Añadir más endpoints (refunds, payouts)
- Tests unitarios
- CI/CD con GitHub Actions
- Desplegar a producción

¡Felicidades! Ya entiendes cómo funciona la Payments App. 🎉
