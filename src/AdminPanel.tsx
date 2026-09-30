// Protegida por <RequireRole role="Admin"/>. Edita el catálogo: PUT /catalog/{id}
// (scope catalog.write). La Lambda vuelve a exigir el rol Admin: este guard es UX.
import { useEffect, useState } from 'react';
import { useApi } from './useApi';
import { listCatalog, updateProduct, type Product } from './api/catalog';
import { describeError } from './errors';

export function AdminPanel() {
  const api = useApi();
  const [items, setItems] = useState<Product[] | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    listCatalog(api)
      .then((d) => {
        if (cancelled) return;
        setItems(d);
        setPrices(Object.fromEntries(d.map((p) => [p.id, p.price])));
      })
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const save = async (p: Product) => {
    if (!api) return;
    setMsg(null);
    setError(null);
    try {
      const updated = await updateProduct(api, p.id, { price: prices[p.id] });
      setItems((cur) => cur?.map((x) => (x.id === p.id ? updated : x)) ?? cur);
      setMsg(`"${p.name}" actualizado.`);
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <h2>Panel de Admin — Catálogo</h2>
      <p className="subtitle">Solo visible con el App Role <code>Admin</code>.</p>
      {msg && <p style={{ color: '#2e7d32' }}>{msg}</p>}
      {error && <p style={{ color: '#d9534f', wordBreak: 'break-word' }}>{error}</p>}
      {!items && !error && <p>Cargando…</p>}
      {items?.map((p) => (
        <div key={p.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.5rem 0' }}>
          <span style={{ flex: 1 }}>{p.name}</span>
          <input
            type="number"
            min={0}
            value={prices[p.id] ?? p.price}
            onChange={(e) => setPrices((cur) => ({ ...cur, [p.id]: Number(e.target.value) }))}
            style={{ width: '7rem' }}
          />
          <button className="btn btn-login" onClick={() => save(p)}>Guardar</button>
        </div>
      ))}
    </div>
  );
}
