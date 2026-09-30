// GET /catalog — scope catalog.read (cualquier rol autenticado)
import { getAuth, json, requireScope } from '../shared/auth.mjs';
import { catalog } from '../shared/data.mjs';

export const handler = async (event) => {
  const auth = getAuth(event);
  const denied = requireScope(auth, 'catalog.read');
  if (denied) return denied;
  return json(200, catalog);
};
