// Variantes de gráficos usadas somente no modo "Dados fixos".
// As primitivas compartilhadas em ../visualization ficam intactas (também servem às páginas da API).
import {C, S, make, lin, fmt, tipAttr, label, yGrid} from '../visualization/charts.js';
import {arc} from '../visualization/charts2.js';

const pct = v => v == null ? '—' : fmt(v, 1) + '%';

/* Extremos a partir da média ponderada informada (não da média simples das linhas). */
export function extremes(host, rows, mean, n = 6) {
  const sorted = rows.slice().sort((a, b) => b.d - a.d);
  n = Math.min(n, Math.floor(rows.length / 2)) || 1;
  const hi = sorted.slice(0, n), lo = sorted.slice(-n).filter(r => !hi.includes(r)), list = [...hi, {gap: true}, ...lo];
  const W = 640, rh = 30, m = {l: 230, r: 50, t: 30, b: 26}, H = m.t + list.length * rh + m.b, svg = make(host, W, H), x = lin(0, 100, m.l, W - m.r);
  [0, 25, 50, 75, 100].forEach(t => { S('line', {x1: x(t), x2: x(t), y1: m.t - 6, y2: H - m.b, class: 'axis'}, svg); label(svg, x(t), H - 8, t + '%', {anchor: 'middle'}); });
  S('line', {x1: x(mean), x2: x(mean), y1: m.t - 6, y2: H - m.b, stroke: C.ink, 'stroke-width': 1.5, 'stroke-dasharray': '4 3'}, svg);
  label(svg, x(mean), 12, 'MT ' + fmt(mean, 1) + '%', {anchor: 'middle', strong: true});
  list.forEach((r, i) => {
    const cy = m.t + i * rh + rh / 2;
    if (r.gap) { S('line', {x1: 8, x2: W - 8, y1: cy, y2: cy, stroke: C.line, 'stroke-dasharray': '2 4'}, svg); return; }
    const up = r.d > mean, c = up ? C.loss : C.blue;
    label(svg, m.l - 12, cy + 4, r.nome.length > 34 ? r.nome.slice(0, 33) + '…' : r.nome, {anchor: 'end', strong: true});
    S('line', {x1: x(mean), x2: x(r.d), y1: cy, y2: cy, stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round'}, svg);
    tipAttr(S('circle', {cx: x(r.d), cy, r: 7, fill: c}, svg), `<b>${r.nome}</b><br>Desistência acumulada: ${pct(r.d)}<br>Ingressantes: ${r.N.toLocaleString('pt-BR')}<br>Cursos: ${r.cursos}<br>Pública: ${pct(r.pub)}<br>Privada: ${pct(r.priv)}<br>Diferença para MT: ${r.d > mean ? '+' : ''}${fmt(r.d - mean, 1)} p.p.`);
    label(svg, x(r.d) + (up ? 13 : -13), cy + 4, fmt(r.d, 0) + '%', {anchor: up ? 'start' : 'end', strong: true, fill: c});
  });
}

/* Tercil superior × inferior de cada componente; a diferença pode ter qualquer sinal. */
export function gapDots(host, rows) {
  const W = 640, rh = 40, m = {l: 230, r: 74, t: 34, b: 28}, H = m.t + rows.length * rh + m.b, svg = make(host, W, H);
  const vals = rows.flatMap(r => [r.alto, r.baixo]), x0 = Math.floor(Math.min(...vals) / 10) * 10 - 5, x1 = Math.ceil(Math.max(...vals) / 10) * 10 + 5, x = lin(x0, x1, m.l, W - m.r);
  for (let t = Math.ceil(x0 / 10) * 10; t <= x1; t += 10) { S('line', {x1: x(t), x2: x(t), y1: m.t - 8, y2: H - m.b, class: 'axis'}, svg); label(svg, x(t), H - 8, t + '%', {anchor: 'middle'}); }
  S('circle', {cx: m.l, cy: 12, r: 6, fill: C.blue}, svg); label(svg, m.l + 12, 16, 'Tercil com nota mais alta', {size: 11});
  S('circle', {cx: m.l + 190, cy: 12, r: 6, fill: C.loss}, svg); label(svg, m.l + 202, 16, 'Tercil com nota mais baixa', {size: 11});
  rows.forEach((r, i) => {
    const cy = m.t + i * rh + rh / 2, d = r.baixo - r.alto;
    label(svg, m.l - 14, cy + 4, r.nome, {anchor: 'end', strong: true});
    S('line', {x1: x(r.alto), x2: x(r.baixo), y1: cy, y2: cy, stroke: C.lossSoft, 'stroke-width': 6, 'stroke-linecap': 'round'}, svg);
    tipAttr(S('circle', {cx: x(r.alto), cy, r: 7, fill: C.blue}, svg), `<b>${r.nome}</b><br>Nota alta: ${pct(r.alto)} desistem<br>Cursos avaliados: ${r.n}`);
    tipAttr(S('circle', {cx: x(r.baixo), cy, r: 7, fill: C.loss}, svg), `<b>${r.nome}</b><br>Nota baixa: ${pct(r.baixo)} desistem<br>Diferença: ${d > 0 ? '+' : ''}${fmt(d, 1)} p.p.<br>Spearman: ${r.rho == null ? '—' : fmt(r.rho, 2)}`);
    label(svg, W - m.r + 12, cy + 4, (d > 0 ? '+' : '') + fmt(d, 1) + ' p.p.', {strong: true, fill: d > 0 ? C.lossDeep : C.navy});
  });
}

/* Pontos com intervalo de confiança e escala vertical automática. */
export function whiskers(host, rows) {
  const W = 640, H = 270, m = {l: 44, r: 20, t: 16, b: 56}, svg = make(host, W, H);
  const lo = Math.floor(Math.min(...rows.map(r => r.lo)) / 5) * 5, hi = Math.ceil(Math.max(...rows.map(r => r.hi)) / 5) * 5;
  const x = lin(0, rows.length - 1, m.l + 60, W - m.r - 60), y = lin(lo, hi, H - m.b, m.t);
  yGrid(svg, y, Array.from({length: (hi - lo) / 5 + 1}, (_, i) => lo + i * 5), m.l, W - m.r, v => v + '%');
  S('path', {d: rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.desist)}`).join(''), fill: 'none', stroke: C.navy, 'stroke-width': 2.5}, svg);
  rows.forEach((r, i) => {
    S('line', {x1: x(i), x2: x(i), y1: y(r.lo), y2: y(r.hi), stroke: C.gray, 'stroke-width': 2}, svg);
    [r.lo, r.hi].forEach(v => S('line', {x1: x(i) - 6, x2: x(i) + 6, y1: y(v), y2: y(v), stroke: C.gray, 'stroke-width': 2}, svg));
    tipAttr(S('circle', {cx: x(i), cy: y(r.desist), r: 7, fill: C.loss}, svg), `<b>${r.q}</b><br>Desistência: ${pct(r.desist)}<br>IC 95% aprox.: ${fmt(r.lo, 1)}–${fmt(r.hi, 1)}%<br>FIES (mediana da faixa): ${pct(r.fin)}<br>Cursos: ${r.n}`);
    label(svg, x(i), H - 30, r.q, {anchor: 'middle', strong: true});
    label(svg, x(i), H - 14, r.n + ' cursos', {anchor: 'middle', size: 10});
  });
}

/* Pizza de pizza com títulos explícitos: a pizza da direita pode ser outra população. */
export function pieOfPie(host, main, splitIdx, sub, o = {}) {
  const W = 640, H = 340, svg = make(host, W, H), c1 = [150, 160], r1 = 110, c2 = [490, 160], r2 = 72;
  let a = 0; const sl = main.map(m => { const s = a; a += m.v / 100 * Math.PI * 2; return {...m, a0: s, a1: a}; });
  const rot = -(sl[splitIdx].a0 + sl[splitIdx].a1) / 2;
  sl.forEach(s => { s.a0 += rot; s.a1 += rot; });
  const sp = sl[splitIdx];
  [sp.a0, sp.a1].forEach((ang, i) => S('line', {x1: c1[0] + r1 * Math.cos(ang), y1: c1[1] + r1 * Math.sin(ang), x2: c2[0], y2: c2[1] + (i ? r2 : -r2), stroke: C.gray, 'stroke-dasharray': '4 4'}, svg));
  sl.forEach(s => {
    tipAttr(S('path', {d: arc(c1[0], c1[1], r1, s.a0, s.a1), fill: s.cor, stroke: '#fff', 'stroke-width': 2}, svg), `<b>${s.nome}</b><br>Parcela: ${pct(s.v)}${s.n != null ? '<br>Pessoas: ' + s.n.toLocaleString('pt-BR') : ''}`);
    const mid = (s.a0 + s.a1) / 2; if (s.v > 4) label(svg, c1[0] + r1 * .62 * Math.cos(mid), c1[1] + r1 * .62 * Math.sin(mid) + 4, fmt(s.v, 0) + '%', {anchor: 'middle', strong: true, fill: '#fff'});
  });
  let b = -Math.PI / 2; sub.forEach(s => {
    const e = b + s.v / 100 * Math.PI * 2;
    tipAttr(S('path', {d: arc(c2[0], c2[1], r2, b, e), fill: s.cor, stroke: '#fff', 'stroke-width': 2}, svg), `<b>${s.nome}</b><br>Parcela: ${pct(s.v)}${s.n != null ? '<br>Pessoas: ' + s.n.toLocaleString('pt-BR') : ''}`);
    const mid = (b + e) / 2; label(svg, c2[0] + r2 * .6 * Math.cos(mid), c2[1] + r2 * .6 * Math.sin(mid) + 4, fmt(s.v, 0) + '%', {anchor: 'middle', strong: true, fill: '#fff'});
    b = e;
  });
  label(svg, c1[0], 22, o.mainTitle || '', {anchor: 'middle', strong: true});
  label(svg, c2[0], 66, o.subTitle || '', {anchor: 'middle', strong: true});
  if (o.subNote) label(svg, c2[0], 256, o.subNote, {anchor: 'middle', size: 10});
  [...main, ...sub].forEach((m, i) => { const xx = 20 + (i % 3) * 205, yy = 300 + Math.floor(i / 3) * 18; S('circle', {cx: xx, cy: yy - 4, r: 5, fill: m.cor}, svg); label(svg, xx + 12, yy, m.nome, {size: 11}); });
}

/* Correlações de Spearman com escala ±0,5 e rótulo do valor. */
export function correlations(host, rows) {
  const W = 640, rh = 36, H = rows.length * rh + 34, m = {l: 230, r: 60, t: 6}, svg = make(host, W, H), x = lin(-.5, .5, m.l, W - m.r);
  S('line', {x1: x(0), x2: x(0), y1: m.t, y2: H - 24, stroke: C.ink}, svg);
  [-.4, -.2, .2, .4].forEach(t => { S('line', {x1: x(t), x2: x(t), y1: m.t, y2: H - 24, class: 'axis'}, svg); label(svg, x(t), H - 8, (t > 0 ? '+' : '−') + fmt(Math.abs(t), 1), {anchor: 'middle'}); });
  rows.forEach(([n, v, k], i) => {
    const cy = m.t + i * rh + rh / 2, c = v < 0 ? C.blue : C.loss;
    label(svg, m.l - 12, cy + 4, n, {anchor: 'end', strong: true});
    S('line', {x1: x(0), x2: x(v), y1: cy, y2: cy, stroke: c, 'stroke-width': 2.5}, svg);
    tipAttr(S('circle', {cx: x(v), cy, r: 7, fill: c}, svg), `<b>${n}</b><br>Spearman com a desistência: ${fmt(v, 2)}<br>Cursos: ${k}<br>${Math.abs(v) < .1 ? 'Associação desprezível' : v < 0 ? 'Nota maior, desistência menor' : 'Nota maior, desistência maior'}`);
    label(svg, x(v) + (v < 0 ? -12 : 12), cy + 4, (v > 0 ? '+' : '') + fmt(v, 2), {anchor: v < 0 ? 'end' : 'start', size: 10.5, strong: true, fill: c});
  });
}
