# Pedidos360 · Entra ID + React + AWS (starter)

**DSY1107 · Desarrollo Cloud Native I** — starter de referencia para la
integración de autenticación/autorización del caso **Pedidos360**: frontend
en React (MSAL) + backend en AWS Lambda detrás de API Gateway, protegido con
Microsoft Entra ID.

📘 **Empieza por la guía**: [`docs/guia_entra_id_v2.html`](./docs/guia_entra_id_v2.html)
(descárgala y ábrela en el navegador — trae los pasos completos: tenant,
registro de las dos apps, roles, MSAL, JWT Authorizer, CORS y errores
comunes).

## Qué trae

- Login/logout con **MSAL React** (Authorization Code + PKCE), `initialize()` antes de renderizar.
- `ApiClient` reutilizable (`src/api/client.ts`) con token de la API y fallback a `acquireTokenRedirect`.
- Dominios: `src/api/orders.ts` (`orders.read/write`) y `src/api/catalog.ts` (`catalog.read/write`).
- **Guards de ruta** con `react-router-dom`:
  - `RequireAuth` — autenticación (layout route).
  - `RequireRole` — autorización por App Role (`Admin`, `Operador`, `Cliente`); solo UX.
  - Rutas: `/` (pública), `/dashboard`, `/orders`, `/catalog` (sesión) y `/admin` (rol `Admin`).
- `TokenInspector` para ver `aud`, `iss`, `scp`, `roles`, `exp`.
- `backend/`: 4 Lambdas (Node ESM) que revalidan `scp` y `roles` (ver `backend/README.md`).
- `docs/CHECKLIST.md`: pasos de Azure/AWS con los valores exactos.

## Quick start

```bash
corepack pnpm install   # este repo usa pnpm (pnpm-lock.yaml); corepack viene con Node
cp .env.example .env    # completa con los valores de TU tenant (ver docs/CHECKLIST.md y la guía)
corepack pnpm dev       # http://localhost:5173
```

Otros comandos: `corepack pnpm build` (build + type-check), `corepack pnpm lint` (oxlint).

## Stack

React 19 · Vite 8 · TypeScript · `@azure/msal-browser` / `@azure/msal-react` ·
`react-router-dom` · AWS API Gateway (HTTP API) + Lambda (backend, repo aparte).

---

Basado en la plantilla [docentedev/cloud-01-entra-app-integration](https://github.com/docentedev/cloud-01-entra-app-integration),
extendido con el flujo de token hacia un backend propio, guards de ruta, y la
guía adaptada al caso Pedidos360.
