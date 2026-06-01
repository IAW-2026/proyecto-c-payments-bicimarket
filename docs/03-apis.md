# 1.3 — Diseño de APIs Inter-Servicios

> **Tipo C — Marketplace · BiciMarket**

---

## 0. Convenciones globales

> **Regla**: solo REST clásico sobre HTTP. Métodos permitidos: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. No hay webhooks entre nuestras apps; el único webhook es el de Mercado Pago en `/webhooks/mercadopago`.

> **Restricción del proyecto — stock ilimitado**: el sistema no maneja inventario. Los `products` no tienen campo `stock`, no existe el código de error `INSUFFICIENT_STOCK`, no hay endpoint de ajuste de stock ni recurso `inventory-movements`. Toda publicación `active` se considera disponible. Ver `01-descripcion.md §1.1`.

### 0.1 Base path y versionado

- Toda API vive bajo `/api/v1/...`.
- El webhook externo de Mercado Pago vive bajo `/webhooks/mercadopago` (única ruta fuera de `/api/v1`).
- Cambios incompatibles → `/api/v2/...`. Coexisten al menos un sprint.

### 0.2 Headers obligatorios

| Header            | Aplica a                             | Valor                                                     |
| ----------------- | ------------------------------------ | --------------------------------------------------------- |
| `Content-Type`    | POST/PATCH/PUT con body              | `application/json` (o `multipart/form-data` para uploads) |
| `Authorization`   | Llamadas desde la UI propia          | `Bearer <JWT-de-Clerk-de-la-app>`                         |
| `X-Service-Token` | Llamadas server-to-server entre apps | secret rotable del par origen→destino                     |
| `X-Request-Id`    | Toda llamada inter-app               | UUID que se propaga en cadena                             |
| `Idempotency-Key` | POST que crea recursos               | UUID elegido por el cliente                               |

### 0.3 Formato de error

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "No existe una orden con id ord_01H…",
    "details": { "orderId": "ord_01H…" }
  }
}
```

| HTTP                       | Cuándo                                                                    |
| -------------------------- | ------------------------------------------------------------------------- |
| 400 `BAD_REQUEST`          | Payload inválido sintácticamente.                                         |
| 401 `UNAUTHORIZED`         | JWT/Service Token inválido o ausente.                                     |
| 403 `FORBIDDEN`            | Auth válido pero sin permiso.                                             |
| 404 `NOT_FOUND`            | Recurso inexistente.                                                      |
| 409 `CONFLICT`             | Estado inválido para esa transición.                                      |
| 422 `UNPROCESSABLE_ENTITY` | Validación de negocio falla (ej: cotización vencida, dirección inválida). |
| 429 `RATE_LIMITED`         | Demasiadas requests.                                                      |
| 500 `INTERNAL`             | Error del servidor.                                                       |
| 502 `UPSTREAM_ERROR`       | Falla al llamar a otra app o a MP.                                        |

### 0.4 Paginación estándar

Querystring: `?page=1&limit=20&sort=-created_at&q=...`.

```json
{
  "data": [
    /* ... */
  ],
  "pagination": {
    "total": 134,
    "page": 1,
    "limit": 20,
    "has_more": true,
    "next_cursor": null
  }
}
```

### 0.5 IDs

Todos los IDs son strings con prefijo del recurso (estilo Stripe): `ord_…`, `prd_…`, `usr_…`, `shp_…`, `pay_…`, `set_…`, `pkg_…`, `qte_…`. Internamente CUID/ULID, no auto-increment.

### 0.6 Timestamps

ISO 8601 UTC: `2026-04-25T14:32:00Z`.

### 0.7 Moneda y montos

Montos en **centavos** como entero (`amount_cents: 1599900` = ARS 15.999,00). Currency siempre `"ARS"`.

---

# Buyer App — `https://buyer.bicimarket.com` **_Vercel URL_**

Owner: Camila Rojas Fritz. Clerk: `buyer.bicimarket`.

## B1. Perfil del comprador

### `GET /api/v1/buyer/profile`

Devuelve el perfil propio.

**Auth**: Bearer JWT (rol `buyer`).

**Response 200**

```json
{
  "id": "byp_01H8X7K9JZ3M4N5P6Q7R8S9T0",
  "clerk_user_id": "user_2abcDef…",
  "full_name": "Camila Rojas",
  "email": "camila@example.com",
  "phone": "+5491134567890",
  "default_shipping_address_id": "adr_01H…",
  "created_at": "2026-04-01T12:00:00Z",
  "updated_at": "2026-04-20T10:15:00Z"
}
```

### `PATCH /api/v1/buyer/profile`

Actualiza el perfil del comprador.

**Request**

```json
{
  "full_name": "Camila Rojas",
  "phone": "+5491134567890",
  "default_shipping_address_id": "adr_01H…"
}
```

**Response 200**

```json
{
  "id": "byp_01H…",
  "clerk_user_id": "user_2abc…",
  "full_name": "Camila Rojas",
  "email": "camila@example.com",
  "phone": "+5491134567890",
  "default_shipping_address_id": "adr_01H…"
}
```

---

## B2. Direcciones

### `GET /api/v1/buyer/addresses`

**Response 200**

```json
{
  "data": [
    {
      "id": "adr_01H…",
      "alias": "Casa",
      "street": "Av. Corrientes",
      "number": "1234",
      "apartment": "5B",
      "city": "CABA",
      "province": "Buenos Aires",
      "postal_code": "C1043",
      "country": "AR",
      "is_default": true
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "has_more": false }
}
```

### `POST /api/v1/buyer/addresses`

**Request**

```json
{
  "alias": "Trabajo",
  "street": "Av. del Libertador",
  "number": "5000",
  "apartment": "PB",
  "city": "CABA",
  "province": "Buenos Aires",
  "postal_code": "C1426",
  "country": "AR",
  "is_default": false
}
```

**Response 201**: el address creado.

### `PATCH /api/v1/buyer/addresses/{addressId}`

**Request**: idéntico al POST.
**Response 200**: address actualizado.

### `DELETE /api/v1/buyer/addresses/{addressId}`

**Response 204** sin body.

---

## B3. Carrito

### `GET /api/v1/buyer/cart`

Devuelve el carrito activo. Si no existe, lo crea vacío.

**Response 200**

```json
{
  "id": "crt_01H…",
  "buyer_profile_id": "byp_01H…",
  "status": "active",
  "items": [
    {
      "id": "cit_01H…",
      "product_id": "prd_01H…",
      "seller_profile_id": "slp_01H…",
      "product_name_snapshot": "Bicicleta Trek Marlin 5",
      "unit_price_cents": 65000000,
      "currency": "ARS",
      "quantity": 1,
      "weight_grams_snapshot": 14500
    },
    {
      "id": "cit_01H…",
      "product_id": "prd_01H…",
      "seller_profile_id": "slp_02H…",
      "product_name_snapshot": "Cubierta Continental 29\"",
      "unit_price_cents": 4500000,
      "currency": "ARS",
      "quantity": 2,
      "weight_grams_snapshot": 750
    }
  ],
  "groups_by_seller": [
    {
      "seller_profile_id": "slp_01H…",
      "items_subtotal_cents": 65000000,
      "weight_grams_total": 14500
    },
    {
      "seller_profile_id": "slp_02H…",
      "items_subtotal_cents": 9000000,
      "weight_grams_total": 1500
    }
  ],
  "items_total_cents": 74000000,
  "currency": "ARS"
}
```

