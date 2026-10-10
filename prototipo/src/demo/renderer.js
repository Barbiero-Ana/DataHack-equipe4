import {GEO_BR, GEO_MT} from '../visualization/geo.js';
import {rng, AREAS, LOCAIS, W, K, INGRESSANTES_2015, factor, weight, ANOS, P1_LOSS, P1_CONC, p1, CURSOS, CURVA, COORTE_F, AREA_F, P3, P3_ANOS, P4, P4_DRIVERS, P5_FUNIL, P5_CURSOS, MUN, MUN_PUBLICA_SHARE, B2_SERIE, B2_QUARTIS, B2_CURSOS, UF, BR_TOTAL, UF_REDE, norm, MUN_ALL, P5_PROF, CPC_FAIXAS, CPC_DESIST, CPC_MOTIVOS, B2_ESTUDANTES, COORTES_ING} from './data.js';
import {NS, C, S, make, lin, fmt, empty, tipAttr, wrap, label, yGrid, waffle, stackedArea, lineChart, lollipop, dumbbell, heatmap, scatter, funnel, geoDots, whiskers, divergingLollipop, sparkline} from '../visualization/charts.js';
import {ramp, RAMP_DIV, RAMP_SEQ, RAMP_TEAL, squarify, treemap, arc, pieOfPie, hbarsGrouped, groupedColumns, choropleth, extremes, gapDots, butterfly} from '../visualization/charts2.js';

