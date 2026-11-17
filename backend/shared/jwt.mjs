// Validación completa del access token de Entra ID dentro de la Lambda (BFF).
// API Gateway ya valida el token, pero el backend NO confía ciegamente en él:
// vuelve a verificar firma (RS256 contra las llaves públicas JWKS del tenant),
// issuer, audience, expiración (exp) y "no antes de" (nbf).
// Solo usa módulos nativos de Node (crypto + fetch): sin dependencias externas.
import { createPublicKey, createVerify } from 'node:crypto';

const TENANT_ID = process.env.TENANT_ID;
const AUDIENCES = String(process.env.AUDIENCE ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
const JWKS_URL = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;
const CLOCK_SKEW_S = 60; // tolerancia de reloj

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

// Cache de llaves entre invocaciones (vive mientras la Lambda esté "caliente").
let jwksCache = { keys: new Map(), fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000;

// Permite inyectar un fetch falso en las pruebas.
let fetchImpl = (...args) => fetch(...args);
export function __setFetch(fn) {
  fetchImpl = fn;
  jwksCache = { keys: new Map(), fetchedAt: 0 };
}

async function loadJwks() {
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new AuthError(`No se pudo obtener JWKS (${res.status})`);
  const { keys } = await res.json();
  jwksCache = {
    keys: new Map(keys.filter((k) => k.kty === 'RSA').map((k) => [k.kid, k])),
    fetchedAt: Date.now(),
  };
}

async function getKey(kid) {
  const stale = Date.now() - jwksCache.fetchedAt > JWKS_TTL_MS;
  if (stale || !jwksCache.keys.has(kid)) await loadJwks(); // rotación de llaves
  const jwk = jwksCache.keys.get(kid);
  if (!jwk) throw new AuthError('Llave de firma desconocida (kid)');
  return createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
}

const b64urlJson = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/** Verifica el JWT y devuelve sus claims. Lanza AuthError si no es válido. */
export async function verifyToken(token) {
  if (!TENANT_ID || AUDIENCES.length === 0) {
    throw new Error('Faltan variables de entorno TENANT_ID / AUDIENCE');
  }
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new AuthError('Token mal formado');
  const [h, p, s] = parts;

  let header, claims;
  try {
    header = b64urlJson(h);
    claims = b64urlJson(p);
  } catch {
    throw new AuthError('Token mal formado');
  }
  if (header.alg !== 'RS256') throw new AuthError('Algoritmo no permitido');

  // 1) Firma
  const key = await getKey(header.kid);
  const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, Buffer.from(s, 'base64url'));
  if (!ok) throw new AuthError('Firma inválida');

  // 2) Issuer y audience
  if (claims.iss !== ISSUER) throw new AuthError('Issuer inválido');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some((a) => AUDIENCES.includes(a))) throw new AuthError('Audience inválido');

  // 3) Vigencia
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || now > claims.exp + CLOCK_SKEW_S) {
    throw new AuthError('Token expirado');
  }
  if (typeof claims.nbf === 'number' && now + CLOCK_SKEW_S < claims.nbf) {
    throw new AuthError('Token aún no válido');
  }
  return claims;
}

export function bearerFrom(event) {
  const headers = event.headers ?? {};
  const value = headers.authorization ?? headers.Authorization ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(value);
  return m ? m[1] : null;
}
