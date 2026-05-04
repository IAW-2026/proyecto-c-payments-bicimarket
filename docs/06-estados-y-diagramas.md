# 1.6 — Estados y Diagramas Adicionales (anexo)

> Anexo del `preview/`. Centraliza máquinas de estado, transiciones permitidas y diagramas de carril complementarios para casos no felices (rechazo, cancelación, devolución, fallo de pago).

> Documentación de referencia para los integrantes del equipo de desarrollo, no forma parte de la entrega.

> **Restricción del proyecto — stock ilimitado**: ningún diagrama contempla descuento, reserva ni liberación de stock. Toda publicación `active` se considera disponible. Los rechazos del vendedor en este anexo se atribuyen a otras causas (producto dañado, error de publicación, etc.). Ver `01-descripcion.md §1.1`.

---

## 1. Máquinas de estado

### 1.1 `order.status` (Buyer)

```mermaid
stateDiagram-v2
    [*] --> pending_payment
    pending_payment --> paid: Payments aprueba
    pending_payment --> payment_failed: Payments rechaza
    pending_payment --> cancelled: comprador cancela
    paid --> partially_shipped: 1+ shipment in_transit
    partially_shipped --> shipped: todos los shipments in_transit
    shipped --> delivered: todos los shipments delivered
    delivered --> completed: pasados N días sin disputa
    paid --> refunded: refund total
    delivered --> refunded: refund post-entrega
    payment_failed --> [*]
    cancelled --> [*]
    refunded --> [*]
    completed --> [*]
```

**Reglas**:

- `paid → partially_shipped` cuando ≥1 `order_seller_groups` están `in_transit` y al menos uno aún no.
- `partially_shipped → shipped` cuando **todos** los seller_groups están al menos `in_transit`.
- Una orden con un solo seller pasa directo de `paid` a `shipped` sin pasar por `partially_shipped`.

### 1.2 `order_seller_group.status`

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> preparing: seller acepta
    pending --> cancelled: seller rechaza / refund
    preparing --> ready_to_ship: seller marca preparado
    ready_to_ship --> in_transit: shipping picked_up
    in_transit --> delivered: shipping delivered
    delivered --> settled: payments settled
    delivered --> refunded: refund post-entrega
    cancelled --> [*]
    refunded --> [*]
    settled --> [*]
```

### 1.3 `sales_order.fulfillment_status` (Seller)

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> accepted: POST /accept
    pending --> rejected: POST /reject (dispara refund)
    accepted --> preparing: PATCH /prepare
    preparing --> ready_to_ship: PATCH /prepare con status=ready_to_ship
    ready_to_ship --> handed_over: shipping picked_up
    handed_over --> delivered: shipping delivered
    rejected --> [*]
    delivered --> [*]
```

### 1.4 `shipment.status` (Shipping)

```mermaid
stateDiagram-v2
    [*] --> created
    created --> ready_for_pickup: etiqueta generada y asignada
    ready_for_pickup --> picked_up: tracking_event picked_up
    picked_up --> in_transit: tracking_event in_transit
    in_transit --> out_for_delivery: tracking_event out_for_delivery
    out_for_delivery --> delivered: POST /deliver con prueba
    out_for_delivery --> failed_delivery: tracking_event failed_delivery
    failed_delivery --> in_transit: reintento
    failed_delivery --> returned: tras N intentos
    delivered --> [*]
    returned --> [*]
```

### 1.5 `payment.status` (Payments)

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> approved: webhook MP → approved
    pending --> rejected: webhook MP → rejected
    pending --> cancelled: comprador o admin cancela
    approved --> refunded: POST /refund
    approved --> [*]
    refunded --> [*]
    rejected --> [*]
    cancelled --> [*]
```

### 1.6 `settlement.status` (Payments)

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> paid: payout completado en MP
    pending --> failed: payout falla
    failed --> paid: retry exitoso
    failed --> manual_review: tras 3 retries
    paid --> [*]
    manual_review --> [*]
```

---

## 2. Diagrama de carril — caso de pago rechazado

```mermaid
sequenceDiagram
    autonumber
    actor C as Comprador
    participant B as Buyer App
    participant P as Payments App
    participant MP as Mercado Pago

    C->>B: POST /api/v1/orders
    B->>P: POST /api/v1/payments
    P->>MP: POST /v1/payments
    MP-->>P: payment_id, status=in_process
    P-->>B: checkout_url
    B-->>C: redirige a MP
    C->>MP: Intenta con tarjeta rechazada
    MP-->>P: webhook payment.updated (status=rejected)
    P->>MP: GET /v1/payments/{id} (confirma)
    P-->>B: PATCH /api/v1/orders/{id}/status (payment_failed) [REST con X-Service-Token]
    note over B: order.status = payment_failed.<br/>(El proyecto trabaja con stock ilimitado:<br/>no hay inventario que liberar.)
    B-->>C: muestra "pago rechazado, intentá con otra tarjeta"
    C->>B: POST /api/v1/orders/{id}/retry-payment (futuro) o crea orden nueva
```

