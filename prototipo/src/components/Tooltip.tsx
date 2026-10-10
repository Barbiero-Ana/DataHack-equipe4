import {useEffect, useState} from 'react';
export function Tooltip() {
  const [tip, setTip] = useState<{parts: string[]; color: string; x: number; y: number} | null>(null);
  useEffect(() => {
    const move = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
      const text = target?.getAttribute('data-tip');
      if (!text) { setTip(null); return; }
      const parts = text.split('<br>').map(p => p.replace(/<[^>]+>/g, ''));
      setTip({parts, color: target?.getAttribute('fill') || '#ff7e70',
        x: Math.max(8, Math.min(innerWidth - 290, event.clientX + 16)),
        y: Math.max(8, Math.min(innerHeight - (parts.length * 25 + 30), event.clientY + 16))});
    };
    const hide = () => setTip(null);
    document.addEventListener('mousemove', move);
    document.addEventListener('click', hide);
    window.addEventListener('blur', hide);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('click', hide); window.removeEventListener('blur', hide); };
  }, []);
  return <div id="tip" role="tooltip" style={{opacity: tip ? 1 : 0, left: tip?.x, top: tip?.y, borderLeftColor: tip?.color}}>
    {tip && <><div className="t-h">{tip.parts[0]}</div>{tip.parts.slice(1).map((part, i) => {
      const separator = part.indexOf(': ');
      return separator > 0 ? <div className="t-r" key={i}><span>{part.slice(0, separator)}</span><b>{part.slice(separator + 2)}</b></div> : <div className="t-n" key={i}>{part}</div>;
    })}</>}
  </div>;
}