// Renderizador original isolado; somente valores demonstrativos, nunca respostas da API.
export function createDemo(root, filters, onNavigate) {
const state = {...filters};
const loc = {uf:null, ufm:'desist', p2:'maiores', p3:{pub:true, pri:true, pres:true, ead:true}, p4:1, mun:null, munm:'v100', ans:0};
const $ = id => root.querySelector(`#${id}`);
const CH = {rede:'Rede', grau:'Grau', area:'Área', local:'Polo'};
const P = '%';

/* ---------- utilitários de negócio ---------- */
const kRede = () => state.rede === 'todas' ? 1 : K.rede[state.rede];
const kOther = () => factor({...state, rede:'todas'});
const sh = r => state.rede === 'todas' ? 1 : (r === 'publica' ? .14 : .86);
const p2rows = () => CURSOS.filter(c => (state.area === 'todas' || c.area === state.area) && (state.grau === 'todos' || c.grau === state.grau))
  .map(c => ({...c, d:state.rede === 'publica' ? c.pub : state.rede === 'privada' ? c.priv : c.tot, ingR:Math.round(c.ing * (state.rede === 'todas' ? 1 : state.rede === 'publica' ? .35 : .9))}));
const p4pts = () => P4.filter(c => (state.rede === 'todas' || c.rede === state.rede) && (state.area === 'todas' || c.area === state.area) && (state.grau === 'todos' || c.grau === state.grau) && c.cpc >= loc.p4);
const GRUPOS = P3.map((g, i) => ({...g, conc:[52, 36, 30, 22][i], perm:[8, 6, 10, 7][i], desist:[40, 58, 60, 71][i]}));
const grupoAdj = g => { const d = Math.min(90, g.desist * kOther()), c = Math.max(3, g.conc - (d - g.desist) * .8); return {...g, desist:d, conc:c, perm:Math.max(1, 100 - d - c)}; };
const gActive = () => GRUPOS.filter(g => state.rede === 'todas' || g.rede === state.rede).map(grupoAdj);
const GCOR = {'pub-pres':C.navy, 'pri-pres':C.loss, 'pub-ead':C.sky, 'pri-ead':C.sand};
const nk = v => v.toLocaleString('pt-BR');

/* ---------- componentes ---------- */
const chips = ap => `<div class="chips">${Object.keys(CH).map(k => `<span class="chip ${ap.includes(k) ? '' : 'off'}">${CH[k]}</span>`).join('')}</div>`;
const pageHead = p => `<div class="page-head"><div class="grow"><h2>${p.title}</h2>${p.sub ? `<p>${p.sub}</p>` : ''}</div>${p.src ? `<span class="src">${p.src} · simulação</span>` : ''}</div>`;
const card = (t, h, body, cls = '') => `<div class="card ${cls}"><h3>${t}</h3><p class="hint">${h}</p>${body}</div>`;
const slot = id => `<div id="${id}"></div>`;
const KICON = [[/ingressantes|jovens/i, 'users'], [/conclu/i, 'graduation-cap'], [/desist|evas|menos desist/i, 'sign-out-alt'], [/permanec|cursando|cursavam/i, 'hourglass'], [/ano de maior|º ano/i, 'calendar'], [/proficientes/i, 'trophy'], [/munic/i, 'map-marker'], [/vagas/i, 'school'], [/fies|prouni|financ/i, 'coins']];
const kpi = (v, l, c = C.loss) => `<div class="kpi"><i class="fi fi-rr-${(KICON.find(k => k[0].test(l)) || [0, 'chart-histogram'])[1]} bg"></i><b>${v}</b><span>${l}</span></div>`;
const seg = (key, opts) => `<div class="seg" data-seg="${key}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(loc[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
const legend = items => `<div class="legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;
const rampLegend = (stops, a, b) => `<div class="legend"><span>${a}</span><span class="ramp">${[0, .2, .4, .6, .8, 1].map(t => `<i style="background:${ramp(t, stops)}"></i>`).join('')}</span><span>${b}</span></div>`;

/* ---------- gráficos reutilizáveis (páginas e respostas) ---------- */
function drawStacked(h, d) { stackedArea(h, d.cum, [{nome:'Concluiu', cor:C.blue, key:'concluiu'}, {nome:'Cursando', cor:C.gray, key:'cursando'}, {nome:'Desistiu', cor:C.loss, key:'desistiu'}]); }
function drawCohorts(h) {
  const fa = state.area === 'todas' ? 1 : AREA_F[state.area], fk = (state.grau === 'todos' ? 1 : K.grau[state.grau]) * kRede();
  const cs = [2015, 2016, 2017, 2018, 2019, 2020], cores = [C.navy, C.blue, '#4fa8a3', C.sky, C.loss, C.lossDeep];
  lineChart(h, ['1º', '2º', '3º', '4º', '5º', '6º'].map(t => t + ' ano'), cs.map((c, i) => ({nome:'Coorte ' + c, cor:cores[i], dash:i === 5 ? '5 4' : null, noLabel:i > 0 && i < 4, lab:i === 0 ? 'Coortes 2015–18' : null,
    values:CURVA.map((v, j) => j < Math.min(6, 2024 - c + 1) ? Math.min(95, v * COORTE_F[c] * fa * fk * (j > 0 && c >= 2019 ? 1 + .03 * j : 1)) : null)})), {unit:P, ymax:80, labelEnd:true});
}
function drawEvasao(h, active, w) { lineChart(h, P3_ANOS, active.map(s => ({nome:s.nome, cor:GCOR[s.id], values:s.evasao.map(v => v * Math.pow(kOther(), .6))})), {unit:P, band:1, bandLabel:'atípico', labelEnd:true, ymax:40, w, h:w ? 280 : 300}); }
function drawMat(h, active) { const w = weight({...state, rede:'todas'}); lineChart(h, P3_ANOS, active.map(s => ({nome:s.nome, cor:GCOR[s.id], values:s.mat.map(v => v * w)})), {unit:' mil', labelEnd:true, ymax:Math.ceil(Math.max(...active.flatMap(s => s.mat)) * weight({...state, rede:'todas'}) / 40) * 40 || 40}); }
function drawScatterCPC(h, pts, w) {
  scatter(h, pts.map(c => ({x:c.cpc, y:c.desist, r:4 + Math.sqrt(c.mat) / 4, cor:c.rede === 'publica' ? C.navy : C.loss, tip:`<b>${c.nome}</b><br>Rede: ${c.rede === 'publica' ? 'Pública' : 'Privada'}<br>CPC: ${fmt(c.cpc)}<br>Desistência: ${fmt(c.desist)}%<br>Matrículas: ${nk(c.mat)}`})),
    {x0:1, x1:5, y0:0, y1:100, xTicks:[1, 2, 3, 4, 5], yUnit:P, xTitle:'CPC contínuo (1 a 5)', yTitle:'Desistência acumulada', trend:true, alpha:.55, w});
}
function p5calc() {
  const k = Math.pow(kRede(), .8), F = P5_FUNIL, des = Math.min(90, F.desistem * k), conc = Math.max(5, 100 - des - F.cursando), enade = conc * F.enade / F.concluem, prof = enade * P5_PROF * (state.rede === 'publica' ? 1.25 : state.rede === 'privada' ? .95 : 1);
  return {des, conc, enade, prof, curs:F.cursando};
}
function drawQuad(h) {
  const off = {Pedagogia:[-10, 4, 'end'], 'Educação Física':[-10, 4, 'end'], Letras:[-10, -8, 'end'], História:[10, -8], Geografia:[10, 12], 'Ciências Biológicas':[10, 14], Química:[-10, 14, 'end'], Matemática:[10, -6], Física:[-10, 4, 'end'], 'Artes Visuais':[10, 4]};
  scatter(h, P5_CURSOS.map(c => ({x:c.desist, y:c.prof, r:7, cor:c.desist < 60 && c.prof > 35 ? C.blue : C.loss, lbl:c.nome, dx:off[c.nome]?.[0], dy:off[c.nome]?.[1], a:off[c.nome]?.[2], tip:`<b>${c.nome}</b><br>Desistência: ${c.desist}%<br>Proficientes: ${c.prof}%`})),
    {x0:45, x1:85, y0:10, y1:50, h:380, xTicks:[50, 60, 70, 80], yTicks:[10, 20, 30, 40, 50], xUnit:P, yUnit:P, xTitle:'Desistência acumulada', yTitle:'Proficientes no Enade 2025', vline:60, hline:35,
      quad:[{x:45.5, y:49, t:'Retém e forma bem', c:C.blue}, {x:84.5, y:11.5, t:'Perde e forma mal', c:C.loss, a:'end'}], alpha:.8});
}
function drawPie(h) { const r = p5calc(); pieOfPie(h, [{nome:'Desistiram', v:r.des, cor:C.loss}, {nome:'Ainda cursando', v:r.curs, cor:C.gray}, {nome:'Concluíram', v:r.conc, cor:C.blue}], 2, [{nome:'Proficientes', v:r.prof / r.conc * 100, cor:C.navy}, {nome:'Não proficientes', v:100 - r.prof / r.conc * 100, cor:C.sky}]); }
function b1rows() { const k = state.rede === 'publica' ? MUN_PUBLICA_SHARE * 1.6 : state.rede === 'privada' ? 1 - MUN_PUBLICA_SHARE * .6 : 1; return MUN_ALL.map(m => ({...m, v100:+(m.v100 * k).toFixed(1), vagas:Math.round(m.vagas * k)})); }
function drawMT(h, rows, metric, onClick) {
  const by = Object.fromEntries(rows.map(m => [m.id, m])), maxV = Math.max(...rows.map(m => m.vagas)), maxJ = Math.max(...rows.map(m => m.jov));
  const low = new Set(rows.filter(m => m.v100 > 0).sort((a, b) => a.v100 - b.v100).slice(0, 15).map(m => m.id)), NO = '#e4e0e5';
  choropleth(h, GEO_MT, it => {
    const m = by[it.id], sel = loc.mun === it.id;
    let fill; if (metric === 'v100') fill = m.v100 === 0 ? NO : ramp(m.v100 / 35, RAMP_TEAL); else if (metric === 'vagas') fill = m.vagas === 0 ? NO : ramp(Math.sqrt(m.vagas / maxV), RAMP_TEAL);
    else if (metric === 'jov') fill = ramp(Math.sqrt(m.jov / maxJ), RAMP_SEQ); else fill = m.v100 === 0 ? NO : low.has(m.id) ? C.lossDeep : '#bfe3e0';
    return {fill, stroke:sel ? C.ink : '#fff', sw:sel ? 2.4 : .7, tip:`<b>${m.nome}</b><br>Jovens de 18–24 anos: ${fmt(m.jov, 2)} mil<br>Vagas presenciais: ${nk(m.vagas)}<br>Vagas por 100 jovens: ${m.v100 > 0 ? fmt(m.v100, 1) : 'sem oferta'}`};
  }, onClick);
}
function drawWhisk(h) { whiskers(h, B2_QUARTIS); }
function drawB2Scatter(h, pts, w) {
  scatter(h, pts.map(c => ({x:c.fin, y:c.desist, r:4 + Math.sqrt(c.mat) / 5, cor:C.loss, tip:`<b>${c.nome}</b><br>Financiados: ${fmt(c.fin)}%<br>Desistência: ${fmt(c.desist)}%<br>Matrículas: ${nk(c.mat)}`})),
    {x0:0, x1:40, y0:0, y1:40, h:340, w, xTicks:[0, 10, 20, 30, 40], yTicks:[0, 10, 20, 30, 40], xUnit:P, yUnit:P, xTitle:'Matrículas financiadas (FIES + ProUni)', yTitle:'Desistência anual', trend:true, alpha:.55});
}

/* ---------- páginas ---------- */
const PAGES = [];
const addPage = (cfg) => PAGES.push(cfg);

/* Brasil */
const curveBR = (des, conc) => { const sl = P1_LOSS.reduce((a, b) => a + b), sc = P1_CONC.reduce((a, b) => a + b); let a = 0, b = 0; return ANOS.map((_, i) => { a += P1_LOSS[i] / sl * des; b += P1_CONC[i] / sc * conc; return {des:a, conc:b}; }); };
const ufv = sig => { const [ing, d, c] = UF[sig], fr = UF_REDE[state.rede]; const des = Math.min(90, d * (fr ? fr[0] : 1)), conc = Math.min(97 - des, c * (fr ? fr[1] : 1)); return {ing:ing * (state.rede === 'todas' ? 1 : sh(state.rede)), des, conc, curs:100 - des - conc}; };
const brv = () => { const des = BR_TOTAL.desist * (UF_REDE[state.rede] ? UF_REDE[state.rede][0] : 1), conc = Math.min(97 - des, BR_TOTAL.conc * (UF_REDE[state.rede] ? UF_REDE[state.rede][1] : 1)); return {ing:BR_TOTAL.ing * (state.rede === 'todas' ? 1 : sh(state.rede)), des, conc, curs:100 - des - conc}; };
addPage({id:'br', tag:'BR', cls:'geral', title:'Panorama nacional', sub:'Coorte 2015, graduações presenciais, acompanhadas até 2024. Clique em um estado para ver os detalhes.', src:'Trajetória', applies:['rede'], render(el) {
  const sel = loc.uf, B = brv(), U = sel ? ufv(sel) : B, nome = sel ? GEO_BR.items.find(i => i.sigla === sel).nome : 'Brasil';
  const rank = sel ? Object.keys(UF).sort((a, b) => ufv(a).des - ufv(b).des).indexOf(sel) + 1 : null;
  const dl = (a, b, inv) => { const d = a - b; return `<span class="delta ${(d > 0) !== !!inv ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmt(d, 1)} p.p.</span>`; };
  el.innerHTML = pageHead(this) + `<div class="grid c12">
    ${card('Mapa por estado', 'Cada estado é colorido pelo indicador escolhido', `<div class="ctl"><label>Indicador${seg('ufm', [['desist', 'Desistência'], ['conc', 'Conclusão'], ['ing', 'Ingressantes']])}</label></div>${slot('mapbr')}<div id="mapbr-leg"></div>`)}
    <div class="grid" style="margin:0;align-content:start">
      <div class="card accent"><div class="info-title"><span class="tag">${sel || 'BR'}</span><h3>${nome}</h3></div>
        <p class="hint">${sel ? `${rank}º menor índice de desistência entre as 27 UFs` : 'Total nacional. Selecione um estado no mapa.'}</p>
        <div class="kpis" style="grid-template-columns:repeat(2,1fr);margin:0 0 10px">${kpi(fmt(U.ing, 1) + ' mil', 'ingressantes em 2015', C.navy)}${kpi(fmt(U.des, 0) + P, 'desistiram', C.loss)}${kpi(fmt(U.conc, 0) + P, 'concluíram', C.blue)}${kpi(fmt(U.curs, 0) + P, 'ainda cursavam em 2024', C.gray)}</div>
        <div class="strip"><span style="width:${U.conc}%;background:${C.blue}"></span><span style="width:${U.curs}%;background:${C.gray}"></span><span style="width:${U.des}%;background:${C.loss}"></span></div>
        ${sel ? `<table class="table"><tr><th>Indicador</th><th class="n">${sel}</th><th class="n">Brasil</th><th class="n">Diferença</th></tr>
          <tr><td>Desistência</td><td class="n">${fmt(U.des, 1)}%</td><td class="n">${fmt(B.des, 1)}%</td><td class="n">${dl(U.des, B.des)}</td></tr>
          <tr><td>Conclusão</td><td class="n">${fmt(U.conc, 1)}%</td><td class="n">${fmt(B.conc, 1)}%</td><td class="n">${dl(U.conc, B.conc, true)}</td></tr>
          <tr><td>Participação nos ingressantes</td><td class="n">${fmt(U.ing / B.ing * 100, 1)}%</td><td class="n">100%</td><td class="n">—</td></tr></table>` : ''}
      </div>
      ${card('Evolução nacional', sel ? `Acumulado ao longo dos anos: Brasil e ${sel}` : 'Desistência e conclusão acumuladas da coorte 2015', slot('nat'))}
    </div></div>`;
  const metric = loc.ufm, vals = Object.values(UF).map((_, i) => 0);
  const get = sig => { const v = ufv(sig); return metric === 'desist' ? v.des : metric === 'conc' ? v.conc : Math.sqrt(v.ing); };
  const all = Object.keys(UF).map(get), mn = Math.min(...all), mx = Math.max(...all), stops = metric === 'conc' ? RAMP_TEAL : RAMP_SEQ;
  choropleth($('mapbr'), GEO_BR, it => { const v = ufv(it.sigla), q = (get(it.sigla) - mn) / (mx - mn || 1), s = it.sigla === sel;
    return {fill:ramp(q, stops), stroke:s ? C.ink : '#fff', sw:s ? 2.4 : .8, tip:`<b>${it.nome} (${it.sigla})</b><br>Ingressantes: ${fmt(v.ing, 1)} mil<br>Desistência: ${fmt(v.des, 1)}%<br>Conclusão: ${fmt(v.conc, 1)}%`}; }, it => { loc.uf = loc.uf === it.sigla ? null : it.sigla; renderAll(); });
  const f = metric === 'ing' ? [fmt(Math.min(...Object.keys(UF).map(s => ufv(s).ing)), 1) + ' mil', fmt(Math.max(...Object.keys(UF).map(s => ufv(s).ing)), 0) + ' mil'] : [fmt(mn, 0) + P, fmt(mx, 0) + P];
  $('mapbr-leg').innerHTML = rampLegend(stops, f[0], f[1]);
  const cb = curveBR(B.des, B.conc), cu = sel ? curveBR(U.des, U.conc) : null;
  const ser = [{nome:'Desistência Brasil', cor:C.loss, values:cb.map(d => d.des)}, {nome:'Conclusão Brasil', cor:C.blue, values:cb.map(d => d.conc)}];
  if (cu) ser.push({nome:'Desistência ' + sel, cor:C.lossDeep, dash:'5 4', values:cu.map(d => d.des)}, {nome:'Conclusão ' + sel, cor:C.navy, dash:'5 4', values:cu.map(d => d.conc)});
  lineChart($('nat'), ANOS, ser, {unit:P, ymax:60, h:240, labelEnd:true});
}});

/* P1 */
addPage({id:'p1', tag:'P1', title:'Trajetória acadêmica', sub:'Coorte 2015, presencial: quanto da turma desistiu, concluiu e seguia em 2024.', src:'Trajetória', applies:['rede', 'grau', 'area', 'local'], render(el) {
  const d = p1(state), L = d.last, w = weight(state);
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(d.n), 'ingressantes na coorte 2015', C.navy)}${kpi(fmt(L.concluiu, 0) + P, 'concluíram', C.blue)}${kpi(fmt(L.desistiu, 0) + P, 'desistiram', C.loss)}${kpi(fmt(L.cursando, 0) + P, 'permaneciam em 2024', C.gray)}${kpi((d.peak.ano - 2014) + 'º ano', 'de maior desistência (' + fmt(d.peak.perda, 1) + ' p.p.)', C.sand)}</div>
   <div class="grid c21">${card('Evolução da desistência e da conclusão', 'Percentual acumulado da turma original em cada ano de acompanhamento', slot('p1l'))}${card('Ingressantes por coorte', 'Total de ingressantes (mil) em cada coorte', slot('p1c'))}</div>
   <div class="grid c21">${card('Situação da turma ao longo dos anos', 'Participação da turma original, somando 100% em cada ano', slot('p1a'))}${card('Perda a cada ano', 'Pontos percentuais da turma que desistem em cada ano (pico em destaque)', slot('p1b'))}</div>`;
  lineChart($('p1l'), ANOS, [{nome:'Desistência', cor:C.loss, values:d.cum.map(x => x.desistiu)}, {nome:'Conclusão', cor:C.blue, values:d.cum.map(x => x.concluiu)}, {nome:'Permanência', cor:C.gray, values:d.cum.map(x => x.cursando)}], {unit:P, ymax:100, labelEnd:true, h:280});
  lineChart($('p1c'), Object.keys(COORTES_ING), [{nome:'Ingressantes', cor:C.navy, values:Object.values(COORTES_ING).map(v => v * w)}], {unit:' mil', ymax:60, h:280, w:460});
  drawStacked($('p1a'), d); lollipop($('p1b'), d.cum, 'perda', d.cum.indexOf(d.peak));
}});

/* P3 */
addPage({id:'p3', tag:'P3', title:'Comparativo por rede e modalidade', sub:'Permanência, conclusão e desistência por rede e modalidade; matrículas e evasão anual, 2021–2024.', src:'Censo', applies:['rede', 'grau', 'area', 'local'], render(el) {
  const g = gActive(), act = P3.filter(s => (state.rede === 'todas' || s.rede === state.rede) && loc.p3[s.rede === 'publica' ? 'pub' : 'pri'] && loc.p3[s.mod === 'presencial' ? 'pres' : 'ead']);
  const tog = (key, t) => `<button type="button" class="${loc.p3[key] ? '' : 'off'}" data-t="${key}" style="${loc.p3[key] ? 'background:var(--ink);color:#fff' : ''}">${t}</button>`;
  const cell = (id, ind) => { const x = g.find(z => z.id === id); return x ? fmt(x[ind], 0) + P : '—'; };
  el.innerHTML = pageHead(this) + `<div class="grid c2">${card('Presencial', 'Coorte 2015: situação em 2024 por rede', slot('p3a'))}${card('EAD', 'Coorte 2015: situação em 2024 por rede', slot('p3b'))}</div>
   <div class="grid c2">${card('Tabela comparativa', 'Indicadores por rede e modalidade', `<table class="table"><tr><th>Indicador</th><th class="n">Pública presencial</th><th class="n">Privada presencial</th><th class="n">Pública EAD</th><th class="n">Privada EAD</th></tr>${[['perm', 'Permanência'], ['conc', 'Conclusão'], ['desist', 'Desistência']].map(([k, t]) => `<tr><td><b>${t}</b></td>${GRUPOS.map(x => `<td class="n">${cell(x.id, k)}</td>`).join('')}</tr>`).join('')}</table>`)}
    ${card('Matrículas por rede e modalidade', 'Em milhares, 2021–2024', slot('p3m'))}</div>
   <div class="grid">${card('Evasão anual', 'Percentual de matriculados que saíram do curso em cada ano; a faixa marca o ano atípico', `<div class="ctl"><label>Rede<div class="seg">${tog('pub', 'Pública')}${tog('pri', 'Privada')}</div></label><label>Modalidade<div class="seg">${tog('pres', 'Presencial')}${tog('ead', 'EAD')}</div></label></div>${slot('p3e')}`)}</div>`;
  const inds = ['Permanência', 'Conclusão', 'Desistência'], keys = ['perm', 'conc', 'desist'];
  ['pres', 'ead'].forEach(mod => { const ss = g.filter(x => x.mod === (mod === 'pres' ? 'presencial' : 'ead')); ss.length ? groupedColumns($('p3' + (mod === 'pres' ? 'a' : 'b')), inds, ss.map(s => ({nome:s.rede === 'publica' ? 'Pública' : 'Privada', cor:s.rede === 'publica' ? C.navy : C.loss, values:keys.map(k => s[k])})), {vf:v => fmt(v, 0) + P, ymax:100, yf:v => v + P, h:270}) : empty($('p3' + (mod === 'pres' ? 'a' : 'b'))); });
  drawMat($('p3m'), P3.filter(s => state.rede === 'todas' || s.rede === state.rede));
  act.length ? drawEvasao($('p3e'), act, 1100) : empty($('p3e'), 'Selecione ao menos uma rede e uma modalidade.');
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { loc.p3[b.dataset.t] = !loc.p3[b.dataset.t]; renderAll(); });
}});

/* P2 */
addPage({id:'p2', tag:'P2', title:'Cursos e áreas do conhecimento', sub:'Tamanho = ingressantes; cor = desistência (verde-água baixa, coral alta). Comparação de coortes no mesmo ano do curso.', src:'Trajetória', applies:['rede', 'grau', 'area'], render(el) {
  const rows = p2rows(), show = {publica:state.rede !== 'privada', privada:state.rede !== 'publica'};
  const ord = rows.slice().sort((a, b) => loc.p2 === 'maiores' ? b.tot - a.tot : a.tot - b.tot).slice(0, 8);
  const areas = AREAS.map(a => { const r = rows.filter(c => c.area === a); const ing = r.reduce((s, c) => s + c.ingR, 0); return {a, ing, d:r.length ? r.reduce((s, c) => s + c.d * c.ingR, 0) / ing : null, n:r.length}; }).filter(x => x.n).sort((a, b) => b.d - a.d);
  el.innerHTML = pageHead(this) + `<div class="grid">${card('Mapa de árvore: cursos agrupados por área', 'Cada retângulo é um curso', rows.length ? `${slot('tm')}${rampLegend(RAMP_DIV, 'menor desistência', 'maior desistência')}` : '<div class="empty">Nenhum curso atende aos filtros selecionados.</div>')}</div>
   <div class="grid c2">${card('Cursos nos extremos', 'Maiores e menores desistências acumuladas (coorte 2015), a partir da média dos cursos', slot('p2a'))}
    ${card('Coortes no mesmo ano do curso', 'Desistência acumulada até o 1º, 2º... ano de cada coorte', slot('p2b'))}</div>
   <div class="grid">${card('Áreas de conhecimento', 'Ordenadas da maior para a menor desistência média', `<table class="table"><tr><th>Área (CINE)</th><th class="n">Cursos</th><th class="n">Ingressantes</th><th class="n">Desistência</th></tr>${areas.map(x => `<tr><td><span class="dot" style="background:${ramp((x.d - 10) / 70, RAMP_DIV)}"></span>${x.a}</td><td class="n">${x.n}</td><td class="n">${nk(x.ing)}</td><td class="n"><b>${fmt(x.d, 0)}%</b></td></tr>`).join('') || '<tr><td colspan="4">Sem dados no recorte.</td></tr>'}</table>`)}</div>`;
  if (rows.length) { treemap($('tm'), AREAS.map(a => ({nome:a, children:rows.filter(c => c.area === a).map(c => ({nome:c.nome, v:c.ingR, c:c.d}))})).filter(g => g.children.length), {h:440}); extremes($('p2a'), rows); } else empty($('p2a'));
  drawCohorts($('p2b'));
}});

/* P4 */
addPage({id:'p4', tag:'P4', title:'Qualidade do ensino', sub:'CPC de cada curso, desistência por faixa de CPC e fatores de qualidade associados.', src:'CPC + Trajetória', applies:['rede', 'grau', 'area'], render(el) {
  const pts = p4pts(), k = kOther() * (state.rede === 'todas' ? 1 : Math.pow(kRede(), .5));
  const byName = {}; pts.forEach(p => { (byName[p.nome] = byName[p.nome] || []).push(p); });
  const tb = Object.entries(byName).map(([n, a]) => ({n, cpc:a.reduce((s, x) => s + x.cpc, 0) / a.length, d:a.reduce((s, x) => s + x.desist, 0) / a.length, q:a.length})).sort((a, b) => b.cpc - a.cpc).slice(0, 10);
  el.innerHTML = pageHead(this) + `<div class="grid c21">${card('CPC × desistência', 'Cada bolha é um curso; tamanho = matrículas; linha tracejada = tendência', `<div class="ctl"><label>CPC mínimo<select id="p4min">${[1, 2, 3, 4].map(v => `<option value="${v}" ${loc.p4 === v ? 'selected' : ''}>${v === 1 ? 'Todos' : '≥ ' + v}</option>`).join('')}</select></label></div>${slot('p4a')}${legend([[C.navy, 'Pública'], [C.loss, 'Privada']])}<div id="p4r" class="note"></div>`)}
    ${card('CPC por curso', 'Média dos cursos do recorte, do maior para o menor CPC', `<table class="table"><tr><th>Curso</th><th class="n">CPC</th><th class="n">Desistência</th></tr>${tb.map(x => `<tr><td>${x.n}</td><td class="n"><b>${fmt(x.cpc, 2)}</b></td><td class="n">${fmt(x.d, 0)}%</td></tr>`).join('') || '<tr><td colspan="3">Sem cursos no recorte.</td></tr>'}</table>`)}</div>
   <div class="grid c2">${card('Desistência por faixa de CPC e grupo', 'Percentual médio de desistência em cada faixa, por rede e modalidade', slot('p4h1'))}${card('O que mais separa os cursos', 'Desistência dos cursos com nota alta e baixa em cada componente do CPC; a diferença indica o peso do motivo', slot('p4h2'))}</div>`;
  $('p4min').onchange = e => { loc.p4 = +e.target.value; renderAll(); };
  if (pts.length) { drawScatterCPC($('p4a'), pts); $('p4r').textContent = pts.length > 2 ? `Correlação ${fmt($('p4a')._r, 2)} em ${pts.length} cursos: cada ponto a mais de CPC reduz a desistência em cerca de ${fmt(Math.abs($('p4a')._b), 1)} p.p.` : ''; } else empty($('p4a'));
  const gr = GRUPOS.filter(g => state.rede === 'todas' || g.rede === state.rede), off = {'pub-pres':-10, 'pri-pres':0, 'pub-ead':5, 'pri-ead':11};
  lineChart($('p4h1'), CPC_FAIXAS, gr.map(g => ({nome:g.nome, cor:GCOR[g.id], values:CPC_DESIST.map(v => Math.min(95, (v + off[g.id]) * k))})), {unit:P, ymax:100, labelEnd:true, h:300});
  const base = CPC_DESIST.reduce((s, v) => s + v, 0) / CPC_DESIST.length * k;
  gapDots($('p4h2'), CPC_MOTIVOS.map(([n, o]) => ({nome:n, lo:Math.min(95, base + o * 1.6 * k), hi:Math.max(3, base - o * 1.2 * k)})).sort((a, b) => (b.lo - b.hi) - (a.lo - a.hi)));
}});

/* P5 */
addPage({id:'p5', tag:'P5', title:'Licenciaturas e Enade', sub:'Ingressantes, concluintes, desistência e proficiência no Enade 2025.', src:'Enade + Trajetória', applies:['rede'], render(el) {
  const r = p5calc(), ord = P5_CURSOS.slice().sort((a, b) => b.ing - a.ing), ks = Math.pow(kRede(), .8), sc = state.rede === 'todas' ? 1 : sh(state.rede);
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(fmt(r.des, 0) + P, 'desistem', C.loss)}${kpi(fmt(r.conc, 0) + P, 'concluem', C.blue)}${kpi(fmt(r.prof, 0), 'chegam proficientes (de cada 100)', C.navy)}${kpi(fmt(r.prof / r.conc * 100, 0) + P, 'dos concluintes são proficientes', C.sand)}</div>
   <div class="grid c2">${card('Ingressantes e concluintes por licenciatura', 'Coorte 2015, em pessoas', slot('p5a'))}${card('Pizza de pizza', 'Situação dos ingressantes e perfil dos concluintes no Enade', slot('p5p'))}</div>
   <div class="grid c2">${card('Do ingresso à proficiência', 'De cada 100 ingressantes em licenciaturas', slot('p5f'))}${card('Desistência × proficiência por curso', 'Canto superior esquerdo é o ideal', slot('p5s'))}</div>
   <div class="grid">${card('Desistência e proficiência por licenciatura', 'Cada licenciatura com a desistência à esquerda e a proficiência à direita, da maior para a menor desistência', slot('p5h'))}</div>`;
  hbarsGrouped($('p5a'), ord.map(c => ({nome:c.nome, vals:[Math.round(c.ing * sc), Math.round(c.conc * sc * (1 / ks))]})), [{nome:'Ingressantes', cor:C.navy}, {nome:'Concluintes', cor:C.loss}], {f:v => nk(v)});
  drawPie($('p5p'));
  funnel($('p5f'), [{nome:'Ingressam', v:100, cor:C.navy, nota:'Coorte 2015, licenciaturas presenciais'}, {nome:'Seguem ou concluem', v:100 - r.des, cor:C.blue, nota:'Não desistiram até 2024'}, {nome:'Concluem', v:r.conc, cor:'#4fa8a3', nota:'Obtiveram o diploma'}, {nome:'Prestam o Enade', v:r.enade, cor:C.sky, nota:'Concluintes com prova válida'}, {nome:'Proficientes', v:Math.max(r.prof, 4), cor:C.loss, nota:'Níveis 4 e 5 do Enade 2025'}]);
  drawQuad($('p5s'));
  butterfly($('p5h'), P5_CURSOS.slice().sort((a, b) => b.desist - a.desist).map(c => ({nome:c.nome, l:Math.min(95, c.desist * ks), r:c.prof})), {nome:'Desistência acumulada', cor:C.loss, max:100}, {nome:'Proficientes no Enade 2025', cor:C.navy, max:60});
}});

