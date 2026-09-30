// POST /orders — scope orders.write; roles Operador o Cliente (Admin también).
import { getAuth, json, requireRole, requireScope } from '../shared/auth.mjs';
import { catalog, orders } from '../shared/data.mjs';

export const handler = async (event) => {
  const auth = getAuth(event);
  const denied =
    requireScope(auth, 'orders.write') ?? requireRole(auth, 'Admin', 'Operador', 'Cliente');
  if (denied) return denied;

  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'JSON inválido' });
  }

  const product = catalog.find((p) => p.id === body.productId);
  const qty = Number(body.qty);
  if (!product) return json(400, { error: 'productId inválido' });
  if (!Number.isInteger(qty) || qty < 1) return json(400, { error: 'qty debe ser entero >= 1' });
  if (qty > product.stock) return json(409, { error: 'Stock insuficiente' });

  product.stock -= qty;
  const order = {
    id: `o${orders.length + 1}`,
    owner: auth.sub,
    productId: product.id,
    productName: product.name,
    qty,
    total: product.price * qty,
    status: 'CREADO',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return json(201, order);
};