### `POST /api/v1/buyer/cart`

**Request**

```json
{
  "product_id": "prd_01H…",
  "quantity": 1
}
```

Buyer App llama internamente a `GET /api/v1/products/{id}/availability` en Seller App para resolver `seller_profile_id`, `unit_price_cents`, `weight_grams` y confirmar que el producto está `active`. Como por restricción del proyecto el stock es ilimitado, no hay validación de cantidad disponible.

**Response 201**: el `cart_item` creado.

**Errores comunes**:

- `404 PRODUCT_NOT_FOUND`
- `409 PRODUCT_NOT_ACTIVE` si la publicación no está `active`

### `PATCH /api/v1/buyer/cart/{itemId}`

**Request**

```json
{ "quantity": 3 }
```

**Response 200**: el cart_item actualizado.

### `DELETE /api/v1/buyer/cart/{itemId}`

**Response 204**.

---

## B4. Favoritos

### `GET /api/v1/buyer/favorites`

**Response 200**

```json
{
  "data": [
    {
      "id": "fav_01H…",
      "product_id": "prd_01H…",
      "added_at": "2026-04-22T10:00:00Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "has_more": false }
}
```

### `POST /api/v1/buyer/favorites`

**Request**: `{ "product_id": "prd_01H…" }`. **Response 201**.

### `DELETE /api/v1/buyer/favorites/{favoriteId}`

**Response 204**.

---

## B5. Órdenes (fuente de verdad de `order_id`)

### `POST /api/v1/buyer/checkout`

Crea la orden a partir del carrito + dirección + cotizaciones. **Idempotency-Key obligatorio.**

**Request**

```json
{
  "shipping_address_id": "adr_01H…",
  "seller_groups": [
    {
      "seller_profile_id": "slp_01H…",
      "shipping_quote_id": "qte_01H…"
    },
    {
      "seller_profile_id": "slp_02H…",
      "shipping_quote_id": "qte_02H…"
    }
  ],
  "notes": "Dejar en portería si no hay nadie."
}
```

**Response 201**

```json
{
  "id": "ord_01H8X9…",
  "buyer_profile_id": "byp_01H…",
  "status": "pending_payment",
  "items_total_cents": 74000000,
  "shipping_total_cents": 1500000,
  "total_cents": 75500000,
  "currency": "ARS",
  "shipping_address_snapshot": {
    "street": "Av. Corrientes",
    "number": "1234",
    "city": "CABA",
    "province": "Buenos Aires",
    "postal_code": "C1043",
    "country": "AR"
  },
  "seller_groups": [
    {
      "id": "osg_01H…",
      "seller_profile_id": "slp_01H…",
      "items_subtotal_cents": 65000000,
      "shipping_cost_cents": 1200000,
      "shipping_quote_id": "qte_01H…",
      "weight_grams_total": 14500,
      "status": "pending",
      "shipping_status": "pending",
      "shipment_id": null
    },
    {
      "id": "osg_02H…",
      "seller_profile_id": "slp_02H…",
      "items_subtotal_cents": 9000000,
      "shipping_cost_cents": 300000,
      "shipping_quote_id": "qte_02H…",
      "weight_grams_total": 1500,
      "status": "pending",
      "shipping_status": "pending",
      "shipment_id": null
    }
  ],
  "items": [
    {
      "id": "oit_01H…",
      "seller_group_id": "osg_01H…",
      "product_id": "prd_01H…",
      "product_name_snapshot": "Bicicleta Trek Marlin 5",
      "unit_price_cents": 65000000,
      "quantity": 1,
      "weight_grams_snapshot": 14500
    }
  ],
  "created_at": "2026-04-25T14:32:00Z"
}
```

**Errores**:

- `409 CART_EMPTY`
- `409 QUOTE_EXPIRED` con `details: { quote_id, expires_at }`
- `422 ADDRESS_INVALID`

### `GET /api/v1/buyer/orders/{orderId}`

**Response 200**: misma forma que el POST.

### `GET /api/v1/buyer/orders`

**Response 200**

```json
{
  "data": [
    {
      "id": "ord_01H…",
      "status": "paid",
      "total_cents": 75500000,
      "currency": "ARS",
      "created_at": "2026-04-25T14:32:00Z",
      "seller_groups_count": 2
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "has_more": false }
}
```

### `PATCH /api/v1/orders/{orderId}` (server-to-server)

Lo llama Payments App. Requiere `X-Service-Token`.

**Request**

```json
{
  "status": "paid",
  "source": "payments",
  "payment_id": "pay_01H…",
  "occurred_at": "2026-04-25T14:35:00Z"
}
```

`status` válido: `paid` | `payment_failed` | `cancelled` | `refunded`.

**Response 200**: la orden actualizada.

### `PATCH /api/v1/orders/{orderId}/seller-groups/{groupId}/shipping` (server-to-server)

Lo llama Shipping App.

**Request**

```json
{
  "shipping_status": "in_transit",
  "shipment_id": "shp_01H…",
  "tracking_number": "TRK-AR-789",
  "occurred_at": "2026-04-26T08:10:00Z"
}
```

`shipping_status` válido: `ready_for_pickup` | `picked_up` | `in_transit` | `out_for_delivery` | `delivered` | `returned`.

**Response 200**: el seller_group actualizado.

### `POST /api/v1/buyer/orders/{orderId}/cancel`

Solo si `status=pending_payment`.

**Request**: `{ "reason": "Cambié de opinión" }`.

**Response 200**: orden con `status=cancelled`.

**Error 409 CANNOT_CANCEL** si ya está paga.

---

# Seller App — `https://seller.bicimarket.com` **_Vercel URL_**

Owner: Pierino Spina. Clerk: `seller.bicimarket`.

## S1. Perfil de vendedor

### `GET /api/v1/seller-profile/me`

**Response 200**

```json
{
  "id": "slp_01H…",
  "clerk_user_id": "user_seller_xyz",
  "legal_name": "Bicicletería del Sur SRL",
  "display_name": "BiciSur",
  "tax_id": "30-71234567-8",
  "tax_condition": "responsable_inscripto",
  "bank_account_reference": "mp_collector_123456789",
  "pickup_address": {
    "street": "Av. Rivadavia",
    "number": "9000",
    "city": "Caballito",
    "province": "Buenos Aires",
    "postal_code": "C1406",
    "country": "AR"
  },
  "verification_status": "verified",
  "created_at": "2026-03-01T10:00:00Z"
}
```

### `PUT /api/v1/seller-profile/me`

**Request**: mismos campos que el GET (excepto `verification_status`, que solo lo cambia admin).

**Response 200**: perfil actualizado.

### `GET /api/v1/seller-profile/{sellerProfileId}/pickup-address` (server-to-server)

Lo consume Shipping para cotizar y crear el envío.

**Response 200**

```json
{
  "seller_profile_id": "slp_01H…",
  "pickup_address": {
    "street": "Av. Rivadavia",
    "number": "9000",
    "city": "Caballito",
    "province": "Buenos Aires",
    "postal_code": "C1406",
    "country": "AR"
  }
}
```

