# 1.2 — Asignación de Responsabilidades

> **Tipo C — Marketplace · BiciMarket**

---

## 1. Distribución

| App          | Responsable        | Repositorio                                                         | Clerk propio                                                            |
| ------------ | ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Buyer App    | Camila Rojas Fritz | https://github.com/camilarojasfritz/proyecto-c-buyer-camilarojas    | Sí (`buyer.bicimarket`)                                                 |
| Seller App   | Pierino Spina      | https://github.com/Spinapierino7/proyecto-c-seller-pierinospina.git | Sí (`seller.bicimarket`)                                                |
| Shipping App | Enrique Seitz      | https://github.com/Enry6tz/proyecto-c-shipping-enriqueseitz         | Sí (`shipping.bicimarket`)                                              |
| Payments App | Rocco Paoloni      | https://github.com/roccopaoloni/proyecto-c-payments-roccopaoloni    | Sí (`payments.bicimarket`), **solo para admins** (no buyers ni sellers) |

---

## 2. Reglas transversales

> **Restricción del proyecto — stock ilimitado**: para esta etapa ninguna app maneja stock real. Seller App no tiene campo `stock` ni tabla `inventory_movements`, no se descuenta nada al pagar y no existe el error `INSUFFICIENT_STOCK`. Todo producto `active` se considera disponible. Ver `01-descripcion.md §1.1`.

Toda app del sistema cumple estas reglas. **Si alguna no las cumple, el sistema entero se rompe**:

1. **Versionado**: todos los endpoints viven bajo `/api/v1/...`.
2. **Autenticación**:
   - `Authorization: Bearer <JWT>` para llamadas hechas por la UI propia, validadas contra el Clerk de **esa misma app**.
   - `X-Service-Token: <secret>` para llamadas server-to-server entre apps. Cada par origen→destino tiene su propio secret rotable.
3. **Formato de error**: `{ "error": { "code": "...", "message": "...", "details": {} } }` con HTTP status apropiado. Códigos en `SCREAMING_SNAKE_CASE`.
4. **Paginación**: GET de listado devuelve `{ "data": [...], "pagination": { "total": N, "page": 1, "limit": 20, "has_more": true } }`. Default `limit=20`, máximo `limit=100`.
5. **Idempotencia**: todo `POST` que crea recursos acepta header `Idempotency-Key`. Si llega un retry con la misma key, devuelve la misma response sin duplicar.
6. **Snapshots de datos cruzados**: cuando una app guarda datos cuya fuente de verdad está en otra (precio, nombre, dirección), guarda **snapshot al momento de la transacción**. Nunca consulta "en vivo" para mostrar histórico.
7. **Notificaciones inter-apps**: son llamadas REST normales (`POST` o `PATCH`). Si fallan con 5xx o timeout, el emisor reintenta hasta 3 veces con backoff lineal (1s, 3s, 9s). No hay cola persistente: si tras los 3 intentos sigue fallando, se loguea el error y se reporta. Para el alcance académico del proyecto esto alcanza; en producción real reemplazaríamos por una cola.
8. **Logs y trazabilidad**: cada request inter-app lleva `X-Request-Id: <uuid>` que se propaga en cadena.
9. **Multi-vendedor**: una orden de compra puede contener productos de varios vendedores. Cada app maneja la descomposición a su nivel:
   - Buyer App: `order` → `order_seller_groups` (1 por seller).
   - Seller App: una `sales_order` por seller (independientes).
   - Shipping App: un `shipment` por seller (independiente).
   - Payments App: una `settlement` por seller, pero un único `payment`.

---

## 3. Buyer App

### 3.1 Datos propios (DB de Buyer App)

- `buyer_profiles` — perfil local del comprador, vinculado a `clerk_user_id` del Clerk-Buyer.
- `addresses` — direcciones de envío del comprador.
- `carts` y `cart_items` — carrito activo, con snapshot de precio al agregar.
- `favorite_items` — wishlist.
- `orders` — **fuente de verdad de `order_id`**.
- `order_seller_groups` — sub-grupos de la orden por vendedor (uno por seller_profile_id).
- `order_items` — items de la orden con snapshot.

### 3.2 Compromisos públicos

La Buyer App **se compromete a**:

