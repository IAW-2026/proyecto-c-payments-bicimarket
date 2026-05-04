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

### `GET /api/v1/buyer-profile/me`

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

### `PUT /api/v1/buyer-profile/me`

Crea o actualiza el perfil. Idempotente.

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

### `GET /api/v1/addresses`

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

### `POST /api/v1/addresses`

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

### `PUT /api/v1/addresses/{addressId}`

**Request**: idéntico al POST.
**Response 200**: address actualizado.

### `DELETE /api/v1/addresses/{addressId}`

**Response 204** sin body.

---

## B3. Carrito

### `GET /api/v1/cart`

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

### `POST /api/v1/cart/items`

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

### `PATCH /api/v1/cart/items/{itemId}`

**Request**

```json
{ "quantity": 3 }
```

**Response 200**: el cart_item actualizado.

### `DELETE /api/v1/cart/items/{itemId}`

**Response 204**.

---

## B4. Favoritos

### `GET /api/v1/favorites`

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

### `POST /api/v1/favorites`

**Request**: `{ "product_id": "prd_01H…" }`. **Response 201**.

### `DELETE /api/v1/favorites/{favoriteId}`

**Response 204**.

---

## B5. Órdenes (fuente de verdad de `order_id`)

### `POST /api/v1/orders`

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

### `GET /api/v1/orders/{orderId}`

**Response 200**: misma forma que el POST.

### `GET /api/v1/orders?buyerId={buyerId}&status=paid&page=1&limit=20`

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

### `PATCH /api/v1/orders/{orderId}/status` (server-to-server)

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

### `POST /api/v1/orders/{orderId}/cancel`

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

> **Importante**: buyers y sellers no se loguean en Payments App. Las vistas "Mis comprobantes" y "Mis liquidaciones" viven dentro de Buyer App y Seller App respectivamente, que consumen estos endpoints por REST con `X-Service-Token`. Los endpoints listados acá son: (a) los server-to-server que llaman las otras apps, (b) los administrativos que usa la admin UI con JWT-Payments + admin flag.

## P1. Pagos

### `POST /api/v1/payments`

Lo llama Buyer App al confirmar el checkout. **Idempotency-Key obligatorio**.

**Request**

```json
{
  "order_id": "ord_01H…",
  "buyer_clerk_user_id": "user_buyer_abc",
  "buyer_profile_id": "byp_01H…",
  "amount_cents": 75500000,
  "currency": "ARS",
  "items_summary": [
    {
      "seller_profile_id": "slp_01H…",
      "subtotal_cents": 65000000,
      "shipping_cost_cents": 1200000
    },
    {
      "seller_profile_id": "slp_02H…",
      "subtotal_cents": 9000000,
      "shipping_cost_cents": 300000
    }
  ],
  "return_urls": {
    "success": "https://buyer.bicimarket.com/orders/ord_01H…/success",
    "failure": "https://buyer.bicimarket.com/orders/ord_01H…/failure",
    "pending": "https://buyer.bicimarket.com/orders/ord_01H…/pending"
  }
}
```

**Response 201**

```json
{
  "id": "pay_01H…",
  "order_id": "ord_01H…",
  "amount_cents": 75500000,
  "currency": "ARS",
  "status": "pending",
  "method": null,
  "checkout_url": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=…",
  "gateway_reference": "mp_pref_2426354",
  "created_at": "2026-04-25T14:33:00Z"
}
```

### `GET /api/v1/payments/{paymentId}`

**Response 200**

```json
{
  "id": "pay_01H…",
  "order_id": "ord_01H…",
  "buyer_clerk_user_id": "user_buyer_abc",
  "amount_cents": 75500000,
  "currency": "ARS",
  "status": "approved",
  "method": "credit_card",
  "card_last4": "1111",
  "gateway_reference": "mp_payment_987654321",
  "approved_at": "2026-04-25T14:38:00Z",
  "created_at": "2026-04-25T14:33:00Z"
}
```

### `GET /api/v1/payments?orderId=ord_01H…`

**Response 200**: lista paginada.

### `PATCH /api/v1/payments/{paymentId}/confirm` (server-to-server, admin override)

