# 1.4 — Modelo de Datos por Aplicación

> **Tipo C — Marketplace · BiciMarket**

---

> **Restricción del proyecto — stock ilimitado**: ninguna DB modela inventario. Seller App no tiene campo `stock` en `products` ni tabla `inventory_movements`. Toda publicación `active` se considera disponible. Ver `01-descripcion.md §1.1`.

## 0. Reglas comunes a todas las DB

- **Motor**: PostgreSQL 16+, una instancia por app (ideal: bases separadas en clusters separados; mínimo aceptable: bases separadas en el mismo cluster con usuarios distintos).
- **ORM**: Prisma.
- **IDs**: `String @id @default(cuid())` en schema, sobrescrito via extensión de Prisma (`$extends`) que genera IDs con prefijo de recurso (`pay_`, `set_`, `pyt_`, `ref_`, `rec_`, etc.) en cada `create`. Ver `src/lib/id-generator.ts` y `src/lib/prisma.ts`.
- **Timestamps**: `created_at @default(now())` y `updated_at @updatedAt` en toda tabla.
- **Soft deletes**: `deleted_at DateTime?` en entidades con historial relevante (productos, perfiles).
- **Snapshots**: cuando un campo viene de otra app (precio, dirección, nombre del producto), se guarda con sufijo `_snapshot` y **nunca se actualiza** una vez guardado.
- **Referencias cruzadas**: los IDs de otras apps se guardan como **string opaco**, sin foreign key. La integridad la mantiene el ciclo de vida del negocio.
- **Auditoría**: cualquier cambio de estado relevante (`order.status`, `shipment.status`, `payment.status`, `settlement.status`) deja registro en una tabla `*_status_history` (ver §6).
- **Identidad**: todas las apps comparten el mismo proyecto de Clerk. El `clerk_user_id` es el mismo para un usuario dado sin importar en qué app lo lea. Un humano puede tener roles en múltiples apps (comprador y vendedor, por ejemplo) usando la misma cuenta de Clerk; el rol se determina por `publicMetadata`.

---

## 1. Buyer App — DB `buyer_db`

Fuente de verdad de: `order_id`, carrito, direcciones del comprador, perfil de comprador.

### 1.1 Tablas

#### `buyer_profiles`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `byp_…` |
| `clerk_user_id` | string unique | viene del Clerk-Buyer |
| `full_name` | string | snapshot del nombre, sincronizado desde Clerk en el primer login |
| `email` | string unique | idem |
| `phone` | string? | |
| `default_shipping_address_id` | string? FK → addresses.id | |
| `created_at` / `updated_at` / `deleted_at` | timestamps | |

#### `addresses`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `adr_…` |
| `buyer_profile_id` | string FK → buyer_profiles.id (cascade) | |
| `alias` | string | "Casa", "Trabajo" |
| `street`, `number`, `apartment`, `city`, `province`, `postal_code`, `country` | string | |
| `is_default` | boolean | |
| `created_at` / `updated_at` | timestamps | |

#### `carts`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `crt_…` |
| `buyer_profile_id` | string FK unique | un cart activo por buyer |
| `status` | enum `active` \| `converted` | |
| `created_at` / `updated_at` | timestamps | |

#### `cart_items`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `cit_…` |
| `cart_id` | string FK | |
| `product_id` | string | ref opaca a Seller App |
| `seller_profile_id` | string | snapshot al momento de agregar |
| `product_name_snapshot` | string | |
| `unit_price_cents` | int | snapshot |
| `currency` | string | |
| `quantity` | int | |
| `weight_grams_snapshot` | int | snapshot, usado para cotizar |
| `added_at` | timestamp | |

Índice: `(cart_id, product_id)` unique.

#### `favorite_items`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `fav_…` |
| `buyer_profile_id` | string FK | |
| `product_id` | string | ref opaca |
| `added_at` | timestamp | |

Índice: `(buyer_profile_id, product_id)` unique.