---

## S2. Catálogo público

### `GET /api/v1/products`

**Querystring**: `?q=trek&category=mtb&brand=trek&min_price_cents=10000000&max_price_cents=100000000&seller_id=slp_01H…&sort=-created_at&page=1&limit=20`.

**Response 200**

```json
{
  "data": [
    {
      "id": "prd_01H…",
      "seller_profile_id": "slp_01H…",
      "title": "Bicicleta Trek Marlin 5 - 2024",
      "brand": "Trek",
      "model": "Marlin 5",
      "category": "mtb",
      "price_cents": 65000000,
      "currency": "ARS",
      "weight_grams": 14500,
      "dimensions_cm": { "length": 180, "width": 60, "height": 110 },
      "status": "active",
      "main_image_url": "https://cdn.bicimarket.com/prd_01H…/main.jpg",
      "created_at": "2026-04-10T11:00:00Z"
    }
  ],
  "pagination": { "total": 87, "page": 1, "limit": 20, "has_more": true }
}
```

### `GET /api/v1/products/{productId}`

**Response 200**

```json
{
  "id": "prd_01H…",
  "seller_profile_id": "slp_01H…",
  "seller_display_name": "BiciSur",
  "title": "Bicicleta Trek Marlin 5 - 2024",
  "description": "MTB rodado 29, 24 velocidades, frenos hidráulicos.",
  "brand": "Trek",
  "model": "Marlin 5",
  "category": "mtb",
  "condition": "new",
  "price_cents": 65000000,
  "currency": "ARS",
  "weight_grams": 14500,
  "dimensions_cm": { "length": 180, "width": 60, "height": 110 },
  "status": "active",
  "images": [
    {
      "id": "img_01H…",
      "url": "https://cdn.bicimarket.com/…/1.jpg",
      "position": 0
    },
    {
      "id": "img_02H…",
      "url": "https://cdn.bicimarket.com/…/2.jpg",
      "position": 1
    }
  ],
  "created_at": "2026-04-10T11:00:00Z"
}
```

### `GET /api/v1/products/{productId}/availability`

Confirma que el producto sigue publicado y devuelve los datos vigentes que necesita Buyer App para armar el carrito y la orden. **No expone stock**: por restricción del proyecto el stock es ilimitado, por lo que toda publicación `active` se considera disponible.

**Response 200**

```json
{
  "product_id": "prd_01H…",
  "seller_profile_id": "slp_01H…",
  "status": "active",
  "available": true,
  "unit_price_cents": 65000000,
  "currency": "ARS",
  "weight_grams": 14500,
  "dimensions_cm": { "length": 180, "width": 60, "height": 110 },
  "checked_at": "2026-04-25T14:30:00Z"
}
```

`available` es `true` si y solo si `status=active` y el `seller_profile` está `verified`. Cuando es `false`, el producto no se puede agregar al carrito y Buyer App devuelve `409 PRODUCT_NOT_ACTIVE`.

---

## S3. Gestión de productos (privado, vendedor)

### `POST /api/v1/products`

**Auth**: Bearer JWT con rol `seller`.

**Request**

```json
{
  "title": "Bicicleta Trek Marlin 5 - 2024",
  "description": "MTB rodado 29, 24 velocidades, frenos hidráulicos.",
  "brand": "Trek",
  "model": "Marlin 5",
  "category": "mtb",
  "condition": "new",
  "price_cents": 65000000,
  "currency": "ARS",
  "weight_grams": 14500,
  "dimensions_cm": { "length": 180, "width": 60, "height": 110 }
}
```

> No hay campo `stock`: el proyecto trabaja con stock ilimitado.

**Response 201**: producto en `status=draft`. Pasa a `active` con `PATCH` cuando tiene al menos una imagen.

### `PATCH /api/v1/products/{productId}`

**Request** (cualquier subset):

```json
{
  "price_cents": 62000000,
  "status": "active"
}
```

**Errores**:

- `422 VALIDATION_FAILED` con `details: { weight_grams: "required", images: "at least 1" }` si se intenta `status=active` sin requisitos.

### `DELETE /api/v1/products/{productId}`

Soft delete: pasa a `status=archived`. **Response 204**.

### `POST /api/v1/products/{productId}/images`

**Content-Type**: `multipart/form-data` con campo `file` y opcional `position`.

**Response 201**

```json
{
  "id": "img_01H…",
  "product_id": "prd_01H…",
  "url": "https://cdn.bicimarket.com/prd_01H…/1.jpg",
  "position": 0
}
```

### `DELETE /api/v1/products/{productId}/images/{imageId}`

**Response 204**.

---

## S4. Sub-órdenes de venta (`sales_orders`)

### `POST /api/v1/sales-orders` (server-to-server, lo llama Payments)

**Request**

```json
{
  "order_id": "ord_01H…",
  "order_seller_group_id": "osg_01H…",
  "buyer_profile_id": "byp_01H…",
  "buyer_clerk_user_id": "user_buyer_abc",
  "items": [
    {
      "product_id": "prd_01H…",
      "product_name_snapshot": "Bicicleta Trek Marlin 5",
      "unit_price_cents": 65000000,
      "quantity": 1
    }
  ],
  "items_subtotal_cents": 65000000,
  "shipping_cost_cents": 1200000,
  "total_cents": 66200000,
  "currency": "ARS",
  "shipping_address_snapshot": {
    "street": "Av. Corrientes",
    "number": "1234",
    "city": "CABA",
    "province": "Buenos Aires",
    "postal_code": "C1043",
    "country": "AR"
  },
  "payment_id": "pay_01H…"
}
```

**Response 201**

```json
{
  "id": "sor_01H…",
  "order_id": "ord_01H…",
  "order_seller_group_id": "osg_01H…",
  "seller_profile_id": "slp_01H…",
  "buyer_profile_id": "byp_01H…",
  "fulfillment_status": "pending",
  "shipping_status": "pending",
  "payment_status": "paid",
  "total_cents": 66200000,
  "currency": "ARS",
  "created_at": "2026-04-25T14:35:00Z"
}
```

### `GET /api/v1/sales-orders?status=paid&page=1&limit=20`

**Response 200**: lista paginada de sub-órdenes del vendedor logueado.

### `GET /api/v1/sales-orders/{salesOrderId}`

**Response 200**: igual al POST + items + tracking.

### `POST /api/v1/sales-orders/{salesOrderId}/accept`

Marca `fulfillment_status=accepted`.

**Response 200**: sales_order actualizada.

### `POST /api/v1/sales-orders/{salesOrderId}/reject`

**Request**: `{ "reason": "Producto dañado al revisar antes del despacho" }`.
**Response 200**: dispara reembolso vía `POST /api/v1/payments/{id}/refund` en Payments.

### `PATCH /api/v1/sales-orders/{salesOrderId}/prepare`

**Request**: `{ "fulfillment_status": "ready_to_ship" }`.
Cuando pasa a `ready_to_ship`, Seller llama internamente a Shipping `POST /shipments`.

**Response 200**.

### `PATCH /api/v1/sales-orders/{salesOrderId}/payment-status` (server-to-server, lo llama Payments)

