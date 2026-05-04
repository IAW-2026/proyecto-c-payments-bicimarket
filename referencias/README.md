# Índice — Documentación Payments App

Bienvenido 👋 Aquí encontrarás toda la documentación para entender, usar y desarrollar la **Payments App**.

Si eres **total principiante**, empieza por aquí:

1. [01 - Introducción](01-intro.md) — ¿Qué es? ¿Cómo funciona?
2. [02 - Setup](02-setup.md) — Configurar todo localmente (30 min)
3. [12 - Paso a Paso](12-ejemplo-paso-a-paso.md) — Tu primer pago (20 min)

Luego, profundiza en temas específicos:

## Índice completo

### Fundamentos

- **[01-intro.md](01-intro.md)** — Qué es Payments App, conceptos clave, stack tecnológico, estructura de carpetas
- **[02-setup.md](02-setup.md)** — Setup local, .env.local, migraciones, troubleshooting inicial
- **[03-db-schema.md](03-db-schema.md)** — Entendiendo la BD, modelos Prisma, relaciones, cómo interactuar

### Desarrollo

- **[04-api-endpoints.md](04-api-endpoints.md)** — Todos los endpoints, requests/responses, ejemplos curl
- **[05-servicios.md](05-servicios.md)** — Servicios de negocio, MercadoPago, settlements, inter-app
- **[06-client-hooks.md](06-client-hooks.md)** — Hooks React, TanStack Query, cómo obtener datos
- **[07-ui-components.md](07-ui-components.md)** — Componentes React disponibles, cómo construir nuevos

### Flujos avanzados

- **[08-flujo-completo.md](08-flujo-completo.md)** — End-to-end: usuario compra → pago aprobado → settlement
- **[09-webhooks.md](09-webhooks.md)** — Cómo funcionan webhooks de MP, registrar, procesar
- **[10-idempotencia-seguridad.md](10-idempotencia-seguridad.md)** — Evitar duplicados, X-Service-Token, auditoría

### Resolución de problemas

- **[11-troubleshooting.md](11-troubleshooting.md)** — Errores comunes y cómo solucionarlos
- **[12-ejemplo-paso-a-paso.md](12-ejemplo-paso-a-paso.md)** — Tutorial práctico: crea tu primer pago

## Rutas de aprendizaje recomendadas

### 🟢 Principiante (Horas 1-2)

```
01-intro
  ↓
02-setup
  ↓
12-ejemplo-paso-a-paso
```

### 🟡 Intermedio (Horas 3-6)

```
(Haber completado Principiante)
  ↓
03-db-schema
  ↓
04-api-endpoints
  ↓
06-client-hooks
```

### 🔴 Avanzado (Horas 7+)

```
(Haber completado Intermedio)
  ↓
05-servicios
  ↓
08-flujo-completo
  ↓
09-webhooks
  ↓
10-idempotencia-seguridad
```

### 🆘 Si tienes problemas

```
11-troubleshooting
  (busca tu error)
    ↓
  si no lo encuentras:
    → 02-setup (verifica config)
    → 12-ejemplo-paso-a-paso (reproduce paso a paso)
```

## Búsqueda rápida

**¿Cómo ...?**

| Pregunta                                       | Respuesta                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| ... configurar localmente?                     | [02-setup.md](02-setup.md)                                          |
| ... crear un pago?                             | [04-api-endpoints.md](04-api-endpoints.md#endpoint-1-crear-un-pago) |
| ... listar pagos?                              | [04-api-endpoints.md](04-api-endpoints.md#endpoint-2-listar-pagos)  |
| ... entender la BD?                            | [03-db-schema.md](03-db-schema.md)                                  |
| ... usar desde React?                          | [06-client-hooks.md](06-client-hooks.md)                            |
| ... construir componentes?                     | [07-ui-components.md](07-ui-components.md)                          |
| ... recibir notificaciones de MP?              | [09-webhooks.md](09-webhooks.md)                                    |
| ... evitar duplicados?                         | [10-idempotencia-seguridad.md](10-idempotencia-seguridad.md)        |
| ... asegurar que solo llamamos apps conocidas? | [10-idempotencia-seguridad.md](10-idempotencia-seguridad.md)        |
| ... resolver un error?                         | [11-troubleshooting.md](11-troubleshooting.md)                      |

## Recursos externos

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [MercadoPago API Docs](https://developers.mercadopago.com/es/reference)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## Convenciones del proyecto

- **Tipos TypeScript**: `src/types/payments.ts`
- **Rutas API**: `src/app/api/v1/*`
- **Servicios**: `src/services/*`
- **Componentes React**: `src/components/*`
- **Hooks**: `src/hooks/*`
- **Utilidades**: `src/lib/*`
- **Prisma ORM**: `prisma/schema.prisma`

## Stack tecnológico

| Tecnología         | Uso                                   |
| ------------------ | ------------------------------------- |
| **Next.js**        | Framework web fullstack               |
| **React**          | UI components                         |
| **TypeScript**     | Tipado seguro                         |
| **Prisma**         | ORM (BD)                              |
| **PostgreSQL**     | Base de datos                         |
| **Tailwind CSS**   | Estilos                               |
| **TanStack Query** | State management (datos del servidor) |
| **Axios**          | HTTP client                           |
| **Clerk**          | Autenticación                         |
| **MercadoPago**    | Procesador de pagos                   |

## Próximos pasos después de aprender todo

1. **Implementar lógica**: Completa los servicios con lógica real
2. **Integrar MercadoPago**: Reemplaza mocks con API real
3. **Tests**: Escribe tests unitarios e integración
4. **Desplegar**: Deploy a Vercel o tu servidor
5. **Monitorear**: Usa Sentry, logs, métricas

---

**¿Preguntas?** Lee primero [11-troubleshooting.md](11-troubleshooting.md). Si no encuentras respuesta, abre un issue.

¡Bienvenido a la Payments App! 🚀
