import {useEffect, useRef, useState} from 'react';
import {pages} from '../pages';
import type {DemoFilters, PageId} from '../pages';

// A ilha de gráficos conserva os renderizadores SVG do protótipo original.
// React controla ciclo de vida e navegação; apenas este módulo escreve dentro das seções.
export function DemoPages({filters, current, navigate}: {
  filters: DemoFilters; current: PageId; navigate: (id: PageId) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const instance = useRef<{update: (filters: DemoFilters) => void} | null>(null);
  const latest = useRef(filters);
  latest.current = filters;
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    import('../demo/renderer.js').then(({createDemo}) => {
      if (disposed || !root.current) return;
      instance.current = createDemo(root.current, latest.current, navigate);
    }).catch(() => { if (!disposed) setError('Não foi possível abrir a demonstração. Recarregue a página.'); });
    return () => { disposed = true; instance.current = null; };
  }, [navigate]);
  useEffect(() => { instance.current?.update(filters); }, [filters]);
  return <div className="viewport" ref={root}>
    {error && <p role="alert" className="data-banner">{error}</p>}
    <div className="track" style={{transform: `translateX(-${pages.findIndex(p => p.id === current) * 100}%)`}}>
      {pages.map(page => <section key={page.id} id={`pg-${page.id}`} className="page"
        aria-label={page.title} aria-hidden={page.id !== current} inert={page.id !== current}/>)}</div>
  </div>;
}