**Request**

```json
{
  "payment_status": "settled",
  "settlement_id": "set_01H…",
  "occurred_at": "2026-04-30T10:00:00Z"
}
```

`payment_status`: `paid` | `refunded` | `settled`.
**Response 200**.

### `PATCH /api/v1/sales-orders/{salesOrderId}/shipping-status` (server-to-server, lo llama Shipping)

**Request**

```json
{
  "shipping_status": "delivered",
  "shipment_id": "shp_01H…",
  "occurred_at": "2026-04-28T16:20:00Z"
}
```

**Response 200**.

---

## S5. Inventario

> **No aplica en esta etapa.** Por restricción del proyecto el stock es ilimitado, así que no existen los endpoints `PATCH /products/{id}/stock` ni `GET /inventory-movements` ni el recurso `inventory_movements`. Esta sección queda como referencia futura por si en una etapa posterior se decide habilitar control de inventario; mientras tanto, ningún cliente debe llamar a endpoints de stock porque la Seller App no los expone.

---

# Shipping App — `https://shipping.bicimarket.com` **_Vercel URL_**

Owner: Enrique Seitz. Clerk: `shipping.bicimarket`.

## SH1. Cotizaciones

### `POST /api/v1/shipping-quotes`

Lo llama Buyer App durante el checkout. Una cotización por cada `seller_group`.

**Request**

```json
{
  "from": {
    "seller_profile_id": "slp_01H…"
  },
  "to": {
    "city": "CABA",
    "province": "Buenos Aires",
    "postal_code": "C1043",
    "country": "AR"
  },
  "packages": [
    {
      "weight_grams": 14500,
      "length_cm": 180,
      "width_cm": 60,
      "height_cm": 110
    }
  ],
  "service_level": "standard"
}
```

`service_level`: `standard` | `express` | `same_day`.

**Response 200**

```json
{
  "id": "qte_01H…",
  "seller_profile_id": "slp_01H…",
  "service_level": "standard",
  "carrier": "andreani",
  "cost_cents": 1200000,
  "currency": "ARS",
  "estimated_days_min": 3,
  "estimated_days_max": 5,
  "weight_grams_total": 14500,
  "packages_count": 1,
  "expires_at": "2026-04-25T15:32:00Z"
}
```

`expires_at` = ahora + 60 minutos. Buyer App debe usar esta `quote_id` al crear la orden, y Shipping valida que no esté vencida cuando se crea el shipment.

---

## SH2. Envíos

### `POST /api/v1/shipments` (server-to-server, lo llama Seller)

**Request**

```json
{
  "shipping_quote_id": "qte_01H…",
  "order_id": "ord_01H…",
  "order_seller_group_id": "osg_01H…",
  "sales_order_id": "sor_01H…",
  "seller_profile_id": "slp_01H…",
  "buyer_profile_id": "byp_01H…",
  "shipping_address_snapshot": {
    "street": "Av. Corrientes",
    "number": "1234",
    "city": "CABA",
    "province": "Buenos Aires",
    "postal_code": "C1043",
    "country": "AR"
  },
  "packages": [
    {
      "weight_grams": 14500,
      "length_cm": 180,
      "width_cm": 60,
      "height_cm": 110,
      "description": "Bicicleta Trek Marlin 5"
    }
  ]
}
```

**Response 201**

```json
{
  "id": "shp_01H…",
  "order_id": "ord_01H…",
  "order_seller_group_id": "osg_01H…",
  "sales_order_id": "sor_01H…",
  "seller_profile_id": "slp_01H…",
  "buyer_profile_id": "byp_01H…",
  "carrier": "andreani",
  "service_level": "standard",
  "tracking_number": "TRK-AR-789",
  "label_url": "https://cdn.bicimarket.com/labels/shp_01H….pdf",
  "status": "ready_for_pickup",
  "weight_grams_total": 14500,
  "cost_cents": 1200000,
  "currency": "ARS",
  "packages": [
    {
      "id": "pkg_01H…",
      "weight_grams": 14500,
      "length_cm": 180,
      "width_cm": 60,
      "height_cm": 110,
      "description": "Bicicleta Trek Marlin 5",
      "label_url": "https://cdn.bicimarket.com/labels/pkg_01H….pdf"
    }
  ],
  "created_at": "2026-04-25T14:40:00Z"
}
```

**Errores**:

- `409 QUOTE_EXPIRED`
- `409 SHIPMENT_ALREADY_EXISTS` con `details: { existing_shipment_id }`

### `GET /api/v1/shipments/{shipmentId}`

**Response 200**: igual al POST.

### `GET /api/v1/shipments?orderId=ord_01H…`

**Response 200**

```json
{
  "data": [
    {
      "id": "shp_01H…",
      "order_id": "ord_01H…",
      "order_seller_group_id": "osg_01H…",
      "seller_profile_id": "slp_01H…",
      "tracking_number": "TRK-AR-789",
      "status": "in_transit"
    },
    {
      "id": "shp_02H…",
      "order_id": "ord_01H…",
      "order_seller_group_id": "osg_02H…",
      "seller_profile_id": "slp_02H…",
      "tracking_number": "TRK-AR-790",
      "status": "ready_for_pickup"
    }
  ],
  "pagination": { "total": 2, "page": 1, "limit": 20, "has_more": false }
}
```

### `PATCH /api/v1/shipments/{shipmentId}/status`

Para correcciones admin. **Auth**: rol `admin` o `logistics`.

**Request**: `{ "status": "in_transit", "note": "Demora por feriado" }`.
**Response 200**: shipment actualizado.

---

## SH3. Paquetes

### `POST /api/v1/shipments/{shipmentId}/packages`

**Request**

```json
{
  "weight_grams": 750,
  "length_cm": 70,
  "width_cm": 70,
  "height_cm": 10,
  "description": "Cubierta Continental 29\""
}
```

**Response 201**: package creado. Recalcula `weight_grams_total` y `cost_cents` del shipment.

---

## SH4. Tracking events

### `POST /api/v1/shipments/{shipmentId}/tracking-events`

**Auth**: `logistics` o `X-Service-Token` (carrier integration).

**Request**

```json
{
  "event_type": "in_transit",
  "location": "Centro de distribución Avellaneda",
  "note": "Salió hacia destino",
  "occurred_at": "2026-04-26T08:00:00Z"
}
```

`event_type`: `created` | `ready_for_pickup` | `picked_up` | `in_transit` | `out_for_delivery` | `delivered` | `failed_delivery` | `returned`.

**Response 201**: tracking_event creado. Si el evento es terminal de estado, Shipping hace REST a Buyer (`PATCH /api/v1/orders/{id}/seller-groups/{g}/shipping`), a Seller (`PATCH /api/v1/sales-orders/{id}/shipping-status`) y, si es `delivered`, a Payments (`POST /api/v1/internal/shipment-delivered`).

### `GET /api/v1/shipments/{shipmentId}/tracking-events`

**Response 200**

