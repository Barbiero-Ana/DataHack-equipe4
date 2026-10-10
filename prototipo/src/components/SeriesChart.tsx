import type {AnnualRecord} from '../api/types';
const colors = ['#145c63', '#8ccfcb', '#ff7e70', '#e9a23b'];
const groups = [['1', '1', 'Pública presencial'], ['1', '2', 'Pública EAD'],
  ['2', '1', 'Privada presencial'], ['2', '2', 'Privada EAD']] as const;
type Metric = 'qt_mat' | 'evasao_estimada_pct';
export function SeriesChart({rows, metric}: {rows: AnnualRecord[]; metric: Metric}) {
  const years = [...new Set(rows.map(r => r.year))].sort();
  const series = groups.map(([network, modality, label], i) => ({label, color: colors[i],
    rows: years.map(year => rows.find(r => r.year === year && r.network === network && r.modality === modality))}))
    .filter(s => s.rows.some(Boolean));
  const values = rows.flatMap(r => r[metric] === null ? [] : [r[metric]!]);
  if (!values.length) return <p className="empty">Sem valores disponíveis para traçar este indicador.</p>;
  const lo = Math.min(0, ...values), hi = Math.max(metric === 'evasao_estimada_pct' ? 10 : 1, ...values);
  const bottom = 250, top = 25, left = 75, right = 660;
  const x = (i: number) => years.length === 1 ? (left + right) / 2 : left + i / (years.length - 1) * (right - left);
  const y = (value: number) => bottom - (value - lo) / (hi - lo) * (bottom - top);
  const format = (v: number) => metric === 'qt_mat' ? `${(v / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 1})} mil` : `${v.toLocaleString('pt-BR', {maximumFractionDigits: 1})}%`;
  return <><svg viewBox="0 0 720 300" role="img" aria-label={metric === 'qt_mat' ? 'Matrículas por ano, rede e modalidade' : 'Estimativa de evasão anual por rede e modalidade'}>
    {[0, 1, 2, 3, 4].map(i => { const value = lo + (hi - lo) * i / 4; return <g key={i}>
      <line x1={left} x2={right} y1={y(value)} y2={y(value)} className="axis"/>
      <text x={left - 10} y={y(value) + 4} textAnchor="end">{format(value)}</text></g>; })}
    {years.map((year, i) => <text key={year} x={x(i)} y={bottom + 25} textAnchor="middle">{year}</text>)}
    {series.map(s => <g key={s.label}>
      {s.rows.map((row, i) => {
        const value = row?.[metric];
        if (value === null || value === undefined) return null;
        const previous = s.rows[i - 1]?.[metric];
        return <g key={years[i]}>{previous !== null && previous !== undefined &&
          <line x1={x(i - 1)} x2={x(i)} y1={y(previous)} y2={y(value)} stroke={s.color} strokeWidth="2.5"/>}
          <circle cx={x(i)} cy={y(value)} r="4" fill={s.color}><title>{s.label} · {years[i]}: {format(value)}</title></circle></g>;
      })}</g>)}
  </svg><div className="legend">{series.map(s => <span key={s.label}><i style={{background: s.color}}/>{s.label}</span>)}</div></>;
}
