# Backend Pedidos360 — AWS Lambda (Node.js 20+, ESM)

Una Lambda por ruta, detrás de una **HTTP API** con **JWT Authorizer** (Entra ID).
Las Lambdas no validan firma/issuer/audience (lo hace API Gateway); solo aplican
reglas de negocio con `scp` (scopes) y `roles` (App Roles).

| Ruta                | Lambda            | Scope requerido | Rol requerido                 |
|---------------------|-------------------|-----------------|-------------------------------|
| `GET /orders`       | `orders-list`     | `orders.read`   | cualquiera (Cliente ve solo los suyos) |
| `POST /orders`      | `orders-create`   | `orders.write`  | Admin, Operador o Cliente     |
| `GET /catalog`      | `catalog-list`    | `catalog.read`  | cualquiera                    |
| `PUT /catalog/{id}` | `catalog-update`  | `catalog.write` | **Admin**                     |

## Empaquetar y desplegar

Cada Lambda importa `../shared/*`, así que se sube la carpeta con `shared/` incluida.
Handler: `<carpeta>/index.handler`.

```bash
cd backend
zip -r pedidos360-lambdas.zip orders-list orders-create catalog-list catalog-update shared
# Crea 4 funciones (runtime nodejs20.x) con ESE mismo zip y handler:
#   orders-list/index.handler, orders-create/index.handler, ...
```

Luego en la HTTP API: integra cada ruta con su Lambda (payload format **2.0**)
y adjunta el JWT Authorizer a todas (ver `docs/CHECKLIST.md`).

> Los datos viven en memoria (`shared/data.mjs`) y se reinician con cada cold
> start: es solo para el ejercicio. Usa DynamoDB/RDS para persistir.
