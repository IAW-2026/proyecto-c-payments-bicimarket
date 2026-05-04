# 06 — Client Hooks (React & TanStack Query)

## ¿Qué es un Hook?

Un **hook** es una función reutilizable en React que maneja:

- Obtención de datos (queries)
- Modificación de datos (mutations)
- Estado local
- Efectos secundarios

## ¿Qué es TanStack Query?

TanStack Query (antes React Query) es una librería que maneja:

- **Caching automático** (datos en memoria para no pedir al servidor múltiples veces)
- **Reintentos** (si falla, reintenta automáticamente)
- **Sincronización** (cuando datos cambian, actualiza la UI automáticamente)
- **Tiempo de expiración** (después de X segundos, considera los datos "stale" y pide nuevos)

## Archivo de hooks

**Ubicación**: `src/hooks/use-payments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";

// Hook para LEER (GET) pagos
export function usePayments(opts?: any) {
  return useQuery(["payments", opts], async () => {
    const res = await axios.get("/api/v1/payments");
    return res.data;
  });
}

// Hook para ESCRIBIR (POST) crear pago
export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation(
    async (payload: any) => {
      const res = await axios.post("/api/v1/payments", payload);
      return res.data;
    },
    {
      onSuccess: () => {
        // Después de crear, refrescar la lista
        qc.invalidateQueries(["payments"]);
      },
    },
  );
}
```

## Hook 1: `usePayments` (lectura)

Obtiene lista de pagos del servidor.

### Uso en un componente

```typescript
import { usePayments } from '@/hooks/use-payments'

export function PaymentsList() {
  const { data, isLoading, isError } = usePayments()

  if (isLoading) return <div>Cargando...</div>
  if (isError) return <div>Error al cargar</div>

  return (
    <ul>
      {data?.data?.map(payment => (
        <li key={payment.id}>{payment.id} — ${payment.amount_cents}</li>
      ))}
    </ul>
  )
}
```

### Estados del hook

| Estado       | Significado                                               |
| ------------ | --------------------------------------------------------- |
| `isLoading`  | `true` mientras se obtienen datos                         |
| `isError`    | `true` si ocurrió un error                                |
| `data`       | Los datos obtenidos                                       |
| `error`      | El objeto de error (si `isError` es true)                 |
| `isFetching` | `true` mientras se hace la petición (distinto de loading) |
| `status`     | `'loading'`, `'error'`, `'success'`                       |

### Caching automático

```typescript
// Primer componente
const { data: payments1 } = usePayments();
// → Hace GET /api/v1/payments
// → Guarda en cache

// Segundo componente (en la misma pantalla)
const { data: payments2 } = usePayments();
// → NO hace GET nuevamente
// → Retorna datos del cache
// → Es instantáneo (sin loading)
```

### Actualizar (refrescar) datos

```typescript
const { refetch } = usePayments();

const handleRefresh = () => {
  refetch(); // Pide datos nuevos al servidor
};
```

### Con filtros/parámetros

```typescript
export function usePaymentsByStatus(status: string) {
  return useQuery(
    ["payments", status], // Clave de cache incluye el status
    async () => {
      const res = await axios.get("/api/v1/payments", { params: { status } });
      return res.data;
    },
  );
}

// Uso
const { data: approved } = usePaymentsByStatus("approved");
const { data: pending } = usePaymentsByStatus("pending");
// → Cada una tiene su cache independiente
```

## Hook 2: `useCreatePayment` (escritura)

Crea un pago llamando a `POST /api/v1/payments`.

### Uso en un componente

```typescript
import { useCreatePayment } from '@/hooks/use-payments'
import { toast } from 'sonner'

export function CreatePaymentForm() {
  const [amount, setAmount] = useState(5000)
  const create = useCreatePayment()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Dispara la mutación
      const response = await create.mutateAsync({
        order_id: `ord_${Date.now()}`,
        amount_cents: amount
      })

      // Éxito
      toast.success('Pago creado')
      console.log('Checkout URL:', response.data?.checkout_url)

    } catch (error) {
      // Error
      toast.error('No se pudo crear el pago')
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <button type="submit" disabled={create.isLoading}>
        {create.isLoading ? 'Creando...' : 'Crear pago'}
      </button>
    </form>
  )
}
```

### Estados de una mutation

| Estado      | Significado                     |
| ----------- | ------------------------------- |
| `isLoading` | `true` mientras se envía        |
| `isError`   | `true` si falló                 |
| `isSuccess` | `true` si fue exitoso           |
| `data`      | Respuesta del servidor          |
| `error`     | El error (si `isError` es true) |

### Invalidar cache después de cambios

```typescript
const { mutateAsync, isLoading } = useMutation(
  async (payload) => axios.post("/api/v1/payments", payload),
  {
    onSuccess: () => {
      // Después de crear pago, refrescar la lista
      queryClient.invalidateQueries(["payments"]);
      // Así, si el usuario vuelve a la lista, ve el pago nuevo
    },
  },
);
```

## Escribir tus propios hooks

Patrón:

```typescript
// src/hooks/use-settlements.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";

export function useSettlements(sellerId: string) {
  return useQuery(
    ["settlements", sellerId], // Clave única
    async () => {
      const res = await axios.get("/api/v1/settlements", {
        params: { sellerId },
      });
      return res.data;
    },
    {
      enabled: !!sellerId, // Solo ejecutar si hay sellerId
    },
  );
}

export function useCreateSettlement() {
  const qc = useQueryClient();

  return useMutation(
    async (payload: any) => {
      const res = await axios.post("/api/v1/settlements", payload);
      return res.data;
    },
    {
      onSuccess: (data) => {
        // Invalidar lista de settlements
        qc.invalidateQueries(["settlements"]);

        // Opcionalmente, añadir al cache sin hacer otra petición
        qc.setQueryData(["settlement", data.id], data);
      },
    },
  );
}
```

## Manejo de errores

```typescript
const { data, error } = usePayments()

if (error instanceof AxiosError) {
  if (error.response?.status === 401) {
    return <div>No autorizado</div>
  }
  if (error.response?.status === 404) {
    return <div>No encontrado</div>
  }
}

if (error) {
  return <div>Error: {error.message}</div>
}
```

## Optimizaciones

### Lazy query (obtener datos solo cuando se necesita)

```typescript
const { refetch } = useQuery(
  ["payment", id],
  async () => {
    /* ... */
  },
  { enabled: false }, // No ejecutar automáticamente
);

// Ejecutar manualmente cuando sea necesario
const handleFetch = () => refetch();
```

### Prefetch (precargar datos antes de necesitarlos)

```typescript
const qc = useQueryClient();

const handleMouseEnter = () => {
  // Precargar datos al pasar mouse
  qc.prefetchQuery(["payments"], async () => axios.get("/api/v1/payments"));
};
```

### Deduplicación de peticiones

TanStack Query automáticamente deduplica:

```typescript
// Componente A
usePayments(); // → GET /api/v1/payments

// Componente B (en paralelo, misma pantalla)
usePayments(); // → Mismo cache, sin hacer GET nuevamente
```

## Debug

```typescript
// Ver qué hay en el cache
queryClient.getQueryData(["payments"]);

// Ver todas las queries
console.log(queryClient.getQueryCache().getAll());

// Limpiar todo cache (útil para logout)
queryClient.clear();
```

## Próximos pasos

- Lee `07-ui-components.md` para construir componentes
- Lee `08-flujo-completo.md` para ver ejemplo real