#### `orders` fuente de verdad
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `ord_…` |
| `buyer_profile_id` | string FK | |
| `payment_id` | string? | ref a Payments App, se setea al iniciar pago |
| `status` | enum (ver §6.1) | `pending_payment` por defecto |
| `items_total_cents` | int | suma de items |
| `shipping_total_cents` | int | suma de costos de envío |
| `total_cents` | int | items + envíos |
| `currency` | string | |
| `shipping_address_snapshot` | json | snapshot completo de la dirección |
| `notes` | string? | |
| `created_at` / `updated_at` | timestamps | |

#### `order_seller_groups`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `osg_…` |
| `order_id` | string FK | |
| `seller_profile_id` | string | ref opaca a Seller App |
| `items_subtotal_cents` | int | |
| `shipping_cost_cents` | int | |
| `shipping_quote_id` | string? | ref opaca a Shipping App |
| `shipment_id` | string? | ref opaca a Shipping App, se setea cuando Seller crea el envío |
| `weight_grams_total` | int | snapshot del peso total cotizado |
| `status` | enum `pending` \| `preparing` \| `ready_to_ship` \| `in_transit` \| `delivered` \| `cancelled` \| `refunded` | |
| `shipping_status` | enum (ver §6.4) | espejo del shipment, sincronizado vía `PATCH` REST que dispara Shipping |
| `created_at` / `updated_at` | timestamps | |

Índice: `(order_id, seller_profile_id)` unique.

#### `order_items`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `oit_…` |
| `order_id` | string FK | |
| `seller_group_id` | string FK | |
| `product_id` | string | ref opaca |
| `product_name_snapshot` | string | |
| `unit_price_cents` | int | |
| `quantity` | int | |
| `weight_grams_snapshot` | int | |

#### `order_status_history` (auditoría)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | |
| `order_id` | string FK | |
| `from_status` | string | |
| `to_status` | string | |
| `source` | string | `payments` \| `shipping` \| `buyer` \| `admin` |
| `payload` | json? | |
| `occurred_at` | timestamp | |

### 1.2 Diagrama
```mermaid
erDiagram
    buyer_profiles ||--o{ addresses : has
    buyer_profiles ||--|| carts : owns
    carts ||--o{ cart_items : contains
    buyer_profiles ||--o{ favorite_items : favs
    buyer_profiles ||--o{ orders : places
    orders ||--o{ order_seller_groups : "split by seller"
    order_seller_groups ||--o{ order_items : contains
    orders ||--o{ order_status_history : "audited"
```

---

## 2. Seller App — DB `seller_db`

Fuente de verdad de: catálogo (`product`, precio, peso), perfil de vendedor, sub-órdenes (`sales_order`). **Sin stock** (restricción del proyecto: stock ilimitado).

### 2.1 Tablas

#### `seller_profiles`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `slp_…` |
| `clerk_user_id` | string unique | Clerk-Seller |
| `legal_name` | string | |
| `display_name` | string | |
| `tax_id` | string | CUIT |
| `tax_condition` | enum `monotributo` \| `responsable_inscripto` \| `consumidor_final` | |
| `bank_account_reference` | string | `mp_collector_id` o referencia bancaria |
| `pickup_address` | json | |
| `verification_status` | enum `pending_review` \| `verified` \| `suspended` | |
| `created_at` / `updated_at` | timestamps | |

#### `products`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `prd_…` |
| `seller_profile_id` | string FK | |
| `title` | string | |
| `description` | text | |
| `brand` | string | |
| `model` | string | |
| `category` | enum `mtb` \| `road` \| `urban` \| `kids` \| `bmx` \| `parts` \| `accessories` \| `indumentaria` | |
| `condition` | enum `new` \| `used_like_new` \| `used_good` \| `used_fair` | |
| `price_cents` | int | |
| `currency` | string | |
| `weight_grams` | int | 🆕 obligatorio para activar |
| `length_cm`, `width_cm`, `height_cm` | int | 🆕 dimensiones |
| `status` | enum `draft` \| `active` \| `paused` \| `archived` | |
| `created_at` / `updated_at` / `deleted_at` | timestamps | |

Índices: `(status, category)`, `(seller_profile_id)`, `(brand, model)`, full-text en `title`.