/* B1 */
addPage({id:'b1', tag:'B1', cls:'bonus', title:'Distribuição geográfica da oferta', sub:'Vagas presenciais por município de Mato Grosso, jovens de 18 a 24 anos e vagas por 100 jovens.', src:'Censo + IBGE', applies:['rede'], render(el) {
  const rows = b1rows(), des = rows.filter(m => m.vagas === 0), jovDes = des.reduce((a, m) => a + m.jov, 0), jovTot = rows.reduce((a, m) => a + m.jov, 0), sel = rows.find(m => m.id === loc.mun);
  const low = rows.filter(m => m.v100 > 0).sort((a, b) => a.v100 - b.v100).slice(0, 8), top = des.slice().sort((a, b) => b.jov - a.jov).slice(0, 8);
  const legs = {v100:rampLegend(RAMP_TEAL, '0 a 35+ vagas por 100 jovens', '') + legend([['#e4e0e5', 'Sem oferta']]), vagas:rampLegend(RAMP_TEAL, 'menos vagas', 'mais vagas') + legend([['#e4e0e5', 'Sem oferta']]), jov:rampLegend(RAMP_SEQ, 'menos jovens', 'mais jovens'), menor:legend([[C.lossDeep, '15 menores ofertas proporcionais'], ['#bfe3e0', 'Demais com oferta'], ['#e4e0e5', 'Sem oferta']])};
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(rows.length, 'municípios de MT', C.navy)}${kpi(nk(rows.reduce((a, m) => a + m.vagas, 0)), 'vagas presenciais', C.blue)}${kpi(des.length, 'municípios sem oferta presencial', C.loss)}${kpi(fmt(jovDes, 1) + ' mil', `jovens de 18–24 em desertos (${fmt(jovDes / jovTot * 100, 0)}%)`, C.sand)}</div>
   <div class="grid c21">${card('Mapa coroplético de Mato Grosso', 'Clique em um município para ver os detalhes', `<div class="ctl"><label>Indicador${seg('munm', [['v100', 'Vagas por 100 jovens'], ['vagas', 'Vagas presenciais'], ['jov', 'Jovens 18–24'], ['menor', 'Menor oferta']])}</label></div><div style="max-width:620px;margin:auto">${slot('mt')}</div>${legs[loc.munm]}`)}
    <div class="grid" style="margin:0;align-content:start">
      <div class="card accent"><div class="info-title"><span class="tag bonus">MT</span><h3>${sel ? sel.nome : 'Selecione um município'}</h3></div>${sel ? `<table class="table"><tr><td>Jovens de 18 a 24 anos</td><td class="n"><b>${fmt(sel.jov, 2)} mil</b></td></tr><tr><td>Vagas presenciais</td><td class="n"><b>${nk(sel.vagas)}</b></td></tr><tr><td>Vagas por 100 jovens</td><td class="n"><b>${sel.v100 > 0 ? fmt(sel.v100, 1) : 'sem oferta'}</b></td></tr><tr><td>Posição na oferta proporcional</td><td class="n"><b>${rows.slice().sort((a, b) => b.v100 - a.v100).findIndex(m => m.id === sel.id) + 1}º de ${rows.length}</b></td></tr></table>` : '<p class="hint">Os dados do município aparecem aqui.</p>'}</div>
      ${card('Sem oferta, maior população jovem', 'Municípios sem graduação presencial', `<table class="table"><tr><th>Município</th><th class="n">Jovens (mil)</th></tr>${top.map(m => `<tr><td>${m.nome}</td><td class="n">${fmt(m.jov, 2)}</td></tr>`).join('') || '<tr><td colspan="2">Nenhum.</td></tr>'}</table>`)}
      ${card('Menor oferta proporcional', 'Municípios com oferta, em vagas por 100 jovens', `<table class="table"><tr><th>Município</th><th class="n">Vagas/100</th></tr>${low.map(m => `<tr><td>${m.nome}</td><td class="n">${fmt(m.v100, 1)}</td></tr>`).join('')}</table>`)}
    </div></div>`;
  drawMT($('mt'), rows, loc.munm, it => { loc.mun = it.id; renderAll(); });
}});

/* B2 */
addPage({id:'b2', tag:'B2', cls:'bonus', title:'Financiamento estudantil e permanência', sub:'FIES e ProUni na rede privada, 2021–2024, e relação com a desistência.', src:'Censo + Trajetória', applies:['area'], render(el) {
  const E = B2_ESTUDANTES, pts = B2_CURSOS.filter(c => state.area === 'todas' || c.area === state.area), i = 3;
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(E.fies[i]), 'estudantes com FIES em 2024', C.navy)}${kpi(nk(E.prouni[i]), 'estudantes com ProUni em 2024', C.loss)}${kpi(fmt(B2_SERIE.fies[i] + B2_SERIE.prouni[i], 1) + P, 'das matrículas privadas com financiamento', C.sand)}${kpi(fmt(B2_QUARTIS[0].desist - B2_QUARTIS[3].desist, 1) + ' p.p.', 'menos desistência no quartil mais financiado', C.blue)}</div>
   <div class="grid c2">${card('Estudantes financiados por ano', 'Quantidade de estudantes na rede privada', slot('b2c'))}${card('Participação nas matrículas privadas', 'FIES e ProUni, em %', slot('b2a'))}</div>
   <div class="grid c2">${card('Desistência por quartil de financiamento', 'Média (ponto) e intervalo de confiança (traço)', slot('b2q'))}${card('Cada curso privado', 'Financiamento × desistência; tamanho = matrículas', pts.length > 2 ? slot('b2s') + '<div id="b2r" class="note"></div>' : '<div class="empty">Poucos cursos no recorte.</div>')}</div>`;
  groupedColumns($('b2c'), B2_SERIE.anos.map(String), [{nome:'FIES', cor:C.navy, values:E.fies}, {nome:'ProUni', cor:C.loss, values:E.prouni}], {vf:v => (v / 1000).toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' mil', yf:v => (v / 1000) + ' mil', step:8000});
  lineChart($('b2a'), B2_SERIE.anos, [{nome:'ProUni', cor:C.loss, values:B2_SERIE.prouni}, {nome:'FIES', cor:C.navy, values:B2_SERIE.fies}], {unit:P, ymax:10, labelEnd:true, h:300});
  drawWhisk($('b2q'));
  if (pts.length > 2) { drawB2Scatter($('b2s'), pts, 640); $('b2r').textContent = `Correlação ${fmt($('b2s')._r, 2)} entre ${pts.length} cursos.`; }
}});