```json
{
  "data": [
    {
      "id": "evt_01H…",
      "event_type": "created",
      "location": null,
      "note": "Etiqueta generada",
      "occurred_at": "2026-04-25T14:40:00Z"
    },
    {
      "id": "evt_02H…",
      "event_type": "picked_up",
      "location": "Caballito, CABA",
      "note": "Retiro OK",
      "occurred_at": "2026-04-26T07:30:00Z"
    },
    {
      "id": "evt_03H…",
      "event_type": "in_transit",
      "location": "CD Avellaneda",
      "note": null,
      "occurred_at": "2026-04-26T10:00:00Z"
    }
  ],
  "pagination": { "total": 3, "page": 1, "limit": 20, "has_more": false }
}
```

### `POST /api/v1/shipments/{shipmentId}/deliver`

Atomicamente: crea el `tracking_event`, sube la prueba y marca `delivered`.

**Request**

```json
{
  "proof_photo_url": "https://cdn.bicimarket.com/proofs/shp_01H….jpg",
  "signature_image_url": "https://cdn.bicimarket.com/proofs/sign_shp_01H….png",
  "note": "Entregado al portero",
  "occurred_at": "2026-04-28T16:20:00Z"
}
```

**Response 200**

```json
{
  "shipment_id": "shp_01H…",
  "status": "delivered",
  "delivered_at": "2026-04-28T16:20:00Z",
  "proof": {
    "photo_url": "https://cdn.bicimarket.com/proofs/shp_01H….jpg",
    "signature_url": "https://cdn.bicimarket.com/proofs/sign_shp_01H….png",
    "note": "Entregado al portero"
  }
}
```

---

## SH5. Operadores logísticos

### `GET /api/v1/logistics-operators`

**Auth**: rol `admin`.
**Response 200**: lista paginada.

### `POST /api/v1/logistics-operators`

**Auth**: rol `admin`.
**Request**

```json
{
  "clerk_user_id": "user_logistics_xyz",
  "full_name": "Juan Pérez",
  "phone": "+5491133333333",
  "email": "juan@logistica.com",
  "document_id": "30123456",
  "vehicle_type": "van",
  "license_plate": "AB123CD"
}
```

**Response 201**: operador creado.

### `GET /api/v1/my/assignments`

**Auth**: rol `logistics`.
Devuelve los envíos asignados al operador logueado.

**Response 200**

```json
{
  "data": [
    {
      "id": "shp_01H…",
      "tracking_number": "TRK-AR-789",
      "status": "ready_for_pickup",
      "pickup_address": {
        "street": "Av. Rivadavia",
        "number": "9000",
        "city": "Caballito",
        "province": "Buenos Aires",
        "postal_code": "C1406",
        "country": "AR"
      },
      "shipping_address": {
        "street": "Av. Corrientes",
        "number": "1234",
        "city": "CABA",
        "province": "Buenos Aires",
        "postal_code": "C1043",
        "country": "AR"
      },
      "weight_grams_total": 14500,
      "packages_count": 1
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "has_more": false }
}
```

### `POST /api/v1/shipments/{shipmentId}/assignments`

**Auth**: rol `admin`.
**Request**: `{ "operator_clerk_user_id": "user_logistics_xyz" }`.
**Response 201**: assignment creado.

### `PATCH /api/v1/shipments/{shipmentId}/assignments/{assignmentId}`

**Request**: `{ "status": "reassigned", "operator_clerk_user_id": "user_other_xyz" }`.
**Response 200**.

---

# Payments App — `https://payments.bicimarket.com` **_Vercel URL — admin UI únicamente_**

Owner: Rocco Paoloni. Clerk: `payments.bicimarket` (**solo admins**: todo JWT debe traer `publicMetadata.admin=true` o se rechaza con 401).

> **Importante**: buyers y sellers no se loguean en Payments App. Las vistas "Mis comprobantes" y "Mis liquidaciones" viven dentro de Buyer App y Seller App respectivamente, que consumen estos endpoints por REST con `X-Service-Token`.

**Auth por tipo de consumidor**

| Consumidor              | Cómo se autentica                                        |
| ----------------------- | -------------------------------------------------------- |
| Admin UI                | `Authorization: Bearer <JWT de Clerk con admin=true>`    |
| Buyer App               | `X-Service-Token` de Buyer                               |
| Seller App              | `X-Service-Token` de Seller                              |
| Shipping App            | `X-Service-Token` de Shipping                            |
| Mercado Pago            | Firma `x-signature` + `MERCADOPAGO_WEBHOOK_SECRET`       |

Los endpoints que aceptan **service token O admin** primero intentan validar el token; si falla, caen en verificación admin.

---

## P1. Pagos

### `POST /api/v1/payments`

Lo llama Buyer App al confirmar el checkout. **Auth**: Buyer token **o** admin.

**Headers**: `Idempotency-Key` obligatorio (UUID).

**Request**

```json
{
  "order_id": "ord_01H…",
  "buyer_clerk_user_id": "user_buyer_abc",
  "buyer_profile_id": "byp_01H…",
  "buyer_email": "test_user_123@testuser.com",
  "amount_cents": 75500000,
  "currency": "ARS",
  "items_summary": [
    {
      "seller_profile_id": "slp_01H…",
      "subtotal_cents": 65000000,
      "shipping_cost_cents": 1200000,
      "order_seller_group_id": "osg_01H…",
      "items": [
        { "product_id": "prd_01H…", "product_name_snapshot": "Bicicleta Trek Marlin 5", "unit_price_cents": 65000000, "quantity": 1 }
      ]
    },
    {
      "seller_profile_id": "slp_02H…",
      "subtotal_cents": 9000000,
      "shipping_cost_cents": 300000,
      "order_seller_group_id": "osg_02H…",
      "items": [
        { "product_id": "prd_02H…", "product_name_snapshot": "Cubierta Continental 29\"", "unit_price_cents": 4500000, "quantity": 2 }
      ]
    }
  ],
  "return_urls": {
    "success": "https://buyer.bicimarket.com/orders/ord_01H…/success",
    "failure": "https://buyer.bicimarket.com/orders/ord_01H…/failure",
    "pending": "https://buyer.bicimarket.com/orders/ord_01H…/pending"
  }
}
```

> `return_urls` es opcional. Si no se envía, MP usa sus defaults; el frontend puede igualmente renderizar el Wallet Brick sin back_urls.
> `items_summary.items` es opcional pero recomendado para que la preferencia de MP muestre los productos correctamente.

**Response 201**

```json
{
  "data": {
    "payment_id": "pay_01H…",
    "checkout_url": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=…",
    "preference_id": "2426354"
  },
  "public_key": "TEST-…"
}
```

El frontend debe usar `checkout_url` para redirigir al checkout de MP, y `public_key` + `preference_id` para renderizar el Wallet SDK.

### `GET /api/v1/payments`

Lista paginada de pagos. **Auth**: Buyer token **o** admin.

**Querystring**: `?orderId=ord_01H…&buyerId=byp_01H…&status=approved&from=2026-04-01&to=2026-04-30&q=…&page=1&limit=20&sort=-created_at`

**Response 200**: `{ data: [<Payment>], pagination: {...} }`

### `GET /api/v1/payments/{paymentId}`

Detalle de un pago. **Auth**: Buyer token **o** admin.

**Response 200**