#### `product_images`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `img_…` |
| `product_id` | string FK | |
| `url` | string | |
| `position` | int | orden de display |

Índice: `(product_id, position)` unique.

> **No hay tabla `inventory_movements`**: por restricción del proyecto el stock es ilimitado, así que Seller App no audita movimientos de inventario.

#### `sales_orders`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `sor_…` |
| `order_id` | string | ref opaca a Buyer App |
| `order_seller_group_id` | string | ref opaca |
| `seller_profile_id` | string FK | |
| `buyer_profile_id` | string | ref opaca |
| `buyer_clerk_user_id` | string | viene de Buyer Clerk, sirve para mostrar al vendedor |
| `payment_id` | string | ref opaca |
| `payment_status` | enum `pending` \| `paid` \| `refunded` \| `settled` | |
| `fulfillment_status` | enum `pending` \| `accepted` \| `rejected` \| `preparing` \| `ready_to_ship` \| `handed_over` \| `delivered` \| `cancelled` | |
| `shipping_status` | enum (espejo de shipment) | |
| `shipment_id` | string? | |
| `items_subtotal_cents` | int | |
| `shipping_cost_cents` | int | |
| `total_cents` | int | |
| `currency` | string | |
| `shipping_address_snapshot` | json | |
| `created_at` / `updated_at` | timestamps | |

Índice: `(seller_profile_id, fulfillment_status)`.

#### `sales_order_items`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `soi_…` |
| `sales_order_id` | string FK | |
| `product_id` | string FK | |
| `product_name_snapshot` | string | |
| `unit_price_cents` | int | |
| `quantity` | int | |

#### `sales_order_status_history` (auditoría)
Igual estructura que `order_status_history`.

### 2.2 Diagrama
```mermaid
erDiagram
    seller_profiles ||--o{ products : owns
    products ||--o{ product_images : has
    seller_profiles ||--o{ sales_orders : receives
    sales_orders ||--o{ sales_order_items : contains
    sales_orders ||--o{ sales_order_status_history : "audited"
```

---

## 3. Shipping App — DB `shipping_db`

Fuente de verdad de: `shipment_id`, paquetes, eventos de tracking, operadores logísticos, cotizaciones.

### 3.1 Tablas

#### `logistics_operators`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `lop_…` |
| `clerk_user_id` | string unique | Clerk-Shipping |
| `full_name` | string | |
| `phone` | string | |
| `email` | string | |
| `document_id` | string | |
| `vehicle_type` | enum `motorcycle` \| `car` \| `van` \| `truck` | |
| `license_plate` | string | |
| `status` | enum `active` \| `inactive` \| `suspended` | |
| `created_at` / `updated_at` | timestamps | |

#### `shipping_rates` (config)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `rat_…` |
| `carrier` | string | `andreani` \| `oca` \| `propio` |
| `service_level` | enum `standard` \| `express` \| `same_day` | |
| `from_postal_prefix` | string | ej. `C14` |
| `to_postal_prefix` | string | |
| `weight_grams_min` | int | |
| `weight_grams_max` | int | |
| `cost_cents` | int | |
| `estimated_days_min` | int | |
| `estimated_days_max` | int | |
| `active` | boolean | |

#### `shipping_quotes`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `qte_…` |
| `seller_profile_id` | string | ref opaca |
| `from_address_snapshot` | json | |
| `to_address_snapshot` | json | |
| `service_level` | enum | |
| `carrier` | string | |
| `cost_cents` | int | |
| `weight_grams_total` | int | |
| `packages_snapshot` | json | array de paquetes con peso/dimensiones |
| `idempotency_key` | string? unique | |
| `expires_at` | timestamp | now + 60 min (calculado en aplicación) |
| `created_at` | timestamp | |

