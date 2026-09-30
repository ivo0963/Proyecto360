// Vista protegida por RequireAuth: GET /catalog (scope catalog.read).
import { useEffect, useState } from 'react';
import { useApi } from './useApi';
import { listCatalog, type Product } from './api/catalog';
import { describeError } from './errors';

export function Catalog() {
  const api = useApi();
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    listCatalog(api)
      .then((d) => !cancelled && setItems(d))
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <h2>Catálogo</h2>
      {error && <p style={{ color: '#d9534f', wordBreak: 'break-word' }}>{error}</p>}
      {!items && !error && <p>Cargando…</p>}
      {items && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th align="left">Producto</th><th align="right">Precio</th><th align="right">Stock</th></tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td align="right">${p.price.toLocaleString('es-CL')}</td>
                <td align="right">{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
