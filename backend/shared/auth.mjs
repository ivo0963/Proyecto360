// Helpers compartidos. API Gateway (HTTP API + JWT Authorizer) YA validó firma,
// issuer, audience y exp: aquí solo se leen claims y se aplican reglas de negocio.

// En HTTP API los claims que en el JWT son ARRAY (roles) llegan achatados a
// string (p.ej. "[Admin Operador]"); scp llega como "orders.read orders.write".
// Este split cubre espacio, coma y corchetes. Ante dudas:
//   console.log(JSON.stringify(event.requestContext.authorizer))
const split = (v) => String(v ?? '').split(/[\s,\[\]"]+/).filter(Boolean);

export function getAuth(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {};
  return {
    sub: claims.oid ?? claims.sub ?? 'unknown',
    roles: split(claims.roles),
    scopes: split(claims.scp),
  };
}

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Devuelve una respuesta 403 si falta el scope, o null si todo OK.
export function requireScope(auth, scope) {
  return auth.scopes.includes(scope)
    ? null
    : json(403, { error: `Requiere scope ${scope}` });
}

// Devuelve una respuesta 403 si no tiene ninguno de los roles, o null si OK.
export function requireRole(auth, ...allowed) {
  return allowed.some((r) => auth.roles.includes(r))
    ? null
    : json(403, { error: `Requiere rol ${allowed.join(' o ')}` });
}