#### `shipment_groups` (ADR-006 — agrupación del pedido completo)
Una orden del comprador con N vendedores genera N `shipments` (uno por seller). El `shipment_group` (1 por `order_id`) los agrupa y es dueño del tracking GLOBAL del pedido — el único que ve el comprador. Siempre existe un grupo, tenga 1 o N vendedores.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `grp_…` |
| `order_id` | string unique | ref opaca a Buyer; 1 grupo por orden |
| `buyer_profile_id` | string | |
| `tracking_number` | string unique | tracking GLOBAL del pedido (`"BMK-" + random10`). El único que ve el comprador. |
| `status` | enum (ver §6.4) | rollup persistido de los N shipments (se recomputa en cada cambio) |
| `service_level` | enum | |
| `shipping_address_snapshot` | json | |
| `origins_count` | int | cantidad de vendedores del pedido |
| `assigned_operator_clerk_user_id` | string? | operador dueño del pedido entero. null = disponible |
| `created_at` / `updated_at` | timestamps | |

Índices: `(buyer_profile_id)`, `(status)`. `order_id` y `tracking_number` son unique.

#### `shipments`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `shp_…` |
| `order_id` | string | ref opaca a Buyer |
| `order_seller_group_id` | string | ref opaca a Buyer |
| `sales_order_id` | string | ref opaca a Seller |
| `seller_profile_id` | string | |
| `buyer_profile_id` | string | |
| `shipment_group_id` | string FK → shipment_groups | ADR-006: pedido al que pertenece. onDelete cascade. |
| `shipping_quote_id` | string FK? → shipping_quotes | |
| `carrier` | string | |
| `service_level` | enum | |
| `tracking_number` | string unique | tracking INDIVIDUAL del pickup (`"TRK-AR-" + random8`). Lo ve solo el vendedor de ese envío. |
| `label_url` | string | |
| `status` | enum (ver §6.4) | |
| `weight_grams_total` | int | |
| `cost_cents` | int | |
| `currency` | string | |
| `shipping_address_snapshot` | json | |
| `pickup_address_snapshot` | json | |
| `idempotency_key` | string? unique | |
| `shipped_at` / `delivered_at` | timestamps? | |
| `created_at` / `updated_at` | timestamps | |

Índices: `(order_id)`, `(order_seller_group_id)`, `(sales_order_id)`, `(seller_profile_id)`, `(buyer_profile_id)`, `(shipment_group_id)`, `(tracking_number)`, `(status)`, `(created_at)`.

#### `packages`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `pkg_…` |
| `shipment_id` | string FK | |
| `weight_grams` | int | |
| `length_cm`, `width_cm`, `height_cm` | int | |
| `description` | string? | |
| `label_url` | string? | etiqueta individual del paquete |

#### `tracking_events`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `evt_…` |
| `shipment_id` | string FK | |
| `event_type` | enum (ver §6.4) | |
| `location` | string? | |
| `note` | string? | |
| `occurred_at` | timestamp | |
| `created_at` | timestamp | |

#### `delivery_assignments`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `dla_…` |
| `shipment_group_id` | string? FK → shipment_groups | nivel real de asignación (el pedido completo) |
| `shipment_id` | string? FK | nullable/legacy (asignaciones históricas por-envío) |
| `operator_clerk_user_id` | string | |
| `status` | enum `assigned` \| `accepted` \| `picked_up` \| `delivered` \| `reassigned` \| `cancelled` | |
| `assigned_at` | timestamp | |
| `completed_at` | timestamp? | |

#### `delivery_proofs`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `prf_…` |
| `shipment_id` | string FK | |
| `proof_photo_url` | string | URL o `data:image/...;base64,…` |
| `signature_image_url` | string? | |
| `note` | string? | |
| `delivered_at` | timestamp | |

#### `shipment_status_history` (auditoría)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `ssh_…` |
| `shipment_id` | string FK | |
| `from_status` | string | |
| `to_status` | string | |
| `source` | string | `logistics` \| `admin` \| `system` |
| `payload` | json? | |
| `occurred_at` | timestamp | |

### 3.2 Diagrama
```mermaid
erDiagram
    shipment_groups ||--o{ shipments : "groups (1 per order)"
    shipment_groups ||--o{ delivery_assignments : "assigned (whole order)"
    shipping_quotes ||--o{ shipments : "may convert to"
    shipments ||--o{ packages : has
    shipments ||--o{ tracking_events : tracked
    shipments ||--|| delivery_proofs : "may have"
    shipments ||--o{ shipment_status_history : audited
    logistics_operators ||--o{ delivery_assignments : performs
```

