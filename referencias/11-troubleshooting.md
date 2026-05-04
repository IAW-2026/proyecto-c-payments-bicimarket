# 11 — Troubleshooting (Solución de Problemas)

## Error: "database does not exist"

### Síntoma

```
Error: ECONNREFUSED 127.0.0.1:5432
or
FATAL: database "payments" does not exist
```

### Soluciones

**1. Verificar DATABASE_URL en .env.local**

```bash
# Debe ser como:
DATABASE_URL="postgresql://user:password@localhost:5432/payments_db"

# No:
DATABASE_URL="postgresql://localhost:5432"  # ❌ Falta nombre de BD
```

**2. Si usas Supabase**

En Supabase Settings → Database → Connection string:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Copiar y pegar exacto en `.env.local`.

**3. Si usas PostgreSQL local**

```bash
# Crear BD
createdb payments_db

# Verificar conexión
psql -U postgres -d payments_db -c "SELECT 1"
```

**4. Ejecutar migraciones**

```bash
npx prisma migrate dev
```

Si aún falla, reset todo:

```bash
npx prisma migrate reset  # ⚠️ Borra TODO
npx prisma migrate dev
```

---

## Error: "Cannot find module '@/lib/prisma'"

### Síntoma

```
Module not found: Can't resolve '@/lib/prisma'
```

### Soluciones

**1. Generar cliente Prisma**

```bash
npx prisma generate
```

**2. Verificar tsconfig.json**

Debe tener:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**3. Limpiar node_modules**

```bash
rm -r node_modules
npm install
npx prisma generate
```

---

## Error en migraciones

### Síntoma

```
Migration failed. Please check the database for inconsistencies, resolve any issues, and try again.
```

### Soluciones

**1. Ver qué está mal**

```bash
npx prisma db push --skip-generate
```

**2. Reset (solo en desarrollo)**

```bash
npx prisma migrate reset
npx prisma migrate dev --name add_payments
```

**3. Revertir última migración**

```bash
# No existe comando directo, pero puedes:
# 1. Borrar carpeta prisma/migrations/latest/
# 2. Borrar schema.prisma cambios
# 3. npx prisma migrate deploy
```

---

## Error: "Payment creado pero status no cambió"

### Síntoma

Creaste un pago pero `status` sigue en `pending`.

### Causas

1. **Webhook no llegó** (MercadoPago no enviómensaje)
2. **Validación de firma falló** (ignoró el webhook)
3. **Error en handler del webhook** (rechazó mensaje)

### Soluciones

**1. Verificar webhook registrado en MP**

