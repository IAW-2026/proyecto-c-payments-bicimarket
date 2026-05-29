# 7. Integracion de Mercado Pago en Payments

> **Objetivo**: documentar como integrar Mercado Pago en este proyecto de punta a punta, usando como base la documentacion oficial de Mercado Pago y alineandola con la arquitectura actual de Payments.

## 1. Resumen ejecutivo

Para este proyecto, la mejor opcion es **Checkout Pro**.

La razon es simple: este Payments App ya trabaja con un flujo centrado en backend, crea una preferencia, recibe un `init_point`, redirige al checkout y procesa el resultado por webhooks. Eso coincide con el modelo de Checkout Pro, que ofrece una experiencia prearmada y redirecciona al entorno de Mercado Pago.

## 2. Comparacion de opciones

| Opcion | Donde se cobra | Esfuerzo | Personalizacion | Encaje para este proyecto |
| --- | --- | --- | --- | --- |
| Checkout Pro | En Mercado Pago | Bajo | Media/baja | **La mejor opcion** |
| Checkout Bricks | En tu sitio | Medio | Media/alta | Buena si mas adelante se quiere una UI mas embebida |
| Checkout API | En tu sitio | Alto | Alta | No es la mejor primera opcion para este repo |

### Por que gana Checkout Pro aqui

Mercado Pago describe Checkout Pro como una integracion predefinida, con redireccion a su entorno de pago y retorno al sitio del comercio al finalizar. Para este repo eso encaja mejor que una integracion totalmente custom porque:

1. El dominio Payments ya concentra la logica sensible en el backend.
2. El proyecto ya trabaja con `preferences`, `init_point`, `return_urls` y webhooks.
3. La prioridad del sistema es orquestar pago, liquidacion y trazabilidad, no construir una experiencia de checkout hiperpersonalizada.
4. La complejidad de Checkout API no aporta una ventaja clara para el alcance actual.

Bricks queda como alternativa valida si en el futuro se quiere insertar una experiencia de cobro mas integrada en la UI. Checkout API solo tiene sentido si se necesita control total del formulario y del flujo de pago, aceptando mas trabajo de integracion y mantenimiento.

## 3. Flujo recomendado para este proyecto

1. Buyer App calcula el total de la orden y llama a Payments.
2. Payments crea la preferencia en Mercado Pago.
3. Mercado Pago devuelve `init_point` y `preference_id`.
4. El frontend redirige al checkout de Mercado Pago.
5. Mercado Pago notifica el cambio de estado por webhook.
6. Payments valida la firma, consulta el pago y actualiza el estado interno.
7. Luego Payments sigue con el flujo de liquidacion y notificaciones internas entre apps.

## 4. Paso a paso de integracion

### Paso 1. Crear la aplicacion en Mercado Pago

Crear una aplicacion desde **Your integrations** en el panel de Mercado Pago. Esa aplicacion es la que agrupa credenciales, webhooks y configuraciones de prueba/produccion.

Documentacion oficial:

