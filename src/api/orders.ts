// Dominio orders. Scopes: orders.read (GET) / orders.write (POST).
import type { ApiClient } from './client';
import { asList } from './list';

export interface Order {
  id: string;
  owner: string;
  productId: string;
  productName: string;
  qty: number;
  total: number;
  status: string;
  createdAt: string;
}

export async function listOrders(api: ApiClient): Promise<Order[]> {
  return asList<Order>(await api.get<unknown>('/orders'));
}

export function createOrder(
  api: ApiClient,
  input: { productId: string; qty: number },
): Promise<Order> {
  return api.post<Order>('/orders', input);
}