**Request**: `{ "status": "approved", "gateway_reference": "mp_…" }`.
**Response 200**.

### `POST /api/v1/payments/{paymentId}/refund`

**Request**

```json
{
  "amount_cents": 66200000,
  "reason": "seller_rejected",
  "seller_profile_id": "slp_01H…"
}
```

`reason`: `seller_rejected` | `buyer_cancelled` | `not_delivered` | `manual`.

**Response 200**

```json
{
  "id": "ref_01H…",
  "payment_id": "pay_01H…",
  "amount_cents": 66200000,
  "currency": "ARS",
  "status": "approved",
  "gateway_reference": "mp_refund_555",
  "created_at": "2026-04-26T10:00:00Z"
}
```

### `POST /api/v1/payments/{paymentId}/cancel`

Solo si `status=pending`. **Response 200**: payment con `status=cancelled`.

---

## P2. Comprobantes

### `GET /api/v1/receipts/{receiptId}`

**Response 200**

```json
{
  "id": "rec_01H…",
  "payment_id": "pay_01H…",
  "receipt_number": "0001-00012345",
  "receipt_url": "https://cdn.bicimarket.com/receipts/rec_01H….pdf",
  "amount_cents": 75500000,
  "currency": "ARS",
  "issued_at": "2026-04-25T14:38:30Z"
}
```

---

## P3. Liquidaciones (settlements)

### `POST /api/v1/settlements` (server-to-server, internal trigger)

Lo dispara Payments App internamente al recibir `shipment-delivered`. Documentado por simetría.

**Request**

```json
{
  "order_id": "ord_01H…",
  "order_seller_group_id": "osg_01H…",
  "seller_profile_id": "slp_01H…",
  "payment_id": "pay_01H…",
  "gross_amount_cents": 66200000,
  "fee_amount_cents": 6620000,
  "net_amount_cents": 59580000,
  "currency": "ARS"
}
```

**Response 201**

```json
{
  "id": "set_01H…",
  "order_id": "ord_01H…",
  "seller_profile_id": "slp_01H…",
  "gross_amount_cents": 66200000,
  "fee_amount_cents": 6620000,
  "net_amount_cents": 59580000,
  "currency": "ARS",
  "status": "pending",
  "created_at": "2026-04-28T16:25:00Z"
}
```

### `GET /api/v1/settlements/{settlementId}`

**Response 200**: igual al POST + `paid_at` y `transfer_id` si ya está paga.

### `GET /api/v1/settlements?sellerId=slp_01H…&status=paid&from=2026-04-01&to=2026-04-30`

**Response 200**: lista paginada.

### `POST /api/v1/payouts`

Dispara la transferencia real a Mercado Pago. Lo invoca un cron interno o un admin.

**Request**: `{ "settlement_id": "set_01H…" }`.
**Response 202**

```json
{
  "id": "pyt_01H…",
  "settlement_id": "set_01H…",
  "status": "in_progress",
  "transfer_id": null,
  "started_at": "2026-04-28T16:30:00Z"
}
```

---

## P4. Webhook externo de Mercado Pago + endpoint interno

### `POST /webhooks/mercadopago`

**Único webhook del sistema**. Lo llama Mercado Pago cuando cambia un pago. Validar firma con `MERCADOPAGO_WEBHOOK_SECRET`.

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

**Response 200**: `{ "received": true }`.

Tras recibir, Payments hace `GET /v1/payments/{id}` a MP para resolver el estado real, actualiza su `payment` y dispara las llamadas REST salientes a Buyer (`PATCH /orders/{id}/status`) y a Seller (`POST /sales-orders` por cada seller).

### `POST /api/v1/internal/shipment-delivered` (lo llama Shipping)

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
| `POST` | `/v1/payments`                      | Crear pago directo (cuando se usa SDK frontend).                    |
| `GET`  | `/v1/payments/{payment_id}`         | Resolver estado real tras webhook.                                  |
| `POST` | `/v1/payments/{payment_id}/refunds` | Reembolso.                                                          |
| `POST` | `/v1/transfers`                     | Transferir net al `collector_id` del seller.                        |
| `GET`  | `/v1/transfers/{transfer_id}`       | Estado de transferencia.                                            |

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