/* Respostas */
addPage({id:'ans', tag:'R', cls:'geral', title:'Respostas às perguntas', sub:'', src:'Síntese', applies:['rede', 'grau', 'area'], render(el) {
  const d = p1(state), r5 = p5calc(), rows = p2rows(), hi = rows.slice().sort((a, b) => b.tot - a.tot)[0], lo = rows.slice().sort((a, b) => a.tot - b.tot)[0], pts = p4pts(), b1 = b1rows(), des = b1.filter(m => m.vagas === 0), jovDes = des.reduce((a, m) => a + m.jov, 0), jovTot = b1.reduce((a, m) => a + m.jov, 0);
  const A = [
   {t:'P1', q:'Quanto da turma fica pelo caminho?', h:`De cada 100 ingressantes de 2015, ${fmt(d.last.desistiu, 0)} desistem, ${fmt(d.last.concluiu, 0)} concluem e ${fmt(d.last.cursando, 0)} ainda cursam em 2024. A perda é maior no ${d.peak.ano - 2014}º ano.`, s:[[fmt(d.last.desistiu, 0) + P, 'desistência acumulada'], [fmt(d.last.concluiu, 0) + P, 'conclusão'], [(d.peak.ano - 2014) + 'º ano', 'pico de desistência']],
    c1:['Situação da turma', h => drawStacked(h, d)], c2:['Perda anual', h => lollipop(h, d.cum, 'perda', d.cum.indexOf(d.peak))]},
   {t:'P2', q:'Onde a rota mais se perde?', h:hi ? `A rota mais se perde em ${hi.nome} (${hi.tot}% desistem) e menos em ${lo.nome} (${lo.tot}%). Áreas de exatas e licenciaturas concentram as maiores perdas.` : 'Nenhum curso no recorte.', s:hi ? [[hi.tot + P, 'maior desistência: ' + hi.nome], [lo.tot + P, 'menor desistência: ' + lo.nome], [(hi.tot - lo.tot) + ' p.p.', 'amplitude entre cursos']] : [],
    c1:['Cursos nos extremos', h => rows.length ? extremes(h, rows) : empty(h)], c2:['Coortes no mesmo ano do curso', drawCohorts]},
   {t:'P3', q:'Pública × privada, presencial × EAD', h:'2022 é o ano atípico: a evasão sobe em todas as combinações e a privada EAD chega a 34%, mais que o dobro da privada presencial.', s:[['34%', 'evasão da privada EAD em 2022'], ['19,6%', 'privada presencial em 2022'], ['10,9%', 'pública presencial em 2022']],
    c1:['Evasão anual', h => drawEvasao(h, P3.filter(s => state.rede === 'todas' || s.rede === state.rede))], c2:['Matrículas', h => drawMat(h, P3.filter(s => state.rede === 'todas' || s.rede === state.rede))]},
   {t:'P4', q:'Qualidade retém?', h:pts.length > 2 ? 'Sim, em média: cursos com CPC mais alto têm desistência menor, mas a qualidade não explica tudo; docentes titulados e desempenho no Enade pesam mais.' : 'Poucos cursos no recorte.', s:[['−0,64', 'correlação CPC e desistência'], ['≈ 11 p.p.', 'queda por ponto de CPC'], [String(pts.length), 'cursos analisados']],
    c1:['CPC × desistência', h => pts.length ? drawScatterCPC(h, pts) : empty(h)], c2:['Fatores associados', h => divergingLollipop(h, P4_DRIVERS)]},
   {t:'P5', q:'O funil das licenciaturas', h:`Das licenciaturas, ${fmt(r5.des, 0)} de cada 100 desistem e só ${fmt(r5.prof, 0)} chegam proficientes ao Enade: ${fmt(r5.prof / r5.conc * 100, 0)}% de quem conclui.`, s:[[fmt(r5.des, 0) + P, 'desistem'], [fmt(r5.conc, 0) + P, 'concluem'], [fmt(r5.prof / r5.conc * 100, 0) + P, 'dos concluintes proficientes']],
    c1:['Pizza de pizza', drawPie], c2:['Desistência × proficiência', drawQuad]},
   {t:'B1', q:'Desertos de ensino superior', h:`${des.length} dos ${b1.length} municípios de MT não têm oferta presencial: ${fmt(jovDes, 1)} mil jovens (${fmt(jovDes / jovTot * 100, 0)}%) vivem em desertos.`, s:[[String(des.length), 'municípios sem oferta'], [fmt(jovDes, 1) + ' mil', 'jovens de 18–24 anos'], [fmt(jovDes / jovTot * 100, 0) + P, 'da população jovem']],
    c1:['Vagas por 100 jovens', h => { h.style.maxWidth = '560px'; h.style.margin = 'auto'; drawMT(h, b1, 'v100'); }], c2:['Menor oferta proporcional', h => { const l = b1.filter(m => m.v100 > 0).sort((a, b) => a.v100 - b.v100).slice(0, 10); hbarsGrouped(h, l.map(m => ({nome:m.nome, vals:[m.v100]})), [{nome:'Vagas por 100 jovens', cor:C.loss}], {max:12, f:v => fmt(v, 1), ml:150}); }]},
   {t:'B2', q:'Financiamento e permanência', h:`Sim: cursos do quartil mais financiado evadem ${fmt(B2_QUARTIS[0].desist - B2_QUARTIS[3].desist, 1)} p.p. menos que os do quartil menos financiado.`, s:[[fmt(B2_QUARTIS[3].desist, 1) + P, 'desistência no quartil mais financiado'], [fmt(B2_QUARTIS[0].desist, 1) + P, 'no menos financiado'], [fmt(B2_SERIE.fies[3] + B2_SERIE.prouni[3], 1) + P, 'matrículas privadas financiadas']],
    c1:['Quartis de financiamento', drawWhisk], c2:['Estudantes financiados', h => groupedColumns(h, B2_SERIE.anos.map(String), [{nome:'FIES', cor:C.navy, values:B2_ESTUDANTES.fies}, {nome:'ProUni', cor:C.loss, values:B2_ESTUDANTES.prouni}], {vf:v => (v / 1000).toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' mil', yf:v => (v / 1000) + ' mil', step:8000})]}
  ];
  const a = A[loc.ans];
  el.innerHTML = pageHead(this) + `<div class="qcards">${A.map((x, i) => `<button type="button" class="qcard ${i === loc.ans ? 'on' : ''}" data-i="${i}"><span class="qwm ${x.t[0] === 'B' ? 'bonus' : ''}">${x.t}</span><span class="qt">${x.q}</span><b>${x.s[0] ? x.s[0][0] : '—'}</b><span class="ql">${x.s[0] ? x.s[0][1] : ''}</span></button>`).join('')}</div>
   <div class="ans-panel"><div class="ans-head"><span class="tag ${a.t[0] === 'B' ? 'bonus' : ''}">${a.t}</span><div><div class="ans-q">Pergunta</div><h3>${a.q}</h3></div></div>
    <div class="ans-body"><div class="ans-text"><div class="ans-q">Resposta</div><p>${a.h}</p></div><div class="stats">${a.s.map(([v, l]) => kpi(v, l)).join('')}</div></div></div>
   <div class="grid c2" style="margin-top:14px">${card(a.c1[0], 'Evidência principal', slot('ea'))}${card(a.c2[0], 'Evidência complementar', slot('eb'))}</div>`;
  a.c1[1]($('ea')); a.c2[1]($('eb'));
  el.querySelectorAll('.qcard').forEach(b => b.onclick = () => { loc.ans = +b.dataset.i; renderAll(); });
}});