---

## 3. Diagrama de carril — caso de rechazo del vendedor

```mermaid
sequenceDiagram
    autonumber
    actor V as Vendedor
    participant S as Seller App
    participant P as Payments App
    participant B as Buyer App

    V->>S: POST /api/v1/sales-orders/{id}/reject (producto dañado / error de publicación)
    S->>P: POST /api/v1/payments/{paymentId}/refund (parcial por seller)
    P->>P: crea refund con status=pending, amount = subtotal del seller + envío del seller
    P->>MP: POST /v1/payments/{id}/refunds
    MP-->>P: refund_id, status=approved
    P->>P: refund.status=approved
    P-->>B: PATCH /api/v1/orders/{id}/seller-groups/{g}/status (refunded)
    note over B: order_seller_group → refunded.<br/>Si era el único seller_group, order → refunded.<br/>Si había varios, order sigue su curso con los demás.
    P-->>S: PATCH /api/v1/sales-orders/{id}/payment-status (refunded)
    note over S: sales_order → cancelled, fulfillment_status = rejected
```

---

## 4. Diagrama de carril — entrega fallida y reintento

```mermaid
sequenceDiagram
    autonumber
    actor OP as Operador
    participant SH as Shipping App
    participant B as Buyer App
    participant S as Seller App

    OP->>SH: POST /api/v1/shipments/{id}/tracking-events (failed_delivery)
    SH-->>B: PATCH /api/v1/orders/{id}/seller-groups/{g}/shipping (failed_delivery)
    SH-->>S: PATCH /api/v1/sales-orders/{id}/shipping-status (failed_delivery)
    note over OP: agendar segundo intento
    OP->>SH: POST /api/v1/shipments/{id}/tracking-events (out_for_delivery)
    OP->>SH: POST /api/v1/shipments/{id}/deliver (proof)
    SH-->>B: PATCH /api/v1/orders/{id}/seller-groups/{g}/shipping (delivered)
    SH-->>S: PATCH /api/v1/sales-orders/{id}/shipping-status (delivered)
    SH-->>P: POST /api/v1/internal/shipment-delivered
```

Si el segundo intento también falla y se acumulan 3 intentos, el shipment pasa a `returned` y se dispara el flujo de reembolso.

---

## 5. Resumen de transiciones permitidas (rejection table)

Toda app que reciba un cambio de estado debe **rechazar transiciones inválidas con HTTP 409 INVALID_TRANSITION**. Esta tabla es la fuente de verdad:

### `order.status`

| from \ to         | paid | payment_failed | partially_shipped | shipped | delivered | completed | cancelled | refunded |
| ----------------- | ---- | -------------- | ----------------- | ------- | --------- | --------- | --------- | -------- |
| pending_payment   | ✅   | ✅             | ❌                | ❌      | ❌        | ❌        | ✅        | ❌       |
| paid              | ❌   | ❌             | ✅                | ✅      | ❌        | ❌        | ❌        | ✅       |
| partially_shipped | ❌   | ❌             | ❌                | ✅      | ❌        | ❌        | ❌        | ✅       |
| shipped           | ❌   | ❌             | ❌                | ❌      | ✅        | ❌        | ❌        | ✅       |
| delivered         | ❌   | ❌             | ❌                | ❌      | ❌        | ✅        | ❌        | ✅       |
| completed         | ❌   | ❌             | ❌                | ❌      | ❌        | ❌        | ❌        | ❌       |

### `payment.status`

| from \ to | approved | rejected | cancelled | refunded |
| --------- | -------- | -------- | --------- | -------- |
| pending   | ✅       | ✅       | ✅        | ❌       |
| approved  | ❌       | ❌       | ❌        | ✅       |

### `shipment.status`

| from \ to        | ready_for_pickup | picked_up | in_transit | out_for_delivery | delivered | failed_delivery | returned |
| ---------------- | ---------------- | --------- | ---------- | ---------------- | --------- | --------------- | -------- |
| created          | ✅               | ❌        | ❌         | ❌               | ❌        | ❌              | ❌       |
| ready_for_pickup | ❌               | ✅        | ❌         | ❌               | ❌        | ❌              | ❌       |
| picked_up        | ❌               | ❌        | ✅         | ❌               | ❌        | ❌              | ❌       |
| in_transit       | ❌               | ❌        | ❌         | ✅               | ✅        | ✅              | ❌       |
| out_for_delivery | ❌               | ❌        | ❌         | ❌               | ✅        | ✅              | ❌       |
| failed_delivery  | ❌               | ❌        | ✅         | ❌               | ❌        | ❌              | ✅       |
