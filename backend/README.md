# Backend Pedidos360 — AWS Lambda (Node.js 22, ESM) + DynamoDB

Una Lambda por ruta, detrás de una **HTTP API** con **JWT Authorizer** (Entra ID).

## Seguridad: validación del token en dos capas

1. **API Gateway (JWT Authorizer)** rechaza con 401 cualquier petición sin token válido.
2. **Cada Lambda (BFF) vuelve a validar el token** (`shared/jwt.mjs`) sin confiar en el gateway:
   - **Firma** RS256 contra las llaves públicas (JWKS) del tenant, con cache y soporte de rotación (`kid`).
   - **Issuer** = `https://login.microsoftonline.com/<TENANT_ID>/v2.0`.
   - **Audience** = el client ID de `Pedidos360-API` (con o sin `api://`).
   - **Vigencia**: `exp` y `nbf`, con 60 s de tolerancia de reloj.
   - Solo acepta `alg: RS256`, así que un token con `alg: none` o alterado es rechazado.
3. Después aplica **autorización** por scope (`scp`) y rol (`roles`) → 403.

| Ruta                | Lambda                 | Scope requerido | Rol requerido                          |
|---------------------|------------------------|-----------------|----------------------------------------|
| `GET /orders`       | `p360-orders-list`     | `orders.read`   | cualquiera (Cliente ve solo los suyos) |
| `POST /orders`      | `p360-orders-create`   | `orders.write`  | Admin, Operador o Cliente              |
| `GET /catalog`      | `p360-catalog-list`    | `catalog.read`  | cualquiera                             |
| `PUT /catalog/{id}` | `p360-catalog-update`  | `catalog.write` | **Admin**                              |

Códigos de error: `400` datos inválidos · `401` token ausente o inválido · `403` falta scope o rol ·
`404` producto inexistente · `409` stock insuficiente · `500` error interno.

## Base de datos: Amazon DynamoDB

| Tabla          | Clave (String) | Contenido |
|----------------|----------------|-----------|
| `p360-catalog` | `id`           | productos (`name`, `price`, `stock`); se carga con 3 productos si está vacía |
| `p360-orders`  | `id` (UUID)    | pedidos (`owner`, `productId`, `productName`, `qty`, `total`, `status`, `createdAt`) |

El acceso está en `shared/data.mjs` (repositorio). Crear un pedido descuenta el stock y
guarda el pedido en **una sola transacción** (`TransactWriteItems`): si no hay stock, no se guarda nada.
El AWS SDK v3 viene incluido en el runtime de Lambda, así que no hay `node_modules` que subir.

## Variables de entorno (las 4 Lambdas)

| Variable        | Valor |
|-----------------|-------|
| `TENANT_ID`     | Tenant ID de Entra ID |
| `AUDIENCE`      | `<BACKEND_ID>,api://<BACKEND_ID>` |
| `CATALOG_TABLE` | `p360-catalog` |
| `ORDERS_TABLE`  | `p360-orders` |

## Pruebas

```bash
node --test backend/test/*.test.mjs
```

Usan una llave RSA propia y un repositorio en memoria (sin red ni AWS). Cubren token válido,
firma falsa, `kid` desconocido, `alg: none`, issuer/audience incorrectos, token expirado,
payload alterado, 403 por scope/rol y el flujo de pedidos con stock.

## Desplegar (CloudShell del Learner Lab)

```bash
API=<API_ID>; TENANT=<TENANT_ID>; BACKEND=<BACKEND_ID>
ROLE=$(aws iam get-role --role-name LabRole --query Role.Arn --output text)

# Tablas
for t in p360-catalog p360-orders; do
  aws dynamodb create-table --table-name $t --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH
done

# Código (las 4 funciones usan el mismo zip; handler = <carpeta>/index.handler)
cd backend && zip -qr ../p360.zip orders-list orders-create catalog-list catalog-update shared && cd ..
for f in orders-list orders-create catalog-list catalog-update; do
  aws lambda create-function --function-name p360-$f --runtime nodejs22.x --role $ROLE \
    --handler $f/index.handler --zip-file fileb://p360.zip --timeout 10 \
    --environment "{\"Variables\":{\"TENANT_ID\":\"$TENANT\",\"AUDIENCE\":\"$BACKEND,api://$BACKEND\",\"CATALOG_TABLE\":\"p360-catalog\",\"ORDERS_TABLE\":\"p360-orders\"}}"
done
```

Luego, en la HTTP API, integra cada ruta con su Lambda (payload format **2.0**) y
adjunta el JWT Authorizer a todas (ver `docs/CHECKLIST.md`).