- [Checkout Pro - create application](https://www.mercadopago.com/developers/en/docs/checkout-pro/create-application)
- [Checkout Pro - development environment](https://www.mercadopago.com/developers/en/docs/checkout-pro/development-environment)

### Paso 2. Obtener credenciales de prueba y produccion

La integracion web necesita al menos:

- `public key` para el frontend.
- `access token` para el backend.

En desarrollo, Mercado Pago recomienda usar credenciales de prueba. En produccion, cambiar a las credenciales productivas de la misma aplicacion.

### Paso 3. Configurar variables de entorno del proyecto

Este repo ya contempla el modo sandbox/live desde variables de entorno. La documentacion interna del proyecto y el servicio de Mercado Pago usan estas variables:

```bash
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=...
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_SANDBOX_PUBLIC_KEY=...
MERCADOPAGO_SANDBOX_ACCESS_TOKEN=...
MERCADOPAGO_SANDBOX_MODE=true
```

Regla practica:

- En frontend solo va la public key.
- En backend solo va el access token.
- `MERCADOPAGO_SANDBOX_MODE=true` fuerza el uso de credenciales de prueba.

### Paso 4. Inicializar el SDK en el frontend

Mercado Pago indica que el entorno web debe inicializarse con su SDK oficial usando la public key del entorno correspondiente.

En este proyecto eso ya se refleja en el checkout de prueba, que inicializa el SDK en el navegador y habilita el boton de redireccion o el `Wallet` Brick como acceso auxiliar.

Documentacion oficial:

- [Checkout Pro - configure development environment](https://www.mercadopago.com/developers/en/docs/checkout-pro/development-environment)
- [MercadoPago.js SDK](https://www.mercadopago.com/developers/en/docs/checkout-pro/development-environment#bookmark_include_the_mercadopagojs_library)

### Paso 5. Crear la preferencia desde el backend

La app Payments debe crear una preferencia con los datos de la orden, el email del comprador y las URLs de retorno.

En este repo el flujo actual ya hace eso desde `src/app/api/v1/payments/route.ts` y usa `src/services/mercado-pago.service.ts` para hablar con Mercado Pago.

La forma conceptual de la preferencia es esta:

```ts
{
  items,
  payer: { email },
  external_reference: paymentId,
  auto_return: "approved",
  back_urls: {
    success,
    failure,
    pending,
  },
}
```

Puntos importantes:

- `external_reference` debe guardar el identificador interno del pago.
- `back_urls` debe devolver al sitio del proyecto.
- `auto_return` ayuda a cerrar el ciclo del checkout.
- El total enviado a Mercado Pago debe coincidir con el total calculado por el backend.

### Paso 6. Redirigir al checkout de Mercado Pago

Una vez creada la preferencia, Mercado Pago devuelve `init_point` y `preference_id`.

Ese `init_point` es el que se usa para mandar al comprador al checkout hospedado por Mercado Pago. En este repo ya existe ese comportamiento en la UI de prueba de checkout.

Mercado Pago lo documenta como un flujo de redireccion al entorno seguro de pago y retorno al sitio configurado.

### Paso 7. Configurar webhooks

Mercado Pago recomienda configurar notificaciones en la aplicacion para recibir eventos de pago y validar su origen.

Para este proyecto el evento relevante es `payment`.

La configuracion debe seguir estas reglas:

- Tener una URL de test y una URL de produccion.
- Validar la firma que llega en `x-signature`.
- Validar la frescura del timestamp.
- Consultar el pago por API antes de cambiar estados internos.
- Persistir los eventos para evitar duplicados.

Documentacion oficial:

- [Webhooks](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks)

### Paso 8. Validar el pago y actualizar el estado interno

Cuando llega el webhook, Payments no deberia confiar solo en el payload. La secuencia correcta es:

1. Validar la firma.
2. Consultar el pago en Mercado Pago.
3. Confirmar el estado final.
4. Actualizar el estado local del pago.
5. Disparar el resto del flujo interno del marketplace.

Ese enfoque coincide con el handler actual de `src/app/webhooks/mercadopago/route.ts`, que verifica la firma antes de iniciar el procesamiento asincrono.

### Paso 9. Probar en sandbox

Mercado Pago recomienda probar con credenciales de test y usuarios de prueba antes de pasar a produccion.

En este repo el checkout de prueba ya existe en `src/app/test/checkout/page.tsx`, por lo que sirve como punto de validacion funcional para el flujo sandbox.

### Paso 10. Pasar a produccion

Cuando el flujo de prueba sea estable:

1. Cambiar a credenciales productivas.
2. Actualizar URLs de retorno y webhook.
3. Desactivar cualquier modo sandbox.
4. Verificar de nuevo la firma de webhook y la persistencia de eventos.

## 5. Mapa de implementacion en este repo

- `src/app/api/v1/payments/route.ts`: crea la preferencia y devuelve `init_point`.
- `src/services/mercado-pago.service.ts`: encapsula el SDK y el acceso a la API de Mercado Pago.
- `src/app/webhooks/mercadopago/route.ts`: recibe y valida notificaciones.
- `src/app/test/checkout/page.tsx`: UI de prueba para verificar el flujo.

## 6. Que NO elegir y por que

### Checkout Bricks

Es una muy buena opcion si el objetivo es construir una experiencia de checkout mas integrada dentro del sitio. Sin embargo, para este proyecto no resuelve un problema real que hoy exista: el backend ya orquesta la preferencia, el retorno y la conciliacion.

### Checkout API

Es la opcion mas flexible, pero tambien la mas costosa de implementar. Requiere mas control del formulario, mas responsabilidad de UI y mas superficie de integracion. Para este Payments App es mas compleja de lo necesario.

## 7. Fuentes oficiales de Mercado Pago

- [Checkout Pro overview](https://www.mercadopago.com/developers/en/docs/checkout-pro/overview)
- [Checkout Pro development environment](https://www.mercadopago.com/developers/en/docs/checkout-pro/development-environment)
- [Checkout Pro create application](https://www.mercadopago.com/developers/en/docs/checkout-pro/create-application)
- [Checkout Bricks overview](https://www.mercadopago.com/developers/en/docs/checkout-bricks/landing)
- [Checkout API overview](https://www.mercadopago.com/developers/en/docs/checkout-api-orders/overview)
- [Webhooks](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks)