```json
{
  "data": {
    "id": "pay_01H…",
    "order_id": "ord_01H…",
    "buyer_profile_id": "byp_01H…",
    "buyer_clerk_user_id": "user_buyer_abc",
    "amount_cents": 75500000,
    "currency": "ARS",
    "status": "approved",
    "method": "credit_card",
    "card_last4": "1111",
    "gateway_reference": "mp_payment_987654321",
    "approved_at": "2026-04-25T14:38:00Z",
    "created_at": "2026-04-25T14:33:00Z",
    "updated_at": "2026-04-25T14:38:00Z"
  }
}
```

### `PATCH /api/v1/payments/{paymentId}/confirm`

Admin override para aprobar o rechazar un pago. **Auth**: admin only.

**Request**

```json
{
  "status": "approved",
  "gateway_reference": "mp_987654321",
  "reason": "Pago verificado manualmente"
}
```

`status`: `approved` | `rejected`. **Response 200**: payment actualizado.

### `POST /api/v1/payments/{paymentId}/cancel`

Cancela un pago pendiente. **Auth**: Buyer token **o** admin.

Solo si `status=pending`. **Request** (opcional): `{ "reason": "Cliente canceló" }`.

**Response 200**: payment con `status=cancelled`.

### `POST /api/v1/payments/{paymentId}/refund`

Reembolso desde Seller App o admin. **Auth**: Seller token **o** admin (con `admin=true`). El fallback admin permite al panel de Payments emitir reembolsos directos sin depender de Seller App.

**Request**

```json
{
  "amount_cents": 66200000,
  "reason": "seller_rejected",
  "seller_profile_id": "slp_01H…"
}
```

`reason`: `seller_rejected` | `buyer_cancelled` | `not_delivered` | `manual`.

**Response 200**: refund creado.

```json
{
  "data": {
    "id": "ref_01H…",
    "payment_id": "pay_01H…",
    "amount_cents": 66200000,
    "currency": "ARS",
    "status": "approved",
    "reason": "seller_rejected",
    "gateway_reference": "mp_refund_555",
    "created_at": "2026-04-26T10:00:00Z"
  }
}
```

---

## P2. Reembolsos (CRUD admin)

### `GET /api/v1/refunds`

Lista paginada de reembolsos. **Auth**: admin only.

**Querystring**: `?paymentId=pay_01H…&status=approved&reason=seller_rejected&from=…&to=…&q=…&page=1&limit=20`

**Response 200**: `{ data: [<Refund>], pagination: {...} }`

Cada refund incluye `payment` (order_id, status, amount_cents) y `status_history`.

### `POST /api/v1/refunds`

Crear reembolso manualmente desde admin. **Auth**: admin only.

Procesa el reembolso contra MP. Si es total, pasa el payment a `refunded`.

**Headers**: `Idempotency-Key` opcional.

**Request**

```json
{
  "payment_id": "pay_01H…",
  "amount_cents": 66200000,
  "reason": "manual",
  "seller_profile_id": "slp_01H…"
}
```

**Response 201**: refund creado y procesado.

### `GET /api/v1/refunds/{refundId}`

Detalle de un reembolso. **Auth**: admin only.

Incluye `payment` asociado y `status_history`.

**Response 200**: `{ data: <Refund> }`

### `PATCH /api/v1/refunds/{refundId}`

Actualizar estado de un reembolso manualmente. **Auth**: admin only.

**Request**

```json
{
  "status": "approved",
  "reason": "Corrección manual"
}
```

`status`: `pending` | `approved` | `rejected`. **Response 200**: refund actualizado.

---

## P3. Comprobantes

### `GET /api/v1/receipts`

Lista paginada de comprobantes. **Auth**: Buyer token **o** admin.

**Querystring**: `?paymentId=pay_01H…&page=1&limit=20`

**Response 200**: `{ data: [<Receipt>], pagination: {...} }`

### `POST /api/v1/receipts`

Crear comprobante (Buyer App). **Auth**: Buyer token only (sin fallback admin).

**Request**

```json
{
  "payment_id": "pay_01H…",
  "receipt_number": "0001-00012345",
  "receipt_url": "https://cdn.bicimarket.com/receipts/rec_01H….pdf",
  "amount_cents": 75500000,
  "issued_at": "2026-04-25T14:38:30Z"
}
```

**Response 201**: `{ data: <Receipt> }`

### `GET /api/v1/receipts/{receiptId}`

Detalle de un comprobante. **Auth**: Buyer token **o** admin.

**Response 200**

```json
{
  "data": {
    "id": "rec_01H…",
    "payment_id": "pay_01H…",
    "receipt_number": "0001-00012345",
    "receipt_url": "https://cdn.bicimarket.com/receipts/rec_01H….pdf",
    "amount_cents": 75500000,
    "currency": "ARS",
    "issued_at": "2026-04-25T14:38:30Z"
  }
}
```

---

## P4. Liquidaciones (settlements)

### `GET /api/v1/settlements`

Lista paginada de liquidaciones. **Auth**: Seller token **o** admin.

**Querystring**: `?paymentId=pay_01H…&sellerId=slp_01H…&status=paid&from=2026-04-01&to=2026-04-30&q=…&page=1&limit=20&sort=-created_at`

**Response 200**: `{ data: [<Settlement>], pagination: {...} }`

Cada settlement incluye `payouts` asociados.

### `GET /api/v1/settlements/{settlementId}`

Detalle de una liquidación. **Auth**: Seller token **o** admin.

Incluye `payouts`. Si está pagada, muestra `paid_at`.

**Response 200**: `{ data: <Settlement> }`

### `PATCH /api/v1/settlements`

Marcar una o varias liquidaciones como pagadas manualmente. **Auth**: admin only.

**Request**

```json
{
  "ids": ["set_01H…", "set_02H…"]
}
```

Procesa cada una en una transacción individual. Solo aplica a settlements en `status=pending`.

**Response 200**

```json
{
  "data": [
    { "id": "set_01H…", "status": "marked_paid" },
    { "id": "set_02H…", "status": "skipped", "error": "Settlement is in paid state, not pending" }
  ]
}
```

---

## P5. Payouts

### `GET /api/v1/payouts`

Lista paginada de transferencias. **Auth**: admin only.

**Querystring**: `?settlementId=set_01H…&status=completed&from=…&q=…&page=1&limit=20`

**Response 200**: `{ data: [<Payout>], pagination: {...} }`

### `POST /api/v1/payouts`

Crear una transferencia. **Auth**: admin only.

**Headers**: `Idempotency-Key` opcional.

**Request**: `{ "settlement_id": "set_01H…" }`. Solo si el settlement está `pending`.

**Response 202**

```json
{
  "data": {
    "id": "pyt_01H…",
    "settlement_id": "set_01H…",
    "status": "in_progress",
    "attempts": 0,
    "started_at": "2026-04-28T16:30:00Z"
  }
}
```

### `GET /api/v1/payouts/{payoutId}`

Detalle de una transferencia. **Auth**: admin only.

Incluye `settlement` con datos del pago original.

**Response 200**: `{ data: <Payout> }`

### `PATCH /api/v1/payouts/{payoutId}`

Marcar payout como completado. **Auth**: admin only.

Cambia estado a `completed` y registra `completed_at`.

**Response 200**: `{ data: <Payout> }`

