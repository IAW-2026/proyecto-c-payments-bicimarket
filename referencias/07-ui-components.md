# 07 — Componentes de UI (React)

## ¿Qué son componentes?

Un **componente** es una función que retorna HTML (JSX).

Los componentes son **reutilizables** y pueden recibir datos via **props**.

## Componentes disponibles

### 1. `PaymentForm`

**Ubicación**: `src/components/payments/PaymentForm.tsx`

Formulario para crear un nuevo pago.

**Código**:

```typescript
"use client"
import React, { useState } from 'react'
import { useCreatePayment } from '@/hooks/use-payments'
import { toast } from 'sonner'

export default function PaymentForm() {
  const [amount, setAmount] = useState(5000)
  const create = useCreatePayment()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || amount <= 0) {
      toast.error('Amount must be greater than zero')
      return
    }

    try {
      const res = await create.mutateAsync({
        order_id: `ord_${Date.now()}`,
        amount_cents: amount
      })
      toast.success('Payment created')
      if (res?.data?.checkout_url || res?.checkout_url) {
        const url = res?.data?.checkout_url || res?.checkout_url
        toast('Open checkout', { description: url })
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to create payment')
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-4 border rounded">
      <label className="block mb-2">Amount (cents)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="border p-2 w-full"
      />
      <button
        type="submit"
        className="mt-3 px-3 py-2 bg-green-600 text-white rounded"
      >
        Create payment
      </button>
    </form>
  )
}
```

**Uso**:

```typescript
import PaymentForm from '@/components/payments/PaymentForm'

export function MyPage() {
  return <PaymentForm />
}
```

**Props**: Ninguno (usa hooks internamente)

**Validaciones**:

- Amount > 0
- Mostrar toast de éxito/error

### 2. `PaymentsTable`

**Ubicación**: `src/components/payments/PaymentsTable.tsx`

Tabla que lista todos los pagos.

```typescript
"use client"
import React from 'react'
import { usePayments } from '@/hooks/use-payments'
import { toast } from 'sonner'

export default function PaymentsTable() {
  const { data, isLoading, isError } = usePayments()

  if (isError) {
    toast.error('Failed to load payments')
  }

  return (
    <div className="border rounded">
      <table className="w-full text-left">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Currency</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={4} className="p-4">Loading...</td></tr>
          )}
          {!isLoading && data?.data?.length === 0 && (
            <tr><td colSpan={4} className="p-4">No payments</td></tr>
          )}
          {!isLoading && data?.data?.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.id}</td>
              <td className="p-2">{p.amount_cents}</td>
              <td className="p-2">{p.currency}</td>
              <td className="p-2">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Uso**:

```typescript
import PaymentsTable from '@/components/payments/PaymentsTable'

export function PaymentsListPage() {
  return <PaymentsTable />
}
```

**Características**:

- Carga automática de datos
- Estados de carga/error
- Tabla limpia con Tailwind

### 3. `PaymentsList` (Alternativa)

Versión de lista (no tabla):

```typescript
export default function PaymentsList() {
  const { data } = usePayments()

  return (
    <ul className="space-y-2">
      {data?.data?.map((p: any) => (
        <li
          key={p.id}
          className="p-3 border rounded flex justify-between"
        >
          <span>{p.id}</span>
          <span className="font-bold">${p.amount_cents / 100}</span>
          <span className="text-sm text-gray-500">{p.status}</span>
        </li>
      ))}
    </ul>
  )
}
```

## Construir nuevos componentes

### Patrón recomendado

```typescript
// src/components/payments/SettlementRow.tsx

"use client"
import React from 'react'
import type { Settlement } from '@/types/payments'

interface SettlementRowProps {
  settlement: Settlement
  onPay?: (id: string) => void
}

export default function SettlementRow({ settlement, onPay }: SettlementRowProps) {
  return (
    <div className="p-3 border rounded">
      <div className="flex justify-between">
        <span>{settlement.seller_profile_id}</span>
        <span>${settlement.net_amount_cents / 100}</span>
      </div>
      <div className="text-sm text-gray-500">
        Status: {settlement.status}
      </div>
      {settlement.status === 'pending' && (
        <button
          onClick={() => onPay?.(settlement.id)}
          className="mt-2 px-2 py-1 bg-blue-600 text-white rounded text-sm"
        >
          Pay now
        </button>
      )}
    </div>
  )
}
```

**Uso**:

```typescript
import SettlementRow from '@/components/payments/SettlementRow'

export function SettlementsPage() {
  return (
    <div>
      {settlements.map(s => (
        <SettlementRow
          key={s.id}
          settlement={s}
          onPay={handlePay}
        />
      ))}
    </div>
  )
}
```

### Componentes de UI reutilizables

Ya están disponibles en `src/components/ui/`:

- `Button` — Botón
- `Card` — Tarjeta
- `Dialog` — Modal
- `Form` — Formularios con validación
- `Input` — Input text
- `Table` — Tabla
- `Toast` — Notificaciones
- `Spinner` — Indicador de carga
- `Badge` — Etiqueta
- Y muchos más...

**Uso**:

```typescript
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function MyComponent() {
  return (
    <Card>
      <Button>Click me</Button>
    </Card>
  )
}
```

## Estado local vs Global

### Estado local (useState)

Para datos que solo un componente necesita:

```typescript
const [amount, setAmount] = useState(5000);
```

### Estado global (Zustand)

Para datos que múltiples componentes necesitan:

```typescript
// src/store/payments-store.ts
import { create } from 'zustand'

export const usePaymentsStore = create((set) => ({
  selectedPayment: null,
  setSelected: (payment) => set({ selectedPayment: payment })
}))

// Uso
import { usePaymentsStore } from '@/store/payments-store'

export function Component1() {
  const { setSelected } = usePaymentsStore()
  return <button onClick={() => setSelected(payment)}>Select</button>
}

export function Component2() {
  const { selectedPayment } = usePaymentsStore()
  return <div>{selectedPayment?.id}</div>
}
```

## Toasts (notificaciones)

Usar `sonner` para mostrar mensajes al usuario:

```typescript
import { toast } from "sonner";

// Éxito
toast.success("Pago creado");

// Error
toast.error("No se pudo crear");

// Info
toast("Hello", { description: "Check this out" });

// Cargando
toast.loading("Creating payment...");

// Cerrar un toast
const id = toast.loading("Wait...");
setTimeout(() => toast.dismiss(id), 2000);
```

## Styling con Tailwind

```typescript
// Clases Tailwind
<div className="p-4 border rounded bg-blue-600 text-white">
  // p-4 = padding 4
  // border = borde
  // rounded = esquinas redondeadas
  // bg-blue-600 = fondo azul
  // text-white = texto blanco
</div>
```

## TypeScript en componentes

Siempre tipar props y estados:

```typescript
interface PaymentRowProps {
  payment: Payment  // Tipo importado de types/
  onDelete?: (id: string) => void
}

export default function PaymentRow({ payment, onDelete }: PaymentRowProps) {
  return <div>...</div>
}
```

## Próximos pasos

- Lee `08-flujo-completo.md` para ver un ejemplo real
- Lee `06-client-hooks.md` para entender cómo obtener datos
