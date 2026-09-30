// Vista protegida por RequireAuth: GET /orders (orders.read) y POST /orders (orders.write).
import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import { listOrders, createOrder, type Order } from './api/orders';
import { listCatalog, type Product } from './api/catalog';
import { describeError } from './errors';

export function Orders() {
  const api = useApi();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [o, p] = await Promise.all([listOrders(api), listCatalog(api)]);
      setOrders(o);
      setProducts(p);
      setProductId((cur) => cur || p[0]?.id || '');
    } catch (e) {
      setError(describeError(e));
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async () => {
    if (!api || !productId) return;
    setSaving(true);
    setError(null);
    try {
      await createOrder(api, { productId, qty });
      await reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <h2>Pedidos</h2>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          style={{ width: '5rem' }}
        />
        <button className="btn btn-login" onClick={handleCreate} disabled={saving || !productId}>
          {saving ? 'Creando…' : 'Crear pedido'}
        </button>
      </div>

      {error && <p style={{ color: '#d9534f', wordBreak: 'break-word' }}>{error}</p>}
      {!orders && !error && <p>Cargando…</p>}
      {orders && orders.length === 0 && <p>Aún no hay pedidos.</p>}
      {orders && orders.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th align="left">Pedido</th><th align="left">Producto</th><th align="right">Cant.</th><th align="right">Total</th><th align="left">Estado</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.productName}</td>
                <td align="right">{o.qty}</td>
                <td align="right">${o.total.toLocaleString('es-CL')}</td>
                <td>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
