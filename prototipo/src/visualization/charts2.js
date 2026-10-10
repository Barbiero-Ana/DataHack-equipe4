import {NS, C, S, make, lin, fmt, empty, tipAttr, wrap, label, yGrid, waffle, stackedArea, lineChart, lollipop, dumbbell, heatmap, scatter, funnel, geoDots, whiskers, divergingLollipop, sparkline} from './charts.js';
/* Gráficos adicionais: treemap, pizza de pizza, barras, colunas e mapas coropléticos */

const ramp = (t, stops) => { t = Math.min(1, Math.max(0, t)); const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), u = t * n - i, a = stops[i], b = stops[i + 1]; return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`; };
const RAMP_DIV = [[111,191,184],[250,238,226],[255,160,145],[214,70,58]];   // verde-água (baixa) a coral (alta)
const RAMP_SEQ = [[255,240,238],[255,190,180],[255,126,112],[190,52,42]];     // coral sequencial
const RAMP_TEAL = [[232,245,244],[140,207,203],[31,138,138],[20,92,99]];

function squarify(items, x, y, w, h) {
  const total = items.reduce((a, b) => a + b.v, 0), k = w * h / total;
  let rest = items.map(i => ({i, a:i.v * k})), cx = x, cy = y, cw = w, ch = h;
  while (rest.length) {
    const side = Math.min(cw, ch), worst = (r, s) => { const mx = Math.max(...r.map(z => z.a)), mn = Math.min(...r.map(z => z.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    let row = [rest[0]], sum = rest[0].a, n = 1;
    while (n < rest.length && worst(row.concat(rest[n]), sum + rest[n].a) <= worst(row, sum)) { row.push(rest[n]); sum += rest[n].a; n++; }
    const th = sum / side;
    if (cw >= ch) { let yy = cy; row.forEach(r => { const hh = r.a / th; r.i.rect = {x:cx, y:yy, w:th, h:hh}; yy += hh; }); cx += th; cw -= th; }
    else { let xx = cx; row.forEach(r => { const ww = r.a / th; r.i.rect = {x:xx, y:cy, w:ww, h:th}; xx += ww; }); cy += th; ch -= th; }
    rest = rest.slice(row.length);
  }
}

/* groups: [{nome, children:[{nome, v, c, extra}]}]; c = valor de cor (% desistência) */
function treemap(host, groups, o = {}) {
  const W = 1000, H = o.h || 460, svg = make(host, W, H);
  const gs = groups.map(g => ({...g, v:g.children.reduce((a, b) => a + b.v, 0)})).sort((a, b) => b.v - a.v);
  squarify(gs, 0, 0, W, H);
  gs.forEach(g => {
    const r = g.rect;
    S('rect', {x:r.x, y:r.y, width:r.w, height:r.h, fill:'#fff', stroke:'#fff', 'stroke-width':3}, svg);
    label(svg, r.x + 6, r.y + 15, g.nome.length > r.w / 6.4 ? g.nome.slice(0, Math.max(3, Math.floor(r.w / 6.4) - 1)) + '…' : g.nome, {strong:true, size:11});
    const ch = g.children.slice().sort((a, b) => b.v - a.v);
    squarify(ch, r.x + 2, r.y + 21, r.w - 4, r.h - 23);
    ch.forEach(c => {
      const q = c.rect, fill = ramp((c.c - 10) / 70, RAMP_DIV), dark = (c.c - 10) / 70 > .72;
      const rect = S('rect', {x:q.x + 1, y:q.y + 1, width:Math.max(0, q.w - 2), height:Math.max(0, q.h - 2), rx:3, fill}, svg);
      tipAttr(rect, `<b>${c.nome}</b><br>Área: ${g.nome}<br>Ingressantes: ${c.v.toLocaleString('pt-BR')}<br>Desistência: ${fmt(c.c, 0)}%`);
      if (q.w > 70 && q.h > 36) {
        const lines = wrap(c.nome, Math.floor(q.w / 7));
        lines.slice(0, 2).forEach((t, i) => label(svg, q.x + 8, q.y + 18 + i * 13, t, {strong:true, size:11, fill:dark ? '#fff' : C.ink}));
        label(svg, q.x + 8, q.y + q.h - 9, fmt(c.c, 0) + '%', {size:11, fill:dark ? '#fff' : C.ink});
      }
    });
  });
}

const arc = (cx, cy, r, a0, a1) => { const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); return `M${cx},${cy}L${x0},${y0}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}Z`; };

/* main: [{nome,v,cor}] soma 100; splitIdx: fatia detalhada em sub: [{nome,v,cor}] soma 100 */
function pieOfPie(host, main, splitIdx, sub) {
  const W = 640, H = 320, svg = make(host, W, H), c1 = [150, 160], r1 = 110, c2 = [490, 160], r2 = 72;
  let a = 0; const sl = main.map(m => { const s = a; a += m.v / 100 * Math.PI * 2; return {...m, a0:s, a1:a}; });
  const rot = -(sl[splitIdx].a0 + sl[splitIdx].a1) / 2;
  sl.forEach(s => { s.a0 += rot; s.a1 += rot; });
  const sp = sl[splitIdx];
  [sp.a0, sp.a1].forEach((ang, i) => S('line', {x1:c1[0] + r1 * Math.cos(ang), y1:c1[1] + r1 * Math.sin(ang), x2:c2[0], y2:c2[1] + (i ? r2 : -r2), stroke:C.gray, 'stroke-dasharray':'4 4'}, svg));
  sl.forEach(s => {
    tipAttr(S('path', {d:arc(c1[0], c1[1], r1, s.a0, s.a1), fill:s.cor, stroke:'#fff', 'stroke-width':2}, svg), `<b>${s.nome}</b><br>Parcela: ${fmt(s.v, 0)}%`);
    const m = (s.a0 + s.a1) / 2; if (s.v > 4) label(svg, c1[0] + r1 * .62 * Math.cos(m), c1[1] + r1 * .62 * Math.sin(m) + 4, fmt(s.v, 0) + '%', {anchor:'middle', strong:true, fill:'#fff'});
  });
  let b = -Math.PI / 2; sub.forEach(s => {
    const e = b + s.v / 100 * Math.PI * 2;
    tipAttr(S('path', {d:arc(c2[0], c2[1], r2, b, e), fill:s.cor, stroke:'#fff', 'stroke-width':2}, svg), `<b>${s.nome}</b><br>Entre concluintes: ${fmt(s.v, 0)}%`);
    const m = (b + e) / 2; label(svg, c2[0] + r2 * .6 * Math.cos(m), c2[1] + r2 * .6 * Math.sin(m) + 4, fmt(s.v, 0) + '%', {anchor:'middle', strong:true, fill:'#fff'});
    b = e;
  });
  label(svg, c1[0], 22, 'Ingressantes', {anchor:'middle', strong:true}); label(svg, c2[0], 70, main[splitIdx].nome + ' (detalhe)', {anchor:'middle', strong:true});
  const leg = [...main, ...sub]; leg.forEach((m, i) => { const x = 20 + (i % 3) * 205, y = 296 + Math.floor(i / 3) * 18; S('circle', {cx:x, cy:y - 4, r:5, fill:m.cor}, svg); label(svg, x + 12, y, m.nome + (i >= main.length ? ' (concluintes)' : ''), {size:11}); });
}

/* barras horizontais agrupadas */
function hbarsGrouped(host, rows, series, o = {}) {
  const bh = 14, gap = 3, rh = series.length * (bh + gap) + 14, W = o.w || 640, m = {l:o.ml || 150, r:60, t:26, b:6}, H = m.t + rows.length * rh + m.b, svg = make(host, W, H);
  const max = o.max || Math.max(...rows.flatMap(r => r.vals)) * 1.05, x = lin(0, max, m.l, W - m.r);
  series.forEach((s, i) => { S('rect', {x:m.l + i * 120, y:4, width:10, height:10, rx:2, fill:s.cor}, svg); label(svg, m.l + i * 120 + 15, 13, s.nome, {size:11}); });
  rows.forEach((r, i) => {
    const y0 = m.t + i * rh;
    label(svg, m.l - 10, y0 + (rh - 14) / 2 + 4, r.nome, {anchor:'end', strong:true});
    r.vals.forEach((v, j) => {
      const y = y0 + j * (bh + gap);
      tipAttr(S('rect', {x:m.l, y, width:Math.max(1, x(v) - m.l), height:bh, rx:3, fill:series[j].cor}, svg), `<b>${r.nome}</b><br>${series[j].nome}: ${o.f ? o.f(v) : fmt(v, 0) + (o.unit || '')}`);
      label(svg, x(v) + 6, y + 11, o.f ? o.f(v) : fmt(v, 0) + (o.unit || ''), {size:10.5});
    });
  });
}

/* colunas agrupadas: cats no eixo X, series [{nome,cor,values}] */
function groupedColumns(host, cats, series, o = {}) {
  const W = o.w || 640, H = o.h || 300, m = {l:54, r:16, t:34, b:28}, svg = make(host, W, H), ymax = o.ymax || Math.ceil(Math.max(...series.flatMap(s => s.values)) * 1.15 / (o.step || 1)) * (o.step || 1);
  const y = lin(0, ymax, H - m.b, m.t), cw = (W - m.l - m.r) / cats.length, bw = Math.min(46, cw * .7 / series.length);
  yGrid(svg, y, Array.from({length:5}, (_, i) => ymax / 4 * i), m.l, W - m.r, o.yf || (v => fmt(v, 0)));
  series.forEach((s, i) => { S('rect', {x:m.l + i * 130, y:6, width:10, height:10, rx:2, fill:s.cor}, svg); label(svg, m.l + i * 130 + 15, 15, s.nome, {size:11}); });
  cats.forEach((c, i) => {
    const cx = m.l + cw * i + cw / 2; label(svg, cx, H - 8, c, {anchor:'middle', strong:true});
    series.forEach((s, j) => {
      const bx = cx - bw * series.length / 2 + j * bw + 2, v = s.values[i];
      tipAttr(S('rect', {x:bx, y:y(v), width:bw - 4, height:y(0) - y(v), rx:3, fill:s.cor}, svg), `<b>${c}</b><br>${s.nome}: ${o.vf ? o.vf(v) : fmt(v, 0)}`);
      label(svg, bx + (bw - 4) / 2, y(v) - 6, o.vf ? o.vf(v) : fmt(v, 0), {anchor:'middle', size:10.5, strong:true});
    });
  });
}

/* mapa coroplético. fn(item) => {fill, tip, stroke, sw} */
function choropleth(host, geo, fn, onClick) {
  host.innerHTML = '';
  const svg = S('svg', {viewBox:`0 0 ${geo.w} ${geo.h}`, role:'img', class:'map'}, host);
  geo.items.forEach(it => {
    const r = fn(it), p = S('path', {d:it.d, fill:r.fill, stroke:r.stroke || '#fff', 'stroke-width':r.sw || .8, 'stroke-linejoin':'round', 'data-id':it.id}, svg);
    tipAttr(p, r.tip); if (onClick) p.addEventListener('click', () => onClick(it));
  });
  return svg;
}

/* Extremos: maiores e menores desistências, divergindo da média dos cursos */
function extremes(host, rows, n = 6) {
  const sorted = rows.slice().sort((a, b) => b.d - a.d), mean = rows.reduce((s, r) => s + r.d, 0) / rows.length;
  n = Math.min(n, Math.floor(rows.length / 2)) || 1;
  const hi = sorted.slice(0, n), lo = sorted.slice(-n).filter(r => !hi.includes(r)), list = [...hi, {gap:true}, ...lo];
  const W = 640, rh = 30, m = {l:190, r:50, t:30, b:26}, H = m.t + list.length * rh + m.b, svg = make(host, W, H), x = lin(0, 100, m.l, W - m.r);
  [0, 25, 50, 75, 100].forEach(t => { S('line', {x1:x(t), x2:x(t), y1:m.t - 6, y2:H - m.b, class:'axis'}, svg); label(svg, x(t), H - 8, t + '%', {anchor:'middle'}); });
  S('line', {x1:x(mean), x2:x(mean), y1:m.t - 6, y2:H - m.b, stroke:C.ink, 'stroke-width':1.5, 'stroke-dasharray':'4 3'}, svg);
  label(svg, x(mean), 12, 'média ' + fmt(mean, 0) + '%', {anchor:'middle', strong:true});
  list.forEach((r, i) => {
    const cy = m.t + i * rh + rh / 2;
    if (r.gap) { S('line', {x1:8, x2:W - 8, y1:cy, y2:cy, stroke:C.line, 'stroke-dasharray':'2 4'}, svg); return; }
    const up = r.d > mean, c = up ? C.loss : C.blue;
    label(svg, m.l - 12, cy + 4, r.nome.length > 28 ? r.nome.slice(0, 27) + '…' : r.nome, {anchor:'end', strong:true});
    S('line', {x1:x(mean), x2:x(r.d), y1:cy, y2:cy, stroke:c, 'stroke-width':3, 'stroke-linecap':'round'}, svg);
    tipAttr(S('circle', {cx:x(r.d), cy, r:7, fill:c}, svg), `<b>${r.nome}</b><br>Desistência: ${fmt(r.d, 0)}%<br>Pública: ${r.pub}%<br>Privada: ${r.priv}%<br>Diferença da média: ${r.d > mean ? '+' : ''}${fmt(r.d - mean, 0)} p.p.`);
    label(svg, x(r.d) + (up ? 13 : -13), cy + 4, fmt(r.d, 0) + '%', {anchor:up ? 'start' : 'end', strong:true, fill:c});
  });
}

/* Diferença por motivo: desistência com nota alta x nota baixa no componente */
function gapDots(host, rows) {
  const W = 640, rh = 44, m = {l:215, r:70, t:34, b:28}, H = m.t + rows.length * rh + m.b, svg = make(host, W, H), x = lin(0, 100, m.l, W - m.r);
  [0, 25, 50, 75, 100].forEach(t => { S('line', {x1:x(t), x2:x(t), y1:m.t - 8, y2:H - m.b, class:'axis'}, svg); label(svg, x(t), H - 8, t + '%', {anchor:'middle'}); });
  S('circle', {cx:m.l, cy:12, r:6, fill:C.blue}, svg); label(svg, m.l + 12, 16, 'Nota alta (≥ 4)', {size:11});
  S('circle', {cx:m.l + 130, cy:12, r:6, fill:C.loss}, svg); label(svg, m.l + 142, 16, 'Nota baixa (< 3)', {size:11});
  rows.forEach((r, i) => {
    const cy = m.t + i * rh + rh / 2;
    label(svg, m.l - 14, cy + 4, r.nome, {anchor:'end', strong:true});
    S('line', {x1:x(r.hi), x2:x(r.lo), y1:cy, y2:cy, stroke:C.lossSoft, 'stroke-width':6, 'stroke-linecap':'round'}, svg);
    tipAttr(S('circle', {cx:x(r.hi), cy, r:7, fill:C.blue}, svg), `<b>${r.nome}</b><br>Nota alta (≥ 4): ${fmt(r.hi, 0)}% desistem`);
    tipAttr(S('circle', {cx:x(r.lo), cy, r:7, fill:C.loss}, svg), `<b>${r.nome}</b><br>Nota baixa (< 3): ${fmt(r.lo, 0)}% desistem<br>Diferença: ${fmt(r.lo - r.hi, 0)} p.p.`);
    label(svg, W - m.r + 12, cy + 4, '+' + fmt(r.lo - r.hi, 0) + ' p.p.', {strong:true, fill:C.lossDeep});
  });
}

/* Borboleta: dois indicadores opostos por linha, com o nome ao centro */
function butterfly(host, rows, L, R) {
  const W = 1000, rh = 36, m = {t:42, b:10, gap:190}, H = m.t + rows.length * rh + m.b, svg = make(host, W, H), mid = W / 2;
  const xl = lin(0, L.max, mid - m.gap / 2, 40), xr = lin(0, R.max, mid + m.gap / 2, W - 40);
  label(svg, 40, 14, L.nome, {strong:true, fill:L.cor}); label(svg, W - 40, 14, R.nome, {anchor:'end', strong:true, fill:R.cor});
  [0, .5, 1].forEach(t => { const a = xl(L.max * t), b = xr(R.max * t); S('line', {x1:a, x2:a, y1:m.t - 14, y2:H - m.b, class:'axis'}, svg); S('line', {x1:b, x2:b, y1:m.t - 14, y2:H - m.b, class:'axis'}, svg);
    label(svg, a, 34, fmt(L.max * t, 0) + '%', {anchor:'middle', size:10}); label(svg, b, 34, fmt(R.max * t, 0) + '%', {anchor:'middle', size:10}); });
  rows.forEach((r, i) => {
    const y = m.t + i * rh + 6, h = rh - 12;
    label(svg, mid, y + h / 2 + 4, r.nome, {anchor:'middle', strong:true});
    tipAttr(S('rect', {x:xl(r.l), y, width:xl(0) - xl(r.l), height:h, rx:3, fill:L.cor}, svg), `<b>${r.nome}</b><br>${L.nome}: ${fmt(r.l, 0)}%`);
    tipAttr(S('rect', {x:xr(0), y, width:xr(r.r) - xr(0), height:h, rx:3, fill:R.cor}, svg), `<b>${r.nome}</b><br>${R.nome}: ${fmt(r.r, 0)}%`);
    label(svg, xl(r.l) - 6, y + h / 2 + 4, fmt(r.l, 0) + '%', {anchor:'end', strong:true, size:10.5});
    label(svg, xr(r.r) + 6, y + h / 2 + 4, fmt(r.r, 0) + '%', {strong:true, size:10.5});
  });
}

export {ramp, RAMP_DIV, RAMP_SEQ, RAMP_TEAL, squarify, treemap, arc, pieOfPie, hbarsGrouped, groupedColumns, choropleth, extremes, gapDots, butterfly};
