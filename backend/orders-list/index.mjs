// GET /orders — scope orders.read.
// Admin/Operador ven todos los pedidos; Cliente solo los suyos.
import { getAuth, json, requireScope } from '../shared/auth.mjs';
import { orders } from '../shared/data.mjs';

export const handler = async (event) => {
  const auth = getAuth(event);
  const denied = requireScope(auth, 'orders.read');
  if (denied) return denied;

  const seesAll = auth.roles.includes('Admin') || auth.roles.includes('Operador');
  return json(200, seesAll ? orders : orders.filter((o) => o.owner === auth.sub));
};