**Error 409** si el payout ya está en `completed` (`ALREADY_PAID`).

---

## P6. Webhook externo de Mercado Pago

### `POST /webhooks/mercadopago`

**Único webhook del sistema**. Lo llama Mercado Pago cuando cambia un pago. Validar firma con `x-signature` header y `MERCADOPAGO_WEBHOOK_SECRET`.

**Request (ejemplo `payment.updated`)**

```json
{
  "id": 12345678,
  "live_mode": true,
  "type": "payment",
  "date_created": "2026-04-25T14:38:00Z",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.updated",
  "data": {
    "id": "987654321"
  }
}
```

**Response 200**: `{ "ok": true }`.

Tras recibir, Payments hace `GET /v1/payments/{id}` a MP para resolver el estado real, actualiza su `payment` y dispara llamadas REST salientes a Buyer (`PATCH /orders/{id}/status`) y a Seller (`POST /sales-orders` por cada seller).

---

## P7. Endpoint interno (solo entre apps)

### `POST /api/v1/internal/shipment-delivered`

Lo llama Shipping App cuando un envío se entrega. **Auth**: Shipping token only.

**Request**

```json
{
  "shipment_id": "shp_01H…",
  "order_id": "ord_01H…",
  "order_seller_group_id": "osg_01H…",
  "sales_order_id": "sor_01H…",
  "seller_profile_id": "slp_01H…",
  "delivered_at": "2026-04-28T16:20:00Z"
}
```

**Response 200**: `{ "received": true, "settlement_id": "set_01H…" }`.

No documentado en Swagger (uso interno).

---

# Integración Mercado Pago

## Configuración por entorno

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR_…
MERCADOPAGO_PUBLIC_KEY=APP_USR_…
MERCADOPAGO_WEBHOOK_SECRET=…
MERCADOPAGO_WEBHOOK_URL=https://payments.bicimarket.com/webhooks/mercadopago
```

## Endpoints de Mercado Pago consumidos

| Método | Endpoint                            | Para qué                                                            |
| ------ | ----------------------------------- | ------------------------------------------------------------------- |
| `POST` | `/checkout/preferences`             | Crear preferencia de pago (devuelve `init_point` = `checkout_url`). |
| `GET`  | `/v1/payments/{payment_id}`         | Resolver estado real tras webhook.                                  |
| `POST` | `/v1/payments/{payment_id}/refunds` | Reembolso.                                                          |

## Tarjetas de prueba

- Aprobada: `4111 1111 1111 1111`
- Rechazada: `4000 0000 0000 0002`
- CVV: cualquier `123`. Vencimiento: `12/30`.

---

# Notificaciones inter-apps (REST clásico)

No usamos webhooks entre nuestras apps. Las notificaciones de cambio de estado son **llamadas REST normales** (`POST` o `PATCH`) que un backend hace contra otro, autenticadas con `X-Service-Token`. El receptor responde 2xx y listo. Si falla, el emisor reintenta hasta 3 veces (1s/3s/9s).

Headers de toda notificación inter-app:

```
POST /endpoint-de-la-app-destino
Content-Type: application/json
X-Service-Token: <secret del par origen→destino>
X-Request-Id: <uuid>
User-Agent: bicimarket-<app-origen>/1.0
```

El body es el del endpoint receptor (ver cada sección de este doc), no un envelope genérico tipo "event".

### Mapa de notificaciones

| Disparador                                 | Origen   | Destino  | Llamada REST                                           |
| ------------------------------------------ | -------- | -------- | ------------------------------------------------------ |
| Pago aprobado / rechazado / refunded       | Payments | Buyer    | `PATCH /api/v1/orders/{id}/status`                     |
| Pago aprobado → crear sub-orden por seller | Payments | Seller   | `POST /api/v1/sales-orders`                            |
| Liquidación settled                        | Payments | Seller   | `PATCH /api/v1/sales-orders/{id}/payment-status`       |
| Cambio de envío                            | Shipping | Buyer    | `PATCH /api/v1/orders/{id}/seller-groups/{g}/shipping` |
| Cambio de envío                            | Shipping | Seller   | `PATCH /api/v1/sales-orders/{id}/shipping-status`      |
| Envío entregado → gatilla liquidación      | Shipping | Payments | `POST /api/v1/internal/shipment-delivered`             |

### Único webhook real del sistema

| Evento            | Origen                       | Destino  | Endpoint                     |
| ----------------- | ---------------------------- | -------- | ---------------------------- |
| `payment.updated` | **Mercado Pago** _(externo)_ | Payments | `POST /webhooks/mercadopago` |

---

# Secretos y service tokens

Un service token por cada par origen→destino que necesite hacer llamadas REST inter-apps. Cada app guarda solo los secretos que usa.

```env
# Service tokens (REST inter-apps)
BUYER_TO_SELLER_SERVICE_TOKEN=…
BUYER_TO_SHIPPING_SERVICE_TOKEN=…
BUYER_TO_PAYMENTS_SERVICE_TOKEN=…
SELLER_TO_SHIPPING_SERVICE_TOKEN=…
SELLER_TO_PAYMENTS_SERVICE_TOKEN=…
PAYMENTS_TO_BUYER_SERVICE_TOKEN=…
PAYMENTS_TO_SELLER_SERVICE_TOKEN=…
SHIPPING_TO_BUYER_SERVICE_TOKEN=…
SHIPPING_TO_SELLER_SERVICE_TOKEN=…
SHIPPING_TO_PAYMENTS_SERVICE_TOKEN=…