---

## 4. Payments App — DB `payments_db`

Fuente de verdad de: `payment_id`, intentos, comprobantes, settlements (uno por seller dentro de una order), payouts, refunds.

### 4.1 Tablas

#### `payments`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `pay_…` |
| `order_id` | string | ref opaca |
| `buyer_clerk_user_id` | string | de Clerk-Buyer (lo manda Buyer App) |
| `buyer_profile_id` | string | |
| `amount_cents` | int | total cobrado al comprador |
| `currency` | string | |
| `method` | enum? `credit_card` \| `debit_card` \| `account_money` \| `pix` \| `bank_transfer` | se llena post-aprobación |
| `card_last4` | string? | |
| `status` | enum (ver §6.5) | |
| `gateway_reference` | string | `mp_payment_id` o `mp_preference_id` |
| `items_summary` | json? | desglose por vendedor: `[{ seller_profile_id, subtotal_cents, shipping_cost_cents, order_seller_group_id, items[] }]`, usado al llegar `shipment-delivered` para calcular settlements |
| `idempotency_key` | string unique | previene duplicados permanentemente |
| `checkout_url` | string? | URL de MP (`init_point` / `sandbox_init_point`) |
| `preference_id` | string? | ID de preferencia de MP |
| `approved_at` / `rejected_at` / `cancelled_at` | timestamps? | |
| `created_at` / `updated_at` | timestamps | |

#### `payment_attempts`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `pat_…` |
| `payment_id` | string FK | |
| `attempt_number` | int | |
| `provider` | string | `mercadopago` |
| `status` | enum `pending` \| `approved` \| `rejected` \| `cancelled` | |
| `error_code` | string? | |
| `error_message` | string? | |
| `request_payload` | json? | |
| `response_payload` | json? | |
| `created_at` | timestamp | |

#### `receipts`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `rec_…` |
| `payment_id` | string FK | |
| `receipt_number` | string | |
| `receipt_url` | string | PDF |
| `amount_cents` | int | |
| `idempotency_key` | string unique? | |
| `issued_at` | timestamp | |

#### `settlements`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `set_…` |
| `payment_id` | string FK | |
| `order_id` | string | |
| `order_seller_group_id` | string | |
| `seller_profile_id` | string | |
| `gross_amount_cents` | int | subtotal del seller (sin envío del marketplace, según política) |
| `fee_amount_cents` | int | comisión del marketplace |
| `net_amount_cents` | int | gross - fee |
| `currency` | string | |
| `status` | enum (ver §6.6) | |
| `paid_at` | timestamp? | |
| `created_at` / `updated_at` | timestamps | |

Índice: `(payment_id, seller_profile_id)` unique.

#### `payouts`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `pyt_…` |
| `settlement_id` | string FK | |
| `transfer_id` | string? | id de la transferencia en MP |
| `status` | enum `pending` \| `in_progress` \| `completed` \| `failed` \| `manual_review` | |
| `attempts` | int | |
| `last_error` | string? | |
| `idempotency_key` | string unique? | |
| `started_at` / `completed_at` | timestamps? | |

#### `refunds`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `ref_…` |
| `payment_id` | string FK | |
| `seller_profile_id` | string? | si es parcial por seller |
| `amount_cents` | int | |
| `reason` | enum `seller_rejected` \| `buyer_cancelled` \| `not_delivered` \| `manual` | |
| `status` | enum `pending` \| `approved` \| `failed` | |
| `gateway_reference` | string? | |
| `idempotency_key` | string unique? | |
| `created_at` | timestamp | |

#### `mp_webhook_events` (solo entrante de Mercado Pago)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `whe_…` |
| `mp_event_id` | string unique | id del evento que manda MP, sirve para dedupe |
| `event_type` | string | `payment.created`, `payment.updated`, etc. |
| `payload` | json | body crudo del POST |
| `signature_valid` | boolean | resultado de validar `MERCADOPAGO_WEBHOOK_SECRET` |
| `processed_at` | timestamp? | |
| `last_error` | string? | |
| `status` | enum `received` \| `processed` \| `failed` | |
| `created_at` | timestamp | |

