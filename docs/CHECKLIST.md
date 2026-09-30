# Checklist Pedidos360 (guía v2) — lo que se hace en los portales

El código de este repo ya cubre: MSAL (`initialize()`, PKCE, fallback a redirect),
guards `RequireAuth`/`RequireRole`, scopes por dominio y Lambdas en `backend/`.
Falta configurar Azure y AWS con estos valores exactos.

## 1. Tenant (cuenta Azure for Students)
- [ ] Entra ID **estándar** (no External ID). Cambiar al directorio nuevo antes de registrar apps.
- [ ] MFA con Microsoft Authenticator. (Puede pedir step-up al primer token de la API: normal.)

## 2. App `Pedidos360-API` (registrar primero)
- [ ] Solo este directorio, sin Redirect URI. Copiar su **client ID** → `<BACKEND_ID>`.
- [ ] Exponer una API: URI `api://<BACKEND_ID>` + 4 ámbitos: `orders.read`, `orders.write`, `catalog.read`, `catalog.write` (Admins y usuarios).
- [ ] App roles (Users/Groups): `Admin`, `Operador`, `Cliente`.
- [ ] Manifest → `api.requestedAccessTokenVersion: 2`.

## 3. App `Pedidos360-Frontend`
- [ ] Plataforma **SPA** (no Web), Redirect URI `http://localhost:5173`.
- [ ] API permissions → My APIs → Pedidos360-API → los 4 scopes + **Grant admin consent**.
- [ ] Client ID y Tenant ID → `.env` (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`).

## 4. Usuarios
- [ ] Crear `admin@…`, `operador@…`, `cliente@…`.
- [ ] Enterprise applications → Pedidos360-API → Users and groups → asignar el App Role a cada uno.

## 5. AWS
- [ ] Desplegar las 4 Lambdas (`backend/README.md`).
- [ ] HTTP API con rutas `GET/POST /orders`, `GET /catalog`, `PUT /catalog/{id}`.
- [ ] JWT Authorizer en **todas** las rutas (v2, coherente):
  - Issuer: `https://login.microsoftonline.com/<TENANT_ID>/v2.0`
  - Audience: `<BACKEND_ID>` (GUID pelado, sin `api://`)
- [ ] CORS: origin `http://localhost:5173`; headers `authorization, content-type`;
      methods `GET, POST, PUT, DELETE, OPTIONS`; max-age `300`.
  ```bash
  aws apigatewayv2 update-api --api-id <API_ID> --region us-east-1 \
    --cors-configuration AllowOrigins="http://localhost:5173",AllowMethods="GET,POST,PUT,DELETE,OPTIONS",AllowHeaders="authorization,content-type",MaxAge=300
  ```

## 6. `.env` y verificación
- [ ] `cp .env.example .env`; completar `VITE_API_BASE_URL` y los 4 scopes con `<BACKEND_ID>`.
- [ ] `corepack pnpm install && corepack pnpm dev`.
- [ ] En `/dashboard` → "Obtener e inspeccionar token": `aud = <BACKEND_ID>`, `iss` termina en `/v2.0`,
      `scp` con los 4 scopes, `roles` con el rol asignado. Pegarlo también en jwt.ms.
- [ ] Probar: Cliente → `/orders` y `/catalog` OK, `/admin` bloqueado.
      Admin → `/admin` permite editar precio (PUT); Operador recibe 403 al intentarlo por API.
