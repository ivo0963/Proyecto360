// GET /orders — scope orders.read.
// Admin/Operador ven todos los pedidos; Cliente solo los suyos.
import { authenticate, json, requireScope } from '../shared/auth.mjs';
import { data } from '../shared/data.mjs';

export const handler = async (event) => {
  const { auth, error } = await authenticate(event);
  if (error) return error;
  const denied = requireScope(auth, 'orders.read');
  if (denied) return denied;

  const seesAll = auth.roles.includes('Admin') || auth.roles.includes('Operador');
  try {
    return json(200, await data.listOrders(seesAll ? null : auth.sub));
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Error al leer los pedidos' });
  }
};