#### `outbound_calls_log` (auditoría de llamadas REST a otras apps)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string PK | `oc_…` |
| `target_app` | string | `buyer`, `seller`, `shipping` |
| `method` | string | `POST` \| `PATCH` |
| `path` | string | endpoint llamado |
| `request_body` | json | |
| `response_status` | int? | |
| `response_body` | json? | |
| `attempts` | int | hasta 3 |
| `last_error` | string? | |
| `succeeded_at` | timestamp? | |
| `created_at` | timestamp | |

### 4.2 Diagrama
```mermaid
erDiagram
    payments ||--o{ payment_attempts : tries
    payments ||--|| receipts : "may have"
    payments ||--o{ settlements : "splits per seller"
    settlements ||--o{ payouts : "transfers"
    payments ||--o{ refunds : "may refund"
```

---

## 5. Máquinas de estado (referencia rápida)

### 5.1 `order.status` (Buyer)
```
pending_payment ─┬─► paid ─► partially_shipped ─► shipped ─► delivered ─► completed
                 ├─► payment_failed
                 └─► cancelled
        paid ─► refunded (terminal)
```

### 5.2 `order_seller_group.status` (Buyer)
```
pending ─► preparing ─► ready_to_ship ─► in_transit ─► delivered ─► settled
       └─► cancelled / refunded
```

### 5.3 `sales_order.fulfillment_status` (Seller)
```
pending ─► accepted ─► preparing ─► ready_to_ship ─► handed_over ─► delivered
        └─► rejected ─► cancelled
```

### 5.4 `shipment.status` (Shipping)
```
created ─► ready_for_pickup ─► picked_up ─► in_transit ─► out_for_delivery ─► delivered
                                                                          └─► failed_delivery ─► returned
```

### 5.5 `payment.status` (Payments)
```
pending ─┬─► approved ──► refunded
         ├─► rejected (terminal)
         └─► cancelled (terminal)
```

### 5.6 `settlement.status` (Payments)
```
pending ─► paid (terminal)
        └─► failed ─► (retry) ─► paid
                  └─► manual_review (terminal)
```

---

## 6. Datos duplicados y estrategia de consistencia

| Dato | Apps que lo tienen | Fuente de verdad | Estrategia |
|---|---|---|---|
| Identidad de usuario | Todas las apps comparten el mismo Clerk | El Clerk compartido | Un usuario tiene una sola cuenta de Clerk. Su rol en cada app se determina por `publicMetadata`. |
| Datos de perfil básicos (nombre, email) | Clerk compartido + perfil local en cada DB | Clerk compartido | El perfil local se crea en el primer login en cada app (provisioning perezoso): el backend lee los claims del JWT y hace upsert. |
| `order_id` y estado visible de la orden | Buyer (verdad), Seller, Shipping, Payments | **Buyer App** | Buyer es dueña; las demás guardan ref opaca y reciben `PATCH` REST cuando hay cambios. |
| `shipment_id` y estado de envío | Shipping (verdad), Buyer, Seller | **Shipping App** | Shipping notifica con `PATCH` REST; Buyer y Seller guardan `shipping_status` espejo. ADR-006: a Buyer se le manda el tracking GLOBAL del pedido (`BMK-…`); a Seller, el `shipment_id` de su envío. |
| Tracking del pedido (global) vs del envío (individual) | Shipping (verdad) | **Shipping App** | `shipment_groups.tracking_number` (`BMK-…`) lo ve el comprador; `shipments.tracking_number` (`TRK-AR-…`) lo ve cada vendedor para su propio envío. |
| `payment_id` y estado de pago | Payments (verdad), Buyer, Seller | **Payments App** | Payments notifica con `PATCH` REST. |
| `product_id`, precio, peso, dimensiones | Seller (verdad), Buyer (snapshots) | **Seller App** | Buyer guarda snapshots al agregar al carrito. `availability` solo confirma `status=active` (sin stock: el proyecto trabaja con stock ilimitado). |
| Dirección de envío | Buyer (verdad), Shipping (snapshot), Seller (snapshot) | **Buyer App** | Snapshot al crear la orden; nunca se actualiza. |
| Comisión y net del settlement | Payments (verdad) | **Payments App** | Seller solo lee. |

