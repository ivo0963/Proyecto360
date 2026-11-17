// Autenticación y autorización del BFF.
// 1) authenticate(): valida el JWT de Entra ID (firma, issuer, audience, exp)
//    con shared/jwt.mjs. Si falla → 401. (API Gateway también lo valida: doble capa.)
// 2) requireScope()/requireRole(): reglas de negocio con scp y roles → 403.
import { AuthError, bearerFrom, verifyToken } from './jwt.mjs';

const toList = (v) =>
  Array.isArray(v) ? v.map(String) : String(v ?? '').split(/\s+/).filter(Boolean);

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * Devuelve { auth } si el token es válido, o { error } con la respuesta 401/500.
 */
export async function authenticate(event) {
  const token = bearerFrom(event);
  if (!token) return { error: json(401, { error: 'Falta el header Authorization: Bearer <token>' }) };
  try {
    const claims = await verifyToken(token);
    return {
      auth: {
        sub: claims.oid ?? claims.sub,
        name: claims.name ?? claims.preferred_username ?? null,
        roles: toList(claims.roles),
        scopes: toList(claims.scp),
      },
    };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: json(401, { error: 'Token inválido', detalle: err.message }) };
    }
    console.error(err);
    return { error: json(500, { error: 'Error interno al validar el token' }) };
  }
}

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