- Exponer un catálogo navegable (proxy de Seller App) con caché corta (≤ 60s).
- Crear órdenes consistentes: confirmar `status=active` y precio vigente vía Seller App (`availability`) y costos vía Shipping App **antes** de llamar a Payments. No hay validación de cantidad disponible: por restricción del proyecto el stock es ilimitado.
- Disparar el cobro hacia Payments con un `Idempotency-Key` único por orden.
- Aceptar llamadas REST entrantes de Payments (cambios de pago) y de Shipping (cambios de envío), actualizando `order.status` y `order_seller_groups.status` correctamente.
- Mantener el carrito accesible y consistente entre dispositivos (vinculado a `clerk_user_id`).
- No exponer datos de pago ni de envío más allá del estado de alto nivel — los detalles se consultan a la app dueña.

### 3.3 Compromisos NO asumidos (importante)

- **No procesa pagos**. Solo dispara y consulta.
- **No agenda envíos**. Solo cotiza vía Shipping App.
- **No conoce el `tracking_number` real**. Lo expone como dato de tracking que provee Shipping.
- **No es dueña del estado de un envío**. Lo recibe.

### 3.4 Lo que consume de otras apps

| Consume de   | Para qué                                             | Endpoint                                                                                                        |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Seller App   | Listar catálogo, ver detalle, validar disponibilidad | `GET /api/v1/products`, `GET /api/v1/products/{id}`, `GET /api/v1/products/{id}/availability`                   |
| Shipping App | Cotizar envío en checkout, leer estado del envío     | `POST /api/v1/shipping-quotes`, `GET /api/v1/shipments?orderId=X`, `GET /api/v1/shipments/{id}/tracking-events` |
| Payments App | Iniciar cobro, leer comprobante                      | `POST /api/v1/payments`, `GET /api/v1/payments?orderId=X`, `GET /api/v1/receipts/{id}`                          |

### 3.5 Lo que recibe (REST entrante de otras apps)

| De           | Endpoint expuesto                                            | Acción                                           |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------ |
| Payments App | `PATCH /api/v1/orders/{id}/status`                           | Actualiza `order.status` (paid, refunded).       |
| Shipping App | `PATCH /api/v1/orders/{id}/seller-groups/{groupId}/shipping` | Actualiza `order_seller_groups.shipping_status`. |

---

## 4. Seller App

### 4.1 Datos propios (DB de Seller App)

- `seller_profiles` — perfil local del vendedor con `tax_id`, `bank_account_reference`, `verification_status`.
- `products` — catálogo, **fuente de verdad de precio y peso**. Sin `stock` (restricción del proyecto: stock ilimitado).
- `product_images` — URLs e índice de orden.
- `sales_orders` — sub-orden recibida del marketplace (1 por seller × order de comprador).
- `sales_order_items` — items con snapshot.

### 4.2 Compromisos públicos

La Seller App **se compromete a**:

- Mantener un catálogo consultable y filtrable con paginación, ordenamiento y búsqueda (`q`, `category`, `brand`, `condition`, `min_price`, `max_price`).
- Reportar en `GET /products/{id}/availability` que el producto está `active` y devolver precio y peso vigentes (no hay control de stock).
- Aceptar la creación de `sales_orders` desde Payments App vía `POST /api/v1/sales-orders` (REST con `X-Service-Token`). No se descuenta inventario.
- Permitir al vendedor aceptar/rechazar/preparar/despachar cada `sales_order`.
- Disparar la creación del `shipment` en Shipping App apenas el vendedor marca `ready_to_ship`.
- Exponer endpoints CRUD completos de productos e imágenes.

### 4.3 Compromisos NO asumidos

- **No conoce el `total` de la `order` del comprador**. Solo el sub-total de su `sales_order`.
- **No factura ni libera pagos**. Solo lee `settlement.status` desde Payments.
- **No traquea físicamente el envío**. Solo recibe estados desde Shipping.

### 4.4 Lo que consume

| Consume de   | Para qué                                                | Endpoint                                                                  |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Shipping App | Crear envío, asignar paquetes                           | `POST /api/v1/shipments`, `POST /api/v1/shipments/{id}/packages`          |
| Payments App | Ver liquidaciones propias del vendedor, pedir reembolso | `GET /api/v1/settlements?sellerId=X`, `POST /api/v1/payments/{id}/refund` |

### 4.5 Lo que recibe (REST entrante de otras apps)

| De           | Endpoint                                          | Acción                                |
| ------------ | ------------------------------------------------- | ------------------------------------- |
| Payments App | `POST /api/v1/sales-orders`                       | Crea la sub-orden tras pago aprobado. |
| Payments App | `PATCH /api/v1/sales-orders/{id}/payment-status`  | Marca settled / refunded.             |
| Shipping App | `PATCH /api/v1/sales-orders/{id}/shipping-status` | Actualiza estado de envío.            |

---

## 5. Shipping App