---

## Apéndice: Cambios consolidados

### A. Reglas comunes (§0) — IDs

| Anterior | Actual | Por qué |
|----------|--------|---------|
| `String @id @default(cuid())` con prefijo generado en aplicación | `String @id @default(cuid())` sobrescrito vía extensión de Prisma (`$extends`) que llama a `generateId(model)` de `src/lib/id-generator.ts` | El middleware `$extends` en `src/lib/prisma.ts` intercepta cada `create` y reemplaza el `id` generado por `cuid()` con un ID prefijado (`pay_`, `set_`, etc.). Esto garantiza IDs legibles estilo Stripe sin depender del `@default` del schema. |

### B. Regla de identidad (§0)

- **Anterior**: "cada app tiene su propio Clerk. `clerk_user_id` en cada perfil refiere al Clerk **de esa app**. No existe correlación entre Clerks."
- **Actual**: "todas las apps comparten el mismo proyecto de Clerk. El `clerk_user_id` es el mismo para un usuario dado sin importar en qué app lo lea."

### C. Buyer App — `carts.status`

- **Anterior**: `enum active | converted | abandoned`
- **Actual**: `enum active | converted`
- **Por qué**: detectar carritos abandonados requería un cron o webhook que estaba fuera del alcance. Sin mecanismo que transite a `abandoned`, el estado era dead code.

### D. Seller App — `products.category`

- **Anterior**: `mtb | road | urban | kids | bmx | parts | accessories`
- **Actual**: agrega `indumentaria`.

### E. Payments App — Tabla `payments`

| Campo | Anterior | Actual | Por qué |
|-------|----------|--------|---------|
| `checkout_url` | No existía | `string?` — URL de MP (`init_point`) | Se guarda post-creación de preferencia para devolver al frontend en respuestas de idempotencia. |
| `preference_id` | No existía | `string?` — ID de preferencia de MP | Necesario para renderizar Wallet Brick en el frontend. |
| `items_summary` | No existía | `json?` — `[{ seller_profile_id, subtotal_cents, shipping_cost_cents, order_seller_group_id, items[] }]` | Se persiste el payload completo del request para usarlo al calcular settlements cuando llega `shipment-delivered`. |
| `idempotency_key` | `string unique` | `string unique` | Sin cambios. |
| `method` | `enum?` | `enum` (mismo) | Sin cambios — se llena post-aprobación desde webhook. |
| `card_last4` | No existía | `string?` | Se llena post-aprobación desde respuesta de MP. |

### F. Payments App — Nuevas tablas de auditoría

| Tabla | Anterior | Actual | Por qué |
|-------|----------|--------|---------|
| `PaymentStatusHistory` | No existía | Modelo completo con `from_status`, `to_status`, `source`, `payload`, `occurred_at` | Auditoría de cambios de estado requerida para trazabilidad. |
| `SettlementStatusHistory` | No existía | Idem | Idem. |
| `RefundStatusHistory` | No existía | Idem | Idem. |

### G. Payments App — Tablas modificadas

#### `receipts`
- **Nuevo**: `idempotency_key` (`string unique?`) — Idempotencia permanente.

#### `refunds`
- **Nuevo**: `idempotency_key` (`string unique?`) — Idempotencia permanente.

#### `payouts`
- **Nuevo**: `idempotency_key` (`string unique?`) — Idempotencia permanente.

#### `settlements`
- **Anterior**: Sin relación a `payouts`.
- **Actual**: `payouts Payout[]` — un settlement puede tener múltiples intentos de payout.

### H. Sin cambios

- `payment_attempts` — idéntico.
- `mp_webhook_events` — idéntico.
- `outbound_calls_log` — idéntico.
- Diagramas ER — idénticos.
- Máquinas de estado (§5) — idénticas.
- Datos duplicados (§6) — idéntico salvo la fila de identidad actualizada.