# Único webhook externo
MERCADOPAGO_WEBHOOK_SECRET=…
```

---

## Apéndice: diferencias con `old-docs/` (Payments App)

Este apéndice detalla los cambios entre `old-docs/03-apis.md` y la versión actual en la sección **Payments App** (P1–P8). No se analizan otras apps.

### A. Estructura de Payments App

| Aspecto | old-docs | actual | Por qué en Payments |
|---------|----------|--------|---------------------|
| Secciones | P1 (Pagos), P2 (Comprobantes), P3 (Liquidaciones), P4 (Webhook) | P1 (Pagos), P2 (Reembolsos CRUD), P3 (Comprobantes), P4 (Liquidaciones), P5 (Payouts), P6 (Webhook), P7 (Interno), P8 (Notificaciones) | Se agregaron CRUD admin completos para refunds, payouts y settlements al descubrir que la UI admin necesitaba gestión manual. |
| Auth header | No documentaba el patrón service-token-OR-admin | Tabla explícita con fila "Los endpoints que aceptan service token O admin primero intentan validar el token; si falla, caen en verificación admin" | El código implementa este patrón en varios endpoints (refund, list payments) y necesitaba documentarse. |

### B. P1 — Pagos

#### B.1 `POST /api/v1/payments`

| Aspecto | old-docs | actual | Por qué en Payments |
|---------|----------|--------|---------------------|
| Auth | No especificado explícitamente | Buyer token **o** admin | Buyer App llama con service token; admin puede crear pagos desde el panel. |
| `buyer_email` en request | No existía | Campo `buyer_email` opcional | Se pasa a MP como `payer.email` en la preferencia. No se persiste en DB. |
| `items_summary[].items` | No existía | Array anidado `items: [{ product_id, product_name_snapshot, unit_price_cents, quantity }]` | Alimenta la preferencia de MP con productos reales en vez de un ítem genérico. |
| `items_summary[].order_seller_group_id` | No existía | `order_seller_group_id` por seller | Necesario para trazar settlements hasta el grupo de la orden cuando llega `shipment-delivered`. |
| `return_urls` | Requerido | Opcional (`z.optional()`) | Wallet Brick no requiere `back_urls`. |
| Response envelope | Plano: `{ id, order_id, amount_cents, checkout_url, ... }` | `{ data: { payment_id, checkout_url, preference_id }, public_key }` | Consistencia con estándar de paginación (§0.4). `preference_id` + `public_key` necesarios para Wallet Brick. `payment_id` se usa en vez de `id` para claridad. |

#### B.2 `GET /api/v1/payments` (listado)

| old-docs | actual |
|----------|--------|
| No existía | `GET /api/v1/payments?orderId=...&buyerId=...&status=...&from=...&to=...&q=...&page=1&limit=20` |

Por qué: necesario para dashboard admin y para que Buyer App consuma sus comprobantes.

#### B.3 `GET /api/v1/payments/{paymentId}`

| old-docs | actual |
|----------|--------|
| Response plano | Response `{ data: { ... } }` |

#### B.4 `POST /api/v1/payments/{paymentId}/refund`

| Aspecto | old-docs | actual | Por qué en Payments |
|---------|----------|--------|---------------------|
| Auth | Sin auth especificada | Seller token **o** admin (fallback) | Se agregó fallback admin porque el panel de Payments necesita poder reembolsar sin depender de Seller App para escenarios de soporte. Código: `src/app/api/v1/payments/[paymentId]/refund/route.ts:16-19`. |
| Request body | `{ amount_cents, reason, seller_profile_id }` | Igual + `Idempotency-Key` opcional (no estaba documentado) | Idempotencia permanente vía columna `@unique` en Refund. |

#### B.5 `PATCH /api/v1/payments/{paymentId}/confirm`

Sin cambios entre old-docs y actual.

### C. P2 — Reembolsos (CRUD admin) — NUEVA SECCIÓN

| Endpoint | old-docs | actual |
|----------|----------|--------|
| `GET /api/v1/refunds` | No existía | Lista paginada con filtros |
| `POST /api/v1/refunds` | No existía | Crear reembolso manual (admin) |
| `GET /api/v1/refunds/{id}` | No existía | Detalle + status_history |
| `PATCH /api/v1/refunds/{id}` | No existía | Actualizar estado manual |

Por qué: el dashboard admin necesita crear y trackear reembolsos sin depender de Seller App. Los refunds antes solo existían como sub-recurso de payment (`POST /payments/{id}/refund`).

### D. P3 — Comprobantes

| Endpoint | old-docs | actual | Por qué en Payments |
|----------|----------|--------|---------------------|
| `GET /api/v1/receipts/{id}` | Sí, response plano | Response `{ data: { ... } }` | Consistencia. |
| `GET /api/v1/receipts` | No existía | Lista paginada con `?paymentId=X` | Buyer App necesita listar comprobantes. |
| `POST /api/v1/receipts` | No existía | Crear comprobante (Buyer token only) | Buyer App genera el comprobante tras pago aprobado. |

### E. P4 — Liquidaciones (settlements)

| Endpoint | old-docs | actual | Por qué en Payments |
|----------|----------|--------|---------------------|
| `POST /api/v1/settlements` (interno, documentado por simetría) | Sí | **Eliminado** | El settlement se crea automáticamente al recibir `POST /api/v1/internal/shipment-delivered`. No hay endpoint público POST para settlements. |
| `GET /api/v1/settlements/{id}` | Response plano | Response `{ data: { ... } }` | Consistencia. |
| `GET /api/v1/settlements?sellerId=X` | Sin paginación estándar | Con paginación estándar `{ data: [...], pagination: { ... } }` | Consistencia. |
| `PATCH /api/v1/settlements` (batch mark paid) | No existía | Marcar uno o varios settlements como `paid` | Reemplaza el flujo de `POST /v1/transfers` de MP. Admin marca manualmente. |
| Incluye `payouts` | No | Cada settlement incluye `payouts` asociados | Trazabilidad de intentos de transferencia. |

### F. P5 — Payouts (CRUD admin) — NUEVA SECCIÓN

| Endpoint | old-docs | actual |
|----------|----------|--------|
| `GET /api/v1/payouts` | No existía | Lista paginada con filtros |
| `POST /api/v1/payouts` | `POST /api/v1/payouts` existía (dentro de P3) | Igual, ahora en sección propia |
| `GET /api/v1/payouts/{id}` | No existía | Detalle con settlement asociado |
| `PATCH /api/v1/payouts/{id}` | No existía | Marcar como completado |

### G. P6 — Webhook MP

| old-docs | actual |
|----------|--------|
| Response `{ "received": true }` | Response `{ "ok": true }` |

Cambio menor de naming, sin impacto funcional.

### H. P7 — Interno (`shipment-delivered`)

Sin cambios entre old-docs y actual.

### J. Integración MP (final del doc)

| Endpoint MP | old-docs | actual | Por qué en Payments |
|-------------|----------|--------|---------------------|
| `POST /v1/payments` | Sí | **Eliminado** | No se usa — Payments usa Checkout Pro vía `/checkout/preferences`. |
| `POST /v1/transfers` | Sí | **Eliminado** | No implementado. Settlements se pagan manualmente. |
| `GET /v1/transfers/{id}` | Sí | **Eliminado** | No implementado. |

### K. Endpoints renombrados (otras apps, afectan cómo Payments consume)

| old-docs | actual | Afecta a Payments |
|----------|--------|-------------------|
| `GET /api/v1/buyer-profile/me` | `GET /api/v1/buyer/profile` | Payments no consume este endpoint directamente. |
| `PUT /api/v1/buyer-profile/me` | `PATCH /api/v1/buyer/profile` | Payments no consume. |
| `GET /api/v1/addresses` | `GET /api/v1/buyer/addresses` | Payments no consume. |
| `POST /api/v1/cart/items` | `POST /api/v1/buyer/cart` | Payments no consume. |
| `POST /api/v1/orders` | `POST /api/v1/buyer/checkout` | Payments no consume. |
| `PATCH /api/v1/orders/{id}/status` (server-to-server) | `PATCH /api/v1/orders/{id}` (cambia de path pero mismo rol) | Payments llama a este endpoint — sin cambio funcional. |
| `PUT /api/v1/addresses/{id}` | `PATCH /api/v1/buyer/addresses/{id}` | Payments no consume. |
| `PATCH /api/v1/cart/items/{id}` | `PATCH /api/v1/buyer/cart/{id}` | Payments no consume. |
| `GET /api/v1/favorites` | `GET /api/v1/buyer/favorites` | Payments no consume. |

### L. Sin cambios en Payments

- `POST /api/v1/payments/{paymentId}/cancel` — idéntico contenido. 
- `POST /api/v1/internal/shipment-delivered` — idéntico.
- Mapa de notificaciones inter-app — idéntico.
- Secretos y service tokens — idéntico.