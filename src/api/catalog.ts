// Dominio catalog. Scopes: catalog.read (GET) / catalog.write + rol Admin (PUT).
import type { ApiClient } from './client';
import { asList } from './list';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export async function listCatalog(api: ApiClient): Promise<Product[]> {
  return asList<Product>(await api.get<unknown>('/catalog'));
}

export function updateProduct(
  api: ApiClient,
  id: string,
  changes: Partial<Pick<Product, 'name' | 'price' | 'stock'>>,
): Promise<Product> {
  return api.put<Product>(`/catalog/${encodeURIComponent(id)}`, changes);
}
