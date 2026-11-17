// GET /catalog — scope catalog.read (cualquier rol autenticado)
import { authenticate, json, requireScope } from '../shared/auth.mjs';
import { data } from '../shared/data.mjs';

export const handler = async (event) => {
  const { auth, error } = await authenticate(event);
  if (error) return error;
  const denied = requireScope(auth, 'catalog.read');
  if (denied) return denied;
  try {
    return json(200, await data.listCatalog());
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Error al leer el catálogo' });
  }
};