### 5.1 Datos propios (DB de Shipping App)

- `logistics_operators` — operadores propios o tercerizados.
- `shipping_rates` — tarifario por peso/zona.
- `shipping_quotes` — cotizaciones emitidas con TTL de 60 minutos.
- `shipments` — **fuente de verdad de `shipment_id`**, peso total, costo final, status.
- `packages` — bultos del envío con `weight_grams`, `length_cm`, `width_cm`, `height_cm`, `label_url`.
- `tracking_events` — historial de eventos.
- `delivery_assignments` — asignación operador↔envío.
- `delivery_proofs` — fotos, firmas, notas en entrega.

### 5.2 Compromisos públicos

La Shipping App **se compromete a**:

- Cotizar envíos con `POST /shipping-quotes` devolviendo costo, días estimados, peso total y bultos. La cotización vive 60 minutos vía `quote_id`.
- Crear `shipments` cuando Seller App lo solicita post-pago.
- Permitir al operador logístico ver sus asignaciones y registrar eventos.
- Notificar a Buyer y Seller cada cambio relevante de estado con un `PATCH` REST.
- Notificar a Payments con un `POST` REST cuando un envío llega a `delivered` (gatilla la liquidación).
- Validar prueba de entrega (foto + firma) antes de pasar a `delivered`.

### 5.3 Compromisos NO asumidos

- **No procesa cobros del envío**. Reporta el `cost`; el cobro lo agrega Buyer App al total y lo cobra Payments.
- **No conoce el monto de la orden**.

### 5.4 Lo que consume

Shipping App es mayormente reactiva. Solo consume:

| Consume de | Para qué                                          | Endpoint                                         |
| ---------- | ------------------------------------------------- | ------------------------------------------------ |
| Seller App | Validar `seller_profile_id` y dirección de retiro | `GET /api/v1/seller-profile/{id}/pickup-address` |

### 5.5 Lo que recibe (REST entrante de otras apps)

| De         | Endpoint                          | Acción      |
| ---------- | --------------------------------- | ----------- |
| Seller App | `POST /api/v1/shipments`          | Crea envío. |
| Buyer App  | `POST /api/v1/shipping-quotes`    | Cotiza.     |
| Buyer App  | `GET /api/v1/shipments?orderId=X` | Consulta.   |

---

## 6. Payments App

### 6.1 Datos propios (DB de Payments App)

- `payments` — **fuente de verdad de `payment_id`**, total cobrado por orden.
- `payment_attempts` — intentos contra Mercado Pago.
- `receipts` — comprobantes (PDF + URL).
- `settlements` — liquidación por (`order_id`, `seller_profile_id`).
- `payouts` — transferencias reales a vendedores (referencia a `transfer_id` de MP).
- `refunds` — reembolsos.
- `webhook_events` — log de eventos entrantes desde MP y de salientes hacia otras apps, con su estado de retry.

### 6.2 Compromisos públicos

La Payments App **se compromete a**:

- Crear pagos en Mercado Pago con un `external_reference = order_id` para trazabilidad.
- Devolver `checkout_url` y `payment_id` a Buyer App en el `POST /payments`.
- Recibir el webhook de Mercado Pago (único webhook del sistema), validar la firma de MP y actualizar estado.
- Notificar a Buyer (cambio de pago) y a Seller (creación de sub-orden, cambio de liquidación) con `POST`/`PATCH` REST sobre HTTP.
- Calcular y registrar settlements por vendedor con `gross`, `fee` y `net`.
- Disparar transferencias (`POST /v1/transfers`) al vendedor cuando Shipping reporta `delivered`.
- Manejar reembolsos parciales y totales.

### 6.3 Compromisos NO asumidos

- **No conoce el detalle de productos** (solo `seller_profile_id`, monto y referencia de orden).
- **No agenda envíos**.
- **No persiste datos sensibles de tarjeta** (eso vive en Mercado Pago).
- **No expone UI a buyers ni sellers.** Los compradores ven "Mis comprobantes" dentro de Buyer App; los vendedores ven "Mis liquidaciones" dentro de Seller App. Esas apps consumen los endpoints REST de Payments con `X-Service-Token`. Payments solo expone UI a admins (refunds manuales, payouts, settlements).

### 6.4 Lo que consume

| Consume de   | Para qué                                                   | Endpoint                                                                                             |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Mercado Pago | Crear pagos, transferir, reembolsar                        | `POST /v1/payments`, `POST /v1/payments/{id}/refunds`, `POST /v1/transfers`, `GET /v1/payments/{id}` |
| Buyer App    | Validar que la orden existe y obtener `seller_profile_id`s | `GET /api/v1/orders/{id}` (con `X-Service-Token`)                                                    |

