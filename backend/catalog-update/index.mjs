// PUT /catalog/{id} — scope catalog.write Y rol Admin
import { authenticate, json, requireRole, requireScope } from '../shared/auth.mjs';
import { data } from '../shared/data.mjs';

export const handler = async (event) => {
  const { auth, error } = await authenticate(event);
  if (error) return error;
  const denied = requireScope(auth, 'catalog.write') ?? requireRole(auth, 'Admin');
  if (denied) return denied;

  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'JSON inválido' });
  }

  const changes = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return json(400, { error: 'name inválido' });
    changes.name = body.name.trim();
  }
  if (body.price !== undefined) {
    if (!Number.isFinite(body.price) || body.price < 0) return json(400, { error: 'price debe ser número >= 0' });
    changes.price = body.price;
  }
  if (body.stock !== undefined) {
    if (!Number.isInteger(body.stock) || body.stock < 0) return json(400, { error: 'stock debe ser entero >= 0' });
    changes.stock = body.stock;
  }

  try {
    const product = await data.updateProduct(event.pathParameters?.id, changes);
    if (!product) return json(404, { error: 'Producto no encontrado' });
    return json(200, product);
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Error al actualizar el producto' });
  }
};