Ve a [MP Dashboard](https://developers.mercadopago.com) → Settings → Webhooks:

- ¿La URL está correcta?
- ¿Es accesible desde internet (usa ngrok si es local)?

**2. Ver logs de webhook**

```bash
# Abrir Prisma Studio
npx prisma studio

# Ve a MpWebhookEvent
# Busca eventos recientes (createdAt ~ ahora)
# ¿Status = 'received' (sin procesar) o 'processed'?
```

**3. Testear webhook manualmente**

```bash
curl -X POST http://localhost:3000/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_evt_1",
    "type": "payment.updated",
    "data": {
      "id": 123,
      "external_reference": "ord_test_123",
      "status": "approved"
    }
  }'
```

Deberías obtener `200 OK`.

**4. Ver logs del servidor**

Busca logs en terminal del dev server:

```
[Webhook] Received event: payment.updated
[Webhook] Payment found: pay_xyz123
[Webhook] Updated status to: approved
```

Si no ves logs, el webhook no llegó.

---

## Error: "X-Service-Token inválido"

### Síntoma

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid service token" } }
```

### Soluciones

**1. Verificar SERVICE_TOKEN_SECRET en .env.local**

```bash
# En .env.local
SERVICE_TOKEN_SECRET="mi-secreto-123"

# Enviar EXACTAMENTE lo mismo en header
curl -X POST http://localhost:3000/api/v1/payments \
  -H "X-Service-Token: mi-secreto-123"
```

**2. Verificar que lo enviás desde el código**

```typescript
// ✅ Correcto
headers: {
  'X-Service-Token': process.env.SERVICE_TOKEN_SECRET
}

// ❌ Incorrecto
headers: {
  'X-Service-Token': 'hardcoded-value'
}
```

**3. Si es undefined, env var no se cargó**

```bash
# Reiniciar servidor
npm run dev
```

---

## Error: Prisma genera tipos incorrectos

### Síntoma

```
Type 'Payment' is not assignable to type 'Prisma.Payment'
```

### Solución

```bash
# Regenerar
npx prisma generate

# Si aún falla, limpiar y reinstalar
rm -r src/generated/
npx prisma generate
npx prisma db push
```

---

## Error: "Cannot make fetch request to external URL"

### Síntoma

```
Error: fetch failed (calling Buyer App, Seller App, etc.)
```

### Causas

1. URL incorrecta
2. App no está corriendo
3. Firewall bloqueando

### Soluciones

```bash
# Testear que la URL es accesible
curl https://buyer.app.com/api/health

# Si usas localhost en development:
curl http://localhost:3001/api/health
```

**Si llamas a otra app local, usar:**

```typescript
// ✅ Correcto (en desarrollo local)
const buyerUrl = "http://localhost:3001";

// ❌ Incorrecto
const buyerUrl = "https://buyer.bicimarket.com"; // No existe localmente
```

---

## Error: "Idempotency-Key no funciona"

### Síntoma

Llamé 2 veces con la misma key, pero creó 2 payments.

### Soluciones

**1. Verificar que guardas idempotency_key**

```typescript
// Correcto
const payment = await prisma.payment.create({
  data: {
    idempotency_key: idempotencyKey, // Guardar la key
    // ...
  },
});

// Incorrecto
const payment = await prisma.payment.create({
  data: {
    // Olvidaste guardar la key
    // ...
  },
});
```

**2. Verificar que buscas antes de crear**

```typescript
// Correcto
const existing = await findByIdempotencyKey(idempotencyKey);
if (existing) return existing;

// Crear...

// Incorrecto
// (no buscar, solo crear siempre)
```

---

## Payment creado pero checkout_url es null

### Síntoma

Response tiene `checkout_url: undefined`

### Soluciones

**1. Verificar que llamamos createCheckoutPreference**

```typescript
// En POST /api/v1/payments

const pref = await createCheckoutPreference({
  amount: payment.amount_cents,
  external_reference: payment.order_id,
});

// checkout_url debe ser:
console.log(pref.init_point); // https://mp.com/checkout/...
```

**2. Si es un mock, retorna URL de test**

En desarrollo, `createCheckoutPreference` retorna:

```typescript
{
  id: 'mp_pref_mock',
  init_point: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=mp_pref_mock'
}
```

**3. Verificar que retornamos en la respuesta**

```typescript
return NextResponse.json(
  {
    data: {
      ...payment,
      checkout_url: pref.init_point, // ← Asegurar que está
    },
  },
  { status: 201 },
);
```

---

## Componente React no se actualiza después de crear pago

### Síntoma

Hago clic "Create", se crea el pago, pero la tabla de pagos no se actualiza.

### Soluciones

**1. Invalidar queries después de mutation**

```typescript
export function useCreatePayment() {
  const qc = useQueryClient();

  return useMutation(
    async (payload) => axios.post("/api/v1/payments", payload),
    {
      onSuccess: () => {
        qc.invalidateQueries(["payments"]); // ← Refrescar
      },
    },
  );
}
```

**2. Verificar que la tabla está renderizando**

```typescript
// Correcto
<PaymentsTable />

// Incorrecto
{condition && <PaymentsTable />}  // Si condition es false, no renderiza
```

**3. Ver en React DevTools**

- Abre DevTools (F12)
- Components → Busca PaymentsTable
- ¿Se ve re-render después de crear?

---

## Todos los endpoints retornan 500

### Síntoma

```json
{ "error": { "code": "INTERNAL_ERROR" } }
```

### Soluciones

**1. Ver logs del servidor**

Busca en la terminal de `npm run dev` qué error aparece.

**2. Verificar que Prisma está conectado**

```bash
# Test rápido
npx prisma db execute --stdin
SELECT 1;
```

**3. Resetear conexión a BD**

```bash
# Reiniciar servidor
npm run dev

# O resetear PrismaClient
npx prisma generate
```

---

## Tabla SQL tiene datos pero API retorna vacío

### Síntoma

Ves un payment en Prisma Studio, pero `GET /api/v1/payments` retorna lista vacía.

### Soluciones

**1. Verificar permisos de base de datos**

```bash
# Conectar a BD directamente
psql -U user -d payments_db

# Ver datos
SELECT * FROM "Payment";

# Si está vacío, asunto de sincronización
```

**2. Refrescar Prisma**

```bash
npx prisma generate
npm run dev
```

**3. Verificar filtros en endpoint**

```typescript
// ¿Hay un WHERE que filtra?
const payments = await prisma.payment.findMany({
  where: { status: "pending" }, // ← Esto podría filtrar todo
});
```

---

## Próximos pasos

- Lee `12-ejemplo-paso-a-paso.md` para tutorial completo