/* Resumo final */
addPage({id:'resumo', tag:'F', cls:'geral', title:'Resumo final', sub:'Três conclusões que os dados sustentam e a recomendação que decorre delas. Reflete os filtros ativos.', src:'Síntese', render(el) {
  const d = p1(state), r5 = p5calc(), rows = p2rows(), hi = rows.slice().sort((x, y) => y.tot - x.tot)[0], pts = p4pts();
  const pe = P3[3].evasao[1], pp = P3[0].evasao[1], dq = B2_QUARTIS[0].desist - B2_QUARTIS[3].desist;
  const C3 = [
   {n:fmt(d.last.desistiu, 0) + P, t:'A maior parte da perda acontece cedo', x:`De cada 100 ingressantes, ${fmt(d.last.desistiu, 0)} desistem. O pico é no ${d.peak.ano - 2014}º ano, com ${fmt(d.peak.perda, 1)} p.p. da turma saindo em um único ano. Quem passa dos primeiros anos tende a concluir.`, ev:'P1 · Trajetória', go:'p1'},
   {n:hi ? hi.tot + P : '—', t:'A perda é desigual entre cursos, redes e modalidades', x:`${hi ? hi.nome + ' perde ' + hi.tot + '% da turma' : 'Os cursos variam muito'}, enquanto a privada EAD chega a ${fmt(pe, 0)}% de evasão anual contra ${fmt(pp, 0)}% na pública presencial. Licenciaturas e exatas concentram as maiores perdas.`, ev:'P2 e P3 · Cursos, rede e modalidade', go:'p2'},
   {n:'−' + fmt(dq, 1).replace('.', ',') + ' p.p.', t:'Qualidade e financiamento ajudam a manter o aluno', x:`Cursos com CPC mais alto têm menos desistência${pts.length > 2 ? ' (correlação ' + fmt($('pg-p4').querySelector('#p4a') ? $('pg-p4').querySelector('#p4a')._r : -.64, 2) + ')' : ''}, e os do quartil mais financiado evadem ${fmt(dq, 1)} p.p. menos. Correlação não prova causa, mas aponta a direção.`, ev:'P4 e B2 · Qualidade e financiamento', go:'p4'}
  ];
  const minis = [
    {v:d.cum.map(x => x.desistiu), cor:C.loss, cap:'Desistência acumulada, 2015–2024'},
    {v:P3[3].evasao, cor:C.sand, cap:'Evasão anual da privada EAD, 2021–2024'},
    {v:B2_QUARTIS.map(q => q.desist), cor:C.blue, cap:'Desistência por quartil de financiamento (Q1 a Q4)'}
  ];
  const steps = [['Quanto', 'P1'], ['Onde', 'P2 · P3'], ['Por quê', 'P4 · B2'], ['O que fazer', 'Recomendação']];
  el.innerHTML = pageHead(this) + `<div class="sum-top"><div class="thesis"><span class="ans-q">Tese</span><p>Mais da metade da turma abandona o curso, principalmente nos primeiros anos. A perda se concentra em licenciaturas, na rede privada e no EAD, e diminui onde há mais qualidade e financiamento.</p></div>
    <div class="path">${steps.map((s, i) => `<div class="step ${i === 3 ? 'last' : ''}"><span class="sn">${i + 1}</span><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('')}</div></div>
   <h3 class="sec">Três conclusões</h3>
   <div class="concl-list">${C3.map((c, i) => `<div class="card concl"><div class="c-num">${i + 1}</div>
     <div class="c-metric"><b>${c.n}</b><span>${c.t}</span></div>
     <div class="c-text"><p>${c.x}</p><button type="button" class="link" data-go="${c.go}"><i class="fi fi-rr-angle-right"></i>Ver evidência: ${c.ev}</button></div>
     <div class="c-mini"><div id="mini${i}"></div><span>${minis[i].cap}</span></div></div>`).join('')}</div>
   <h3 class="sec">Recomendação</h3>
   <div class="reco"><div class="reco-head"><i class="fi fi-rr-flag"></i><div><span class="ans-q">Prioridade de ação</span><h3>Focar a permanência no 2º ano das licenciaturas privadas EAD</h3></div></div>
    <div class="reco-body"><div class="reco-why"><h4>Por que aqui</h4>
      <div class="pills"><div class="pill"><b>${fmt(d.peak.perda, 1)} p.p.</b><span>perdidos no ${d.peak.ano - 2014}º ano, o pico da trajetória</span></div>
      <div class="pill"><b>${fmt(r5.des, 0)} de 100</b><span>desistem nas licenciaturas; só ${fmt(r5.prof, 0)} chegam proficientes</span></div>
      <div class="pill"><b>${fmt(pe, 0)}%</b><span>de evasão anual na privada EAD, a maior de todas</span></div></div></div>
     <div class="reco-do"><h4>O que fazer</h4><ol class="acts">
      <li><b>Acompanhar cedo</b><span>Busca ativa dos alunos já no 1º e no 2º ano.</span></li>
      <li><b>Financiar a permanência</b><span>Priorizar bolsas onde há menos alunos financiados.</span></li>
      <li><b>Elevar a qualidade</b><span>Atuar em docentes titulados e preparo para o Enade.</span></li>
      <li><b>Ampliar o acesso</b><span>Polos e oferta presencial nos municípios sem graduação.</span></li></ol></div></div></div>
   <p class="note">Valores simulados; serão substituídos pelos dados do INEP e do IBGE quando o backend estiver conectado.</p>`;
  minis.forEach((m, k) => sparkline($('mini' + k), m.v, m.cor));
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(PAGES.findIndex(p => p.id === b.dataset.go)));
}});

/* ---------- orquestração ---------- */
/* ordem de apresentação: Respostas primeiro, Brasil por último */
const pAns = PAGES.splice(PAGES.findIndex(p => p.id === 'ans'), 1)[0], pRes = PAGES.pop(), pBr = PAGES.shift();
PAGES.unshift(pAns); PAGES.push(pRes, pBr);
const i3 = PAGES.findIndex(p => p.id === 'p3'), i2 = PAGES.findIndex(p => p.id === 'p2');
[PAGES[i3], PAGES[i2]] = [PAGES[i2], PAGES[i3]];

function go(i) { onNavigate(PAGES[i].id); }
function renderAll() {
  PAGES.forEach(p => {
    const el = $('pg-' + p.id);
    if (!el) return;
    const scroll = el.scrollTop;
    p.render.call(p, el);
    el.scrollTop = scroll;
  });
  root.querySelectorAll('[data-seg]').forEach(group => group.querySelectorAll('button').forEach(button => {
    button.onclick = () => { loc[group.dataset.seg] = isNaN(button.dataset.v) ? button.dataset.v : +button.dataset.v; renderAll(); };
  }));
}
renderAll();
return { update(next) { Object.assign(state, next); renderAll(); } };
}