### 6.5 Lo que recibe (REST entrante)

| De           | Endpoint                                   | Tipo                                    | Acción                              |
| ------------ | ------------------------------------------ | --------------------------------------- | ----------------------------------- |
| Buyer App    | `POST /api/v1/payments`                    | REST con `X-Service-Token`              | Inicia cobro.                       |
| Mercado Pago | `POST /webhooks/mercadopago`               | **Webhook externo** (único del sistema) | Notifica cambio de pago.            |
| Shipping App | `POST /api/v1/internal/shipment-delivered` | REST con `X-Service-Token`              | Gatilla la liquidación al vendedor. |

---

## 7. Mecanismo de comunicación inter-apps (resumen normativo)

| Tipo                                            | Cuándo                                                     | Headers obligatorios                                | Auth                                        | Retry                                                |
| ----------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| **REST usuario → app propia**                   | UI llama a su backend                                      | `Authorization: Bearer <JWT>`                       | JWT validado contra Clerk de la misma app   | No (lo maneja el cliente)                            |
| **REST app → app** (consultas Y notificaciones) | Cualquier comunicación interna entre apps                  | `X-Service-Token: <secret>`, `X-Request-Id: <uuid>` | Secret compartido del par origen→destino    | 3 reintentos con timeout 5s, backoff lineal 1s/3s/9s |
| **Webhook MP → Payments**                       | Cambio de pago en Mercado Pago (único webhook del sistema) | Firma propia de MP (`x-signature`)                  | Validar contra `MERCADOPAGO_WEBHOOK_SECRET` | Lo maneja Mercado Pago                               |

Cada par de apps que se comuniquen mantiene **un secreto compartido** (`<APPA>_TO_<APPB>_SERVICE_TOKEN`), rotable, almacenado en variables de entorno de cada app, **nunca commiteado**.

---

## 8. Tabla maestra de comunicación

Todas son llamadas REST con `X-Service-Token`, salvo la última que es el webhook externo de Mercado Pago.

| App origen                                       | Acción                              | App destino | Método  | Endpoint                                         |
| ------------------------------------------------ | ----------------------------------- | ----------- | ------- | ------------------------------------------------ |
| Buyer                                            | Consultar catálogo                  | Seller      | `GET`   | `/api/v1/products`                               |
| Buyer                                            | Validar disponibilidad pre-checkout | Seller      | `GET`   | `/api/v1/products/{id}/availability`             |
| Buyer                                            | Cotizar envío por seller-group      | Shipping    | `POST`  | `/api/v1/shipping-quotes`                        |
| Buyer                                            | Iniciar cobro                       | Payments    | `POST`  | `/api/v1/payments`                               |
| Buyer                                            | Consultar comprobante               | Payments    | `GET`   | `/api/v1/receipts/{id}`                          |
| Buyer                                            | Consultar tracking                  | Shipping    | `GET`   | `/api/v1/shipments?orderId=X`                    |
| Seller                                           | Crear envío                         | Shipping    | `POST`  | `/api/v1/shipments`                              |
| Seller                                           | Pedir reembolso                     | Payments    | `POST`  | `/api/v1/payments/{id}/refund`                   |
| Seller                                           | Ver liquidaciones                   | Payments    | `GET`   | `/api/v1/settlements?sellerId=X`                 |
| Payments                                         | Validar orden                       | Buyer       | `GET`   | `/api/v1/orders/{id}`                            |
| Payments                                         | Pago aprobado/rechazado/refunded    | Buyer       | `PATCH` | `/api/v1/orders/{id}/status`                     |
| Payments                                         | Crear sub-orden tras pago           | Seller      | `POST`  | `/api/v1/sales-orders`                           |
| Payments                                         | Liquidación lista                   | Seller      | `PATCH` | `/api/v1/sales-orders/{id}/payment-status`       |
| Shipping                                         | Cambio de envío                     | Buyer       | `PATCH` | `/api/v1/orders/{id}/seller-groups/{g}/shipping` |
| Shipping                                         | Cambio de envío                     | Seller      | `PATCH` | `/api/v1/sales-orders/{id}/shipping-status`      |
| Shipping                                         | Entregado                           | Payments    | `POST`  | `/api/v1/internal/shipment-delivered`            |
| **Mercado Pago** _(externo, único webhook real)_ | Pago actualizado                    | Payments    | `POST`  | `/webhooks/mercadopago`                          |

---
