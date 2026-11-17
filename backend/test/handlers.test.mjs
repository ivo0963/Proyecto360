// Pruebas básicas del backend: `node --test backend/test`
// Usan una llave RSA generada en la prueba (en vez de Entra ID) y un repositorio
// en memoria (en vez de DynamoDB), así que corren sin red ni cuenta AWS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';

const TENANT = '11111111-2222-3333-4444-555555555555';
const API_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
process.env.TENANT_ID = TENANT;
process.env.AUDIENCE = `${API_ID},api://${API_ID}`;

const { __setFetch } = await import('../shared/jwt.mjs');
const { __setRepo, ConflictError } = await import('../shared/data.mjs');
const catalogList = (await import('../catalog-list/index.mjs')).handler;
const catalogUpdate = (await import('../catalog-update/index.mjs')).handler;
const ordersList = (await import('../orders-list/index.mjs')).handler;
const ordersCreate = (await import('../orders-create/index.mjs')).handler;

// --- Llaves y JWKS falsos ---
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig' };
__setFetch(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims, { key = privateKey, kid = 'k1', alg = 'RS256' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
    aud: API_ID,
    iat: now,
    nbf: now,
    exp: now + 3600,
    oid: 'user-1',
    ...claims,
  };
  const head = b64({ alg, typ: 'JWT', kid });
  const body = b64(payload);
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const ev = (token, extra = {}) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
  ...extra,
});
const parse = (r) => ({ status: r.statusCode, body: JSON.parse(r.body) });

// --- Repositorio en memoria ---
function memoryRepo() {
  const catalog = new Map([['p1', { id: 'p1', name: 'Teclado', price: 1000, stock: 2 }]]);
  const orders = [];
  return {
    async listCatalog() { return [...catalog.values()]; },
    async getProduct(id) { return catalog.get(id) ?? null; },
    async updateProduct(id, ch) {
      if (!catalog.has(id)) return null;
      Object.assign(catalog.get(id), ch);
      return catalog.get(id);
    },
    async listOrders(owner) { return orders.filter((o) => owner == null || o.owner === owner); },
    async createOrder({ owner, product, qty }) {
      if (product.stock < qty) throw new ConflictError('Stock insuficiente');
      product.stock -= qty;
      const o = { id: `o${orders.length + 1}`, owner, productId: product.id, qty, total: product.price * qty };
      orders.push(o);
      return o;
    },
  };
}

const ALL = 'orders.read orders.write catalog.read catalog.write';

test('token válido → 200', async () => {
  __setRepo(memoryRepo());
  const r = parse(await catalogList(ev(sign({ scp: 'catalog.read', roles: ['Cliente'] }))));
  assert.equal(r.status, 200);
  assert.equal(r.body[0].id, 'p1');
});

test('acepta audience con prefijo api://', async () => {
  const r = await catalogList(ev(sign({ aud: `api://${API_ID}`, scp: 'catalog.read' })));
  assert.equal(r.statusCode, 200);
});

test('sin token → 401', async () => {
  assert.equal((await catalogList(ev(null))).statusCode, 401);
});

for (const [name, token] of [
  ['firma de otra llave', () => sign({ scp: ALL }, { key: otherKey })],
  ['kid desconocido', () => sign({ scp: ALL }, { kid: 'nope' })],
  ['alg none', () => sign({ scp: ALL }, { alg: 'none' })],
  ['issuer incorrecto', () => sign({ scp: ALL, iss: 'https://evil.example/v2.0' })],
  ['audience incorrecto', () => sign({ scp: ALL, aud: 'otra-api' })],
  ['token expirado', () => sign({ scp: ALL, exp: Math.floor(Date.now() / 1000) - 600 })],
  ['token aún no válido', () => sign({ scp: ALL, nbf: Math.floor(Date.now() / 1000) + 600 })],
  ['payload alterado', () => {
    const [h, , s] = sign({ scp: 'catalog.read' }).split('.');
    return `${h}.${b64({ scp: ALL, roles: ['Admin'] })}.${s}`;
  }],
  ['basura', () => 'abc.def'],
]) {
  test(`${name} → 401`, async () => {
    assert.equal((await catalogList(ev(token()))).statusCode, 401);
  });
}

test('sin scope → 403', async () => {
  const r = await catalogList(ev(sign({ scp: 'orders.read' })));
  assert.equal(r.statusCode, 403);
});

test('PUT catálogo: Operador → 403, Admin → 200', async () => {
  __setRepo(memoryRepo());
  const put = (roles) =>
    catalogUpdate(ev(sign({ scp: ALL, roles }), { pathParameters: { id: 'p1' }, body: '{"price":500}' }));
  assert.equal((await put(['Operador'])).statusCode, 403);
  const r = parse(await put(['Admin']));
  assert.equal(r.status, 200);
  assert.equal(r.body.price, 500);
});

test('PUT catálogo: 404 y 400', async () => {
  const t = sign({ scp: ALL, roles: ['Admin'] });
  assert.equal((await catalogUpdate(ev(t, { pathParameters: { id: 'zz' }, body: '{"price":1}' }))).statusCode, 404);
  assert.equal((await catalogUpdate(ev(t, { pathParameters: { id: 'p1' }, body: '{"price":-1}' }))).statusCode, 400);
});

test('pedidos: crear, stock, y Cliente solo ve los suyos', async () => {
  __setRepo(memoryRepo());
  const c1 = sign({ scp: ALL, roles: ['Cliente'], oid: 'c1' });
  const c2 = sign({ scp: ALL, roles: ['Cliente'], oid: 'c2' });
  const admin = sign({ scp: ALL, roles: ['Admin'], oid: 'a' });
  const post = (t, body) => ordersCreate(ev(t, { body: JSON.stringify(body) }));

  assert.equal((await post(c1, { productId: 'p1', qty: 1 })).statusCode, 201);
  assert.equal((await post(c2, { productId: 'p1', qty: 5 })).statusCode, 409);
  assert.equal((await post(c2, { productId: 'nope', qty: 1 })).statusCode, 400);
  assert.equal((await post(c2, { productId: 'p1', qty: 0 })).statusCode, 400);

  assert.equal(parse(await ordersList(ev(c1))).body.length, 1);
  assert.equal(parse(await ordersList(ev(c2))).body.length, 0);
  assert.equal(parse(await ordersList(ev(admin))).body.length, 1);
});
