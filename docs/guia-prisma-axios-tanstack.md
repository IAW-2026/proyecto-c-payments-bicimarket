# Guia: Prisma + Axios + TanStack Query

Como funciona el flujo completo de datos en esta app.

## Arquitectura

```
[Browser]                    [Servidor Next.js]              [Supabase DB]
    |                              |                              |
    |  1. useProducts()            |                              |
    |  (TanStack Query)            |                              |
    |                              |                              |
    |--- GET /api/products ------->|                              |
    |    (Axios)                   |  2. prisma.product.findMany()|
    |                              |------------------------------>|
    |                              |<--------- rows --------------|
    |<------ JSON response --------|                              |
    |                              |                              |
    |  3. useCreateProduct()       |                              |
    |  (TanStack Query mutation)   |                              |
    |                              |                              |
    |--- POST /api/products ------>|                              |
    |    (Axios + body JSON)       |  4. prisma.product.create()  |
    |                              |------------------------------>|
    |                              |<--------- new row -----------|
    |<------ JSON response --------|                              |
    |                              |                              |
    |  5. invalidateQueries()      |                              |
    |  (refetch automatico)        |                              |
```

## Paso a paso

### 1. Modelo en Prisma (`prisma/schema.prisma`)

Definimos la tabla en el schema:

```prisma
model Product {
  id          String   @id @default(cuid())
  title       String
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Despues corremos la migracion:

```bash
npx prisma migrate dev --name add-product
```

Esto hace dos cosas:
- Crea la tabla `Product` en Supabase
- Regenera el Prisma Client con los tipos actualizados

### 2. API Routes (`src/app/api/products/route.ts`)

Next.js usa file-based routing para APIs. El archivo `route.ts` exporta funciones con el nombre del metodo HTTP:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products
export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

// POST /api/products
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description } = body;

  if (!title || !description) {
    return NextResponse.json(
      { error: "title y description son requeridos" },
      { status: 400 }
    );
  }

  const product = await prisma.product.create({
    data: { title, description },
  });
  return NextResponse.json(product, { status: 201 });
}
```

**Prisma Client** (`src/lib/prisma.ts`) es un singleton que reutiliza la conexion en desarrollo:

```ts
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 3. Axios Instance (`src/lib/axios.ts`)

Una instancia preconfigurada para no repetir el baseURL:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});
```

### 4. Hooks con TanStack Query (`src/hooks/use-products.ts`)

Aca conectamos Axios con TanStack Query:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

// GET — useQuery para leer datos
export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],          // cache key
    queryFn: async () => {
      const { data } = await api.get("/products");
      return data;
    },
  });
}

// POST — useMutation para escribir datos
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newProduct: CreateProductData) => {
      const { data } = await api.post("/products", newProduct);
      return data;
    },
    onSuccess: () => {
      // Invalida el cache → TanStack Query refetchea automaticamente
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
```

**Conceptos clave de TanStack Query:**

- `useQuery` — para leer datos (GET). Maneja cache, loading, error, refetch automatico.
- `useMutation` — para escribir datos (POST/PUT/DELETE). No cachea, pero puede invalidar queries.
- `queryKey` — identificador unico del cache. Si dos componentes usan el mismo key, comparten datos.
- `invalidateQueries` — marca el cache como "stale" y dispara un refetch automatico.

### 5. Componente (`src/app/products/page.tsx`)

En el componente usamos los hooks:

```tsx
"use client"; // necesario porque TanStack Query usa hooks de React

const { data: products, isLoading, error } = useProducts();
const createProduct = useCreateProduct();

// Para crear:
createProduct.mutate({ title, description });

// Estados disponibles:
// isLoading — primera carga
// error — si fallo el request
// createProduct.isPending — si el POST esta en curso
```

## Flujo resumido

1. **Prisma** define el modelo y genera tipos TypeScript
2. **API Route** usa Prisma para leer/escribir en la DB
3. **Axios** hace los requests HTTP al API Route
4. **TanStack Query** maneja el cache, loading states, y refetch automatico
5. **El componente** solo consume los hooks, no sabe nada de HTTP ni de la DB
