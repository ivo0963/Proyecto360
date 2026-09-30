// PUT /catalog/{id} — scope catalog.write Y rol Admin
import { getAuth, json, requireRole, requireScope } from '../shared/auth.mjs';
import { catalog } from '../shared/data.mjs';

export const handler = async (event) => {
  const auth = getAuth(event);
  const denied = requireScope(auth, 'catalog.write') ?? requireRole(auth, 'Admin');
  if (denied) return denied;

  const product = catalog.find((p) => p.id === event.pathParameters?.id);
  if (!product) return json(404, { error: 'Producto no encontrado' });

  let changes;
  try {
    changes = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'JSON inválido' });
  }
  if (changes.name !== undefined) product.name = String(changes.name);
  if (Number.isFinite(changes.price) && changes.price >= 0) product.price = changes.price;
  if (Number.isInteger(changes.stock) && changes.stock >= 0) product.stock = changes.stock;

  return json(200, product);
};
