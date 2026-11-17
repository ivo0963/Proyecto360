// POST /orders — scope orders.write; roles Admin, Operador o Cliente.
import { authenticate, json, requireRole, requireScope } from '../shared/auth.mjs';
import { ConflictError, data } from '../shared/data.mjs';

export const handler = async (event) => {
  const { auth, error } = await authenticate(event);
  if (error) return error;
  const denied =
    requireScope(auth, 'orders.write') ?? requireRole(auth, 'Admin', 'Operador', 'Cliente');
  if (denied) return denied;

  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'JSON inválido' });
  }

  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1) return json(400, { error: 'qty debe ser entero >= 1' });

  try {
    const product = typeof body.productId === 'string' ? await data.getProduct(body.productId) : null;
    if (!product) return json(400, { error: 'productId inválido' });
    if (qty > product.stock) return json(409, { error: 'Stock insuficiente' });
    const order = await data.createOrder({ owner: auth.sub, product, qty });
    return json(201, order);
  } catch (err) {
    if (err instanceof ConflictError) return json(409, { error: err.message });
    console.error(err);
    return json(500, { error: 'Error al crear el pedido' });
  }
};
