/* Primitivas SVG, sem bibliotecas externas */
const NS = 'http://www.w3.org/2000/svg';
const C = {navy:'#145c63',blue:'#1f8a8a',sky:'#8ccfcb',gray:'#9a9cb0',loss:'#ff7e70',lossDeep:'#e5574a',lossSoft:'#ffd2cc',sand:'#e9a23b',line:'#ebe7ea',ink:'#2b2d42'};
const S = (tag, attrs = {}, parent, text) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
};
const make = (host, w, h) => { host.innerHTML = ''; return S('svg', {viewBox:`0 0 ${w} ${h}`, role:'img'}, host); };
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
const fmt = (v, d = 1) => v.toLocaleString('pt-BR', {minimumFractionDigits:d, maximumFractionDigits:d});
const empty = (host, msg = 'Nenhum curso atende aos filtros selecionados.') => { host.innerHTML = `<div class="empty">${msg}</div>`; };
const tipAttr = (e, html) => { e.setAttribute('data-tip', html); return e; };
const wrap = (s, n) => { const w = s.split(' '), L = []; let c = ''; w.forEach(x => { if ((c + ' ' + x).trim().length > n) { L.push(c); c = x; } else c = (c + ' ' + x).trim(); }); if (c) L.push(c); return L; };
const label = (svg, x, y, t, o = {}) => S('text', {x, y, 'text-anchor':o.anchor || 'start', class:o.strong ? 't-strong' : '', style:o.fill ? `fill:${o.fill}` : null, 'font-size':o.size, transform:o.rot ? `rotate(${o.rot} ${x} ${y})` : null}, svg, t);

function yGrid(svg, y, ticks, x0, x1, f = v => v) {
  ticks.forEach(t => { S('line', {x1:x0, x2:x1, y1:y(t), y2:y(t), class:'axis'}, svg); label(svg, x0 - 8, y(t) + 4, f(t), {anchor:'end'}); });
}

/* Waffle 10x10: itens [{n, cor, nome}] somando 100 */
function waffle(host, items) {
  const w = 330, svg = make(host, w, w), cell = 33; let idx = 0;
  const seq = []; items.forEach(it => { for (let i = 0; i < Math.round(it.n); i++) seq.push(it); });
  while (seq.length < 100) seq.push(items[items.length - 1]);
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const it = seq[idx++];
    const col = c, row = 9 - r;
    tipAttr(S('circle', {cx:col * cell + cell / 2, cy:row * cell + cell / 2, r:12.5, fill:it.cor}, svg), `<b>${it.nome}</b><br>${fmt(it.n, 0)} de cada 100`);
  }
}

/* Área empilhada. layers: [{nome,cor,key}] de baixo p/ cima; data: [{ano,...}] soma 100 */
function stackedArea(host, data, layers, opt = {}) {
  const W = 640, H = 300, m = {l:40, r:96, t:12, b:28}, svg = make(host, W, H);
  const x = lin(0, data.length - 1, m.l, W - m.r), y = lin(0, 100, H - m.b, m.t);
  yGrid(svg, y, [0, 25, 50, 75, 100], m.l, W - m.r, v => v + '%');
  data.forEach((d, i) => label(svg, x(i), H - 8, d.ano, {anchor:'middle'}));
  let base = data.map(() => 0);
  layers.forEach(L => {
    const top = data.map((d, i) => base[i] + d[L.key]);
    const p = top.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('') + base.map((v, i) => `L${x(data.length - 1 - i)},${y(base[data.length - 1 - i])}`).join('') + 'Z';
    S('path', {d:p, fill:L.cor, stroke:'#fff', 'stroke-width':1.5}, svg);
    const li = data.length - 1, mid = (base[li] + top[li]) / 2;
    label(svg, W - m.r + 8, y(mid) + 4, `${L.nome} ${fmt(data[li][L.key], 0)}%`, {strong:true, fill:L.cor === C.gray ? '#555' : L.cor});
    base = top;
  });
  data.forEach((d, i) => {
    const hit = S('rect', {x:x(i) - 22, y:m.t, width:44, height:H - m.t - m.b, fill:'transparent'}, svg);
    tipAttr(hit, `<b>${d.ano}</b><br>` + layers.map(L => `${L.nome}: ${fmt(d[L.key])}%`).reverse().join('<br>'));
  });
}

/* Linhas. series:[{nome,cor,values(null permitido),dash}] */
function lineChart(host, xs, series, o = {}) {
  const W = o.w || 640, H = o.h || 300, m = {l:44, r:o.labelEnd ? 130 : 16, t:14, b:30}, svg = make(host, W, H);
  const all = series.flatMap(s => s.values.filter(v => v != null)), ymax = o.ymax || Math.ceil(Math.max(...all) / 10) * 10;
  const x = lin(0, xs.length - 1, m.l + 8, W - m.r), y = lin(0, ymax, H - m.b, m.t);
  const ticks = Array.from({length:5}, (_, i) => ymax / 4 * i);
  if (o.band != null) { S('rect', {x:x(o.band) - 26, y:m.t, width:52, height:H - m.t - m.b, fill:'#fff0ee'}, svg); label(svg, x(o.band), m.t + 12, o.bandLabel || '', {anchor:'middle', strong:true}); }
  yGrid(svg, y, ticks, m.l, W - m.r, v => fmt(v, 0) + (o.unit || ''));
  xs.forEach((t, i) => label(svg, x(i), H - 9, t, {anchor:'middle'}));
  series.forEach(s => {
    const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    S('path', {d:pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(''), fill:'none', stroke:s.cor, 'stroke-width':s.w || 2.5, 'stroke-dasharray':s.dash, 'stroke-linejoin':'round'}, svg);
    s.values.forEach((v, i) => { if (v == null) return;
      tipAttr(S('circle', {cx:x(i), cy:y(v), r:o.dotR || 4, fill:'#fff', stroke:s.cor, 'stroke-width':2}, svg), `<b>${s.nome}</b><br>${xs[i]}: ${fmt(v)}${o.unit || ''}`); });
    if (o.labelEnd && !s.noLabel) { const li = s.values.map(v => v != null).lastIndexOf(true); label(svg, x(li) + 10, y(s.values[li]) + 4, s.lab || s.nome, {strong:true, fill:s.cor, size:11}); }
  });
  if (o.xTitle) label(svg, (m.l + W - m.r) / 2, H + 6, o.xTitle, {anchor:'middle'});
}

/* Pirulito (lollipop) vertical por ano, com destaque de pico */
function lollipop(host, data, key, peakIdx, o = {}) {
  const W = 470, H = 290, m = {l:40, r:16, t:14, b:28}, svg = make(host, W, H);
  const ymax = Math.ceil(Math.max(...data.map(d => d[key])) / 2) * 2 + 2, x = lin(0, data.length - 1, m.l + 8, W - m.r), y = lin(0, ymax, H - m.b, m.t);
  yGrid(svg, y, [0, ymax / 2, ymax], m.l, W - m.r, v => fmt(v, 0));
  data.forEach((d, i) => {
    const pk = i === peakIdx, c = pk ? C.loss : C.sky;
    S('line', {x1:x(i), x2:x(i), y1:y(0), y2:y(d[key]), stroke:c, 'stroke-width':2}, svg);
    tipAttr(S('circle', {cx:x(i), cy:y(d[key]), r:pk ? 8 : 5.5, fill:c}, svg), `<b>${d.ano}</b><br>Perda no ano: ${fmt(d[key])} p.p. da turma`);
    label(svg, x(i), H - 9, d.ano, {anchor:'middle', strong:pk});
    if (pk) label(svg, x(i), y(d[key]) - 13, fmt(d[key]) + ' p.p.', {anchor:'middle', strong:true, fill:C.loss});
  });
}

/* Dumbbell por curso: ponto público, ponto privado, ponto geral */
function dumbbell(host, rows, showRede) {
  const W = 640, rh = 34, H = rows.length * rh + 44, m = {l:190, r:24, t:8, b:32}, svg = make(host, W, H);
  const x = lin(0, 100, m.l, W - m.r);
  [0, 25, 50, 75, 100].forEach(t => { S('line', {x1:x(t), x2:x(t), y1:m.t, y2:H - m.b, class:'axis'}, svg); label(svg, x(t), H - 12, t + '%', {anchor:'middle'}); });
  rows.forEach((r, i) => {
    const cy = m.t + i * rh + rh / 2;
    label(svg, m.l - 12, cy + 4, r.nome.length > 28 ? r.nome.slice(0, 27) + '…' : r.nome, {anchor:'end', strong:true});
    const a = showRede.publica ? r.pub : r.tot, b = showRede.privada ? r.priv : r.tot;
    S('line', {x1:x(Math.min(a, b)), x2:x(Math.max(a, b)), y1:cy, y2:cy, stroke:'#cfd4e2', 'stroke-width':4, 'stroke-linecap':'round'}, svg);
    if (showRede.publica) tipAttr(S('circle', {cx:x(r.pub), cy, r:6.5, fill:C.navy}, svg), `<b>${r.nome}</b><br>Pública: ${r.pub}%`);
    if (showRede.privada) tipAttr(S('circle', {cx:x(r.priv), cy, r:6.5, fill:C.sky, stroke:C.blue, 'stroke-width':1.5}, svg), `<b>${r.nome}</b><br>Privada: ${r.priv}%`);
    tipAttr(S('path', {d:`M${x(r.tot)},${cy - 9}l6,9l-6,9l-6,-9z`, fill:C.loss}, svg), `<b>${r.nome}</b><br>Geral: ${r.tot}%`);
  });
}

/* Mapa de calor área x ano do curso */
function heatmap(host, rows, cols, val, o = {}) {
  const W = o.w || 1000, rh = 34, m = {l:o.ml || 290, r:10, t:26, b:6}, H = m.t + rows.length * rh + m.b, svg = make(host, W, H), cw = (W - m.l - m.r) / cols.length;
  const col = v => { const t = Math.min(1, Math.max(0, (v - 5) / 60)); const a = [255,240,238], b = [214,70,58]; return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(',')})`; };
  cols.forEach((c, j) => label(svg, m.l + j * cw + cw / 2, 16, c, {anchor:'middle', strong:true}));
  rows.forEach((r, i) => {
    label(svg, m.l - 10, m.t + i * rh + rh / 2 + 4, r, {anchor:'end', strong:true});
    cols.forEach((c, j) => { const v = val(r, j);
      tipAttr(S('rect', {x:m.l + j * cw + 2, y:m.t + i * rh + 2, width:cw - 4, height:rh - 4, rx:4, fill:col(v)}, svg), `<b>${r}</b><br>${c}: ${fmt(v, 0)}% já saíram`);
      label(svg, m.l + j * cw + cw / 2, m.t + i * rh + rh / 2 + 4, fmt(v, 0), {anchor:'middle', fill:v > 45 ? '#fff' : C.ink}); });
  });
}

/* Dispersão com bolhas e tendência opcional. pts:[{x,y,r,cor,tip,lbl}] */
function scatter(host, pts, o) {
  const W = o.w || 640, H = o.h || 340, m = {l:48, r:20, t:14, b:42}, svg = make(host, W, H);
  const x = lin(o.x0, o.x1, m.l, W - m.r), y = lin(o.y0, o.y1, H - m.b, m.t);
  const yt = o.yTicks || [0, 25, 50, 75, 100]; yGrid(svg, y, yt, m.l, W - m.r, v => v + (o.yUnit || ''));
  (o.xTicks || []).forEach(t => { S('line', {x1:x(t), x2:x(t), y1:m.t, y2:H - m.b, class:'axis'}, svg); label(svg, x(t), H - m.b + 16, t + (o.xUnit || ''), {anchor:'middle'}); });
  label(svg, (m.l + W - m.r) / 2, H - 4, o.xTitle, {anchor:'middle', strong:true});
  label(svg, 12, (m.t + H - m.b) / 2, o.yTitle, {anchor:'middle', strong:true, rot:-90});
  if (o.vline != null) { S('line', {x1:x(o.vline), x2:x(o.vline), y1:m.t, y2:H - m.b, stroke:C.gray, 'stroke-dasharray':'4 4'}, svg); }
  if (o.hline != null) { S('line', {x1:m.l, x2:W - m.r, y1:y(o.hline), y2:y(o.hline), stroke:C.gray, 'stroke-dasharray':'4 4'}, svg); }
  (o.quad || []).forEach(q => label(svg, x(q.x), y(q.y), q.t, {anchor:q.a || 'start', fill:q.c, strong:true}));
  if (o.trend && pts.length > 2) {
    const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
    const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0), syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
    const b = sxy / sxx, a = my - b * mx, xa = Math.min(...pts.map(p => p.x)), xb = Math.max(...pts.map(p => p.x));
    S('line', {x1:x(xa), x2:x(xb), y1:y(a + b * xa), y2:y(a + b * xb), stroke:C.ink, 'stroke-width':2, 'stroke-dasharray':'6 4'}, svg);
    host._r = sxy / Math.sqrt(sxx * syy); host._b = b;
  }
  pts.forEach(p => {
    tipAttr(S('circle', {cx:x(p.x), cy:y(p.y), r:p.r || 5, fill:p.cor, 'fill-opacity':o.alpha || .75, stroke:p.cor, 'stroke-width':1.2}, svg), p.tip);
    if (p.lbl) label(svg, x(p.x) + (p.dx ?? 9), y(p.y) + (p.dy ?? 4), p.lbl, {strong:true, size:10.5, anchor:p.a});
  });
}

/* Funil simétrico em polígonos. stages:[{nome,v,cor,nota}] */
function funnel(host, stages) {
  const W = 470, sh = 54, gap = 8, H = stages.length * (sh + gap), svg = make(host, W, H), cx = 120, maxw = 240;
  stages.forEach((s, i) => {
    const w0 = maxw * s.v / 100, w1 = maxw * (stages[i + 1] ? stages[i + 1].v : s.v * .9) / 100, y0 = i * (sh + gap);
    tipAttr(S('path', {d:`M${cx - w0 / 2},${y0}L${cx + w0 / 2},${y0}L${cx + w1 / 2},${y0 + sh}L${cx - w1 / 2},${y0 + sh}Z`, fill:s.cor}, svg), `<b>${s.nome}</b><br>${fmt(s.v, 0)} de cada 100 ingressantes`);
    label(svg, cx, y0 + sh / 2 + 6, fmt(s.v, 0), {anchor:'middle', fill:s.v < 20 ? C.ink : '#fff', strong:true, size:s.v < 20 ? 0 : 18});
    label(svg, cx + maxw / 2 + 18, y0 + 24, `${fmt(s.v, 0)}  ${s.nome}`, {strong:true, fill:C.ink, size:13});
    label(svg, cx + maxw / 2 + 18, y0 + 42, s.nota, {size:11});
  });
}

/* Mapa de pontos geográfico (lon/lat -> x/y) */
function geoDots(host, rows, cat) {
  const W = 640, H = 520, svg = make(host, W, H), lon0 = -60.5, lon1 = -50, lat0 = -17.8, lat1 = -9;
  const x = lin(lon0, lon1, 20, W - 20), y = lin(lat1, lat0, 20, H - 20);
  [-58, -55, -52].forEach(t => { S('line', {x1:x(t), x2:x(t), y1:20, y2:H - 20, class:'axis', 'stroke-dasharray':'2 5'}, svg); });
  [-16, -13, -10].forEach(t => { S('line', {x1:20, x2:W - 20, y1:y(t), y2:y(t), class:'axis', 'stroke-dasharray':'2 5'}, svg); });
  rows.slice().sort((a, b) => b.jov - a.jov).forEach(d => {
    const r = 5 + Math.sqrt(d.jov) * 2.5, c = cat(d);
    const e = S('circle', {cx:x(d.lon), cy:y(d.lat), r, fill:c.fill, stroke:c.stroke, 'stroke-width':c.sw || 1.5, 'stroke-dasharray':c.dash, 'fill-opacity':c.op ?? .85}, svg);
    tipAttr(e, `<b>${d.nome}</b><br>${fmt(d.jov)} mil jovens de 18–24 anos<br>${d.vagas > 0 ? fmt(d.vagas, 1) + ' vagas presenciais por 100 jovens' : 'Sem oferta presencial'}`);
    const pos = {'Várzea Grande':'right', Sorriso:'right', 'Lucas do Rio Verde':'right', 'Cáceres':'left', 'Rondonópolis':'right', 'Primavera do Leste':'right', Cuiabá:'left', 'Campo Novo do Parecis':'left', 'Tangará da Serra':'left', 'Barra do Garças':'right', Sinop:'right', Querência:'right', Colniza:'right', 'Alta Floresta':'left'}[d.nome] || 'above';
    if ((d.jov >= 6 || d.vagas === 0 && d.jov >= 2.3) && d.nome !== 'Campo Novo do Parecis') {
      const cx = x(d.lon), cy = y(d.lat);
      if (pos === 'right') label(svg, cx + r + 4, cy + 4, d.nome, {size:10, strong:true});
      else if (pos === 'left') label(svg, cx - r - 4, cy + 4, d.nome, {anchor:'end', size:10, strong:true});
      else if (pos === 'below') label(svg, cx, cy + r + 12, d.nome, {anchor:'middle', size:10, strong:true});
      else label(svg, cx, cy - r - 4, d.nome, {anchor:'middle', size:10, strong:true});
    }
  });
}

/* Slope/linhas de duas séries com rótulo direto já em lineChart. Intervalo com whisker: */
function whiskers(host, rows) {
  const W = 640, H = 260, m = {l:44, r:20, t:16, b:56}, svg = make(host, W, H);
  const x = lin(0, rows.length - 1, m.l + 60, W - m.r - 60), y = lin(10, 26, H - m.b, m.t);
  yGrid(svg, y, [10, 14, 18, 22, 26], m.l, W - m.r, v => v + '%');
  S('path', {d:rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.desist)}`).join(''), fill:'none', stroke:C.navy, 'stroke-width':2.5}, svg);
  rows.forEach((r, i) => {
    S('line', {x1:x(i), x2:x(i), y1:y(r.lo), y2:y(r.hi), stroke:C.gray, 'stroke-width':2}, svg);
    [r.lo, r.hi].forEach(v => S('line', {x1:x(i) - 6, x2:x(i) + 6, y1:y(v), y2:y(v), stroke:C.gray, 'stroke-width':2}, svg));
    tipAttr(S('circle', {cx:x(i), cy:y(r.desist), r:7, fill:C.loss}, svg), `<b>${r.q}</b><br>Desistência: ${fmt(r.desist)}% (IC ${fmt(r.lo)}–${fmt(r.hi)})<br>Financiados: ~${r.fin}% das matrículas`);
    label(svg, x(i), H - 30, r.q.split(' · ')[0], {anchor:'middle', strong:true});
    label(svg, x(i), H - 14, '~' + r.fin + '% financiados', {anchor:'middle', size:10});
  });
}

/* Lollipop horizontal divergente (associação) */
function divergingLollipop(host, rows) {
  const W = 470, rh = 40, H = rows.length * rh + 30, m = {l:210, r:16, t:6}, svg = make(host, W, H), x = lin(-.6, .6, m.l, W - m.r);
  S('line', {x1:x(0), x2:x(0), y1:m.t, y2:H - 24, stroke:C.ink}, svg);
  [-.4, -.2, .2, .4].forEach(t => label(svg, x(t), H - 8, (t > 0 ? '+' : '−') + Math.abs(t).toString().replace('0.', '0,'), {anchor:'middle'}));
  rows.forEach(([n, v], i) => {
    const cy = m.t + i * rh + rh / 2, c = v < 0 ? C.blue : C.loss;
    label(svg, m.l - 12, cy + 4, n, {anchor:'end', strong:true});
    S('line', {x1:x(0), x2:x(v), y1:cy, y2:cy, stroke:c, 'stroke-width':2.5}, svg);
    tipAttr(S('circle', {cx:x(v), cy, r:7, fill:c}, svg), `<b>${n}</b><br>Correlação com desistência: ${fmt(v, 2)}<br>${v < 0 ? 'Mais do fator, menos desistência' : 'Mais do fator, mais desistência'}`);
  });
}

function sparkline(host, vals, color) {
  const W = 150, H = 44, svg = make(host, W, H), x = lin(0, vals.length - 1, 4, W - 6), mn = Math.min(...vals), mx = Math.max(...vals), y = lin(mn, mx, H - 8, 6);
  S('path', {d:vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('') + `L${x(vals.length - 1)},${H}L${x(0)},${H}Z`, fill:color, 'fill-opacity':.18}, svg);
  S('path', {d:vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(''), fill:'none', stroke:color, 'stroke-width':2}, svg);
  S('circle', {cx:x(vals.length - 1), cy:y(vals[vals.length - 1]), r:3.5, fill:color}, svg);
}

export {NS, C, S, make, lin, fmt, empty, tipAttr, wrap, label, yGrid, waffle, stackedArea, lineChart, lollipop, dumbbell, heatmap, scatter, funnel, geoDots, whiskers, divergingLollipop, sparkline};
