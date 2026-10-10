import {GEO_BR, GEO_MT} from '../visualization/geo.js';
import {C, fmt, empty, stackedArea, lineChart, lollipop, scatter, funnel, sparkline} from '../visualization/charts.js';
import {ramp, RAMP_DIV, RAMP_SEQ, RAMP_TEAL, treemap, hbarsGrouped, groupedColumns, choropleth, butterfly} from '../visualization/charts2.js';
import {extremes, gapDots, whiskers, pieOfPie, correlations} from './fixedCharts.js';
import {DATA, ANOS, CENSO_ANOS, MIN_COORTE, MIN_RANKING, curta, filtra, agrega, porGrupo, tda, spearman, censo, GRUPOS, situacao, lobo, anoAtipico,
  COMPONENTES, cpcPontos, taxa, tercis, enade, municipios, financiamento, quartis, uf, brasil, GRAU_NOME} from './fixed.js';

// Modo "Dados fixos": valores reais e estáticos calculados de /dados por scripts/build_fixed_data.py.
// Não consulta a API; as páginas da API continuam em ApiPages.tsx.
export function createDemo(root, filters, onNavigate) {
const state = {...filters};
const loc = {uf:null, ufm:'desist', p3:{pub:true, pri:true, pres:true, ead:true}, p3ano:2024, p3m:'lobo', p4:0, mun:null, munm:'v100', ans:0};
const $ = id => root.querySelector(`#${id}`);
const P = '%';
const nk = v => Math.round(v).toLocaleString('pt-BR');
const pc = (v, d = 1) => v == null ? '—' : fmt(v, d) + P;
const NOME_MUN = Object.fromEntries(GEO_MT.items.map(i => [i.id, i.nome]));
const GCOR = {'pub-pres':C.navy, 'pri-pres':C.loss, 'pub-ead':C.sky, 'pri-ead':C.sand};

/* ---------- componentes ---------- */
const pageHead = p => `<div class="page-head"><div class="grow"><h2>${p.title}</h2>${p.sub ? `<p>${p.sub}</p>` : ''}</div>${p.src ? `<span class="src">${p.src}</span>` : ''}</div>`;
const card = (t, h, body, cls = '') => `<div class="card ${cls}"><h3>${t}</h3><p class="hint">${h}</p>${body}</div>`;
const slot = id => `<div id="${id}"></div>`;
const KICON = [[/ingressantes|jovens/i, 'users'], [/conclu/i, 'graduation-cap'], [/desist|evas|desvincula/i, 'sign-out-alt'], [/permanec|cursando|cursavam/i, 'hourglass'], [/ano de maior|º ano/i, 'calendar'], [/proficien/i, 'trophy'], [/munic/i, 'map-marker'], [/vagas/i, 'school'], [/fies|prouni|financ/i, 'coins'], [/correla|cpc/i, 'chart-scatter']];
const kpi = (v, l) => `<div class="kpi"><i class="fi fi-rr-${(KICON.find(k => k[0].test(l)) || [0, 'chart-histogram'])[1]} bg"></i><b>${v}</b><span>${l}</span></div>`;
const seg = (key, opts) => `<div class="seg" data-seg="${key}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(loc[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
const legend = items => `<div class="legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;
const rampLegend = (stops, a, b) => `<div class="legend"><span>${a}</span><span class="ramp">${[0, .2, .4, .6, .8, 1].map(t => `<i style="background:${ramp(t, stops)}"></i>`).join('')}</span><span>${b}</span></div>`;
const note = t => `<p class="note">${t}</p>`;
const semDados = (el, p) => { el.innerHTML = pageHead(p) + '<div class="empty">Nenhum curso atende aos filtros selecionados.</div>'; };

/* ---------- recortes reutilizados ---------- */
const cursos = (skip = []) => filtra(DATA.cursos, state, skip);
const forca = r => r == null ? '' : Math.abs(r) < .1 ? 'praticamente nula' : Math.abs(r) < .3 ? 'fraca' : Math.abs(r) < .5 ? 'moderada' : 'forte';
function rotulos(cs) {
  return porGrupo(cs, c => c.rotulo).map(g => {
    const pub = g.lista.filter(c => c.rede === 'publica'), pri = g.lista.filter(c => c.rede === 'privada');
    return {nome:g.k, area:g.lista[0].area, N:g.N, cursos:g.cursos, d:g.fim.tda, C:g.fim.C, pub:pub.length ? agrega(pub).fim.tda : null, priv:pri.length ? agrega(pri).fim.tda : null};
  }).filter(r => r.d != null);
}
function areasRows(cs) { return porGrupo(cs, c => c.area).map(g => ({area:g.k, N:g.N, cursos:g.cursos, d:g.fim.tda, anos:g.anos})).sort((a, b) => b.d - a.d); }
function p3series(cen, metric, grupos) {
  return grupos.map(g => {
    const anos = CENSO_ANOS.map(a => cen.soma(a, g.rede, g.mod));
    const values = CENSO_ANOS.map((a, i) => metric === 'lobo' ? lobo(anos[i], i ? anos[i - 1] : null) : metric === 'desv' ? situacao(anos[i])?.desv ?? null : anos[i].QT_MAT / 1000);
    return {...g, values, anos};
  });
}
const gruposAtivos = () => GRUPOS.filter(g => state.rede === 'todas' || g.rede === state.rede);
function licData() {
  const lic = filtra(DATA.cursos, {...state, grau:'licenciatura'}, ['area']), a = agrega(lic), en = enade(state);
  const part = en.reduce((s, e) => s + e.part, 0), prof = en.reduce((s, e) => s + e.prof, 0);
  const ids = new Set(lic.map(c => c.id)), porArea = {};
  en.filter(e => e.ligado && ids.has(e.id)).forEach(e => { const r = porArea[e.area] = porArea[e.area] || {area:e.area, part:0, prof:0, cs:[]}; r.part += e.part; r.prof += e.prof; r.cs.push(lic.find(c => c.id === e.id)); });
  const areas = Object.values(porArea).map(r => { const g = agrega(r.cs); return {nome:r.area, part:r.part, prof:100 * r.prof / r.part, tda:g.fim.tda, B:g.fim.B, cursos:r.cs.length}; })
    .filter(r => r.B >= 30 && r.part >= 10);
  return {lic, a, part, prof, profPct:part ? 100 * prof / part : null, areas, en};
}
function b1rows() { return municipios(state).map(m => ({...m, nome:NOME_MUN[m.id] || m.id})); }
function b2data() {
  const cen = censo(state), anos = CENSO_ANOS.map(a => cen.soma(a, 'privada', null));
  const serie = {fies:anos.map(o => o.QT_MAT_FIES), pi:anos.map(o => o.QT_MAT_PROUNII), pp:anos.map(o => o.QT_MAT_PROUNIP), mat:anos.map(o => o.QT_MAT)};
  const pts = financiamento(cursos(['rede'])), q = quartis(pts);
  return {serie, pts, q, rho:spearman(pts.map(p => p.fin), pts.map(p => p.tda))};
}

/* ---------- gráficos reutilizáveis (páginas e respostas) ---------- */
const drawStacked = (h, a) => stackedArea(h, a.anos.map(x => ({ano:x.ano, concluiu:x.tca, cursando:x.tap, desistiu:x.tda})), [{nome:'Concluiu', cor:C.blue, key:'concluiu'}, {nome:'Cursando', cor:C.gray, key:'cursando'}, {nome:'Desistiu', cor:C.loss, key:'desistiu'}]);
const drawLoss = (h, a) => lollipop(h, a.anos.map(x => ({ano:x.ano, perda:x.tada})), 'perda', a.anos.indexOf(a.pico));
function drawAreaCurves(h, cs) {
  const ar = areasRows(cs).filter(x => x.N >= MIN_RANKING), tot = agrega(cs);
  if (!ar.length) return empty(h);
  const hi = ar[0], lo = ar[ar.length - 1], series = [{nome:'MT (todas as áreas)', cor:C.ink, w:3, values:tot.anos.map(x => x.tda)}];
  series.push({nome:curta(hi.area), cor:C.loss, values:hi.anos.map(x => x.tda)});
  if (lo !== hi) series.push({nome:curta(lo.area), cor:C.blue, values:lo.anos.map(x => x.tda)});
  lineChart(h, ANOS.map((_, i) => (i + 1) + 'º'), series, {unit:P, ymax:100, labelEnd:true});
}
function drawEvasao(h, metric, w) {
  const act = p3series(censo(state), metric, gruposAtivos().filter(g => loc.p3[g.rede === 'publica' ? 'pub' : 'pri'] && loc.p3[g.mod === 1 ? 'pres' : 'ead']));
  if (!act.length) return empty(h, 'Selecione ao menos uma rede e uma modalidade.');
  const at = anoAtipico(p3series(censo(state), 'desv', gruposAtivos()));
  const ymax = Math.ceil(Math.max(...act.flatMap(s => s.values.filter(v => v != null))) / 10) * 10 || 10;
  lineChart(h, CENSO_ANOS, act.map(s => ({nome:s.nome, cor:GCOR[s.id], values:s.values})), {unit:P, band:at ? at.i : null, bandLabel:'atípico', labelEnd:true, ymax, w, h:w ? 280 : 300});
}
function drawMat(h) { const s = p3series(censo(state), 'mat', gruposAtivos()); lineChart(h, CENSO_ANOS, s.map(x => ({nome:x.nome, cor:GCOR[x.id], values:x.values})), {unit:' mil', labelEnd:true, ymax:Math.ceil(Math.max(...s.flatMap(x => x.values)) / 20) * 20 || 20}); }
function drawScatterCPC(h, pts, w) {
  scatter(h, pts.map(c => ({x:c.cpc, y:c.tda, r:3 + Math.sqrt(c.B) / 3, cor:c.rede === 'publica' ? C.navy : C.loss, tip:`<b>${c.nome}</b><br>IES: ${c.ies}<br>Rede: ${c.rede === 'publica' ? 'Pública' : 'Privada'}<br>CPC ${c.ed}: ${fmt(c.cpc, 2)} (faixa ${c.faixa})<br>Desistência: ${pc(c.tda)}<br>Ingressantes 2015: ${nk(c.B)}`})),
    {x0:0, x1:5, y0:0, y1:100, xTicks:[0, 1, 2, 3, 4, 5], yUnit:P, xTitle:'CPC contínuo (edição mais recente, 2021–2023)', yTitle:'Desistência acumulada', trend:true, alpha:.5, w});
}
function drawPie(h, L) {
  const f = L.a.fim;
  pieOfPie(h, [{nome:'Desistiram', v:f.tda, n:f.S, cor:C.loss}, {nome:'Ainda cursando', v:f.tap, n:f.P, cor:C.gray}, {nome:'Concluíram', v:f.tca, n:f.C, cor:C.blue}], 2,
    [{nome:'Proficientes (Enade 2025)', v:L.profPct, n:L.prof, cor:C.navy}, {nome:'Não proficientes', v:100 - L.profPct, n:L.part - L.prof, cor:C.sky}],
    {mainTitle:'Ingressantes 2015 (trajetória)', subTitle:'Participantes do Enade 2025', subNote:'População diferente: não são as mesmas pessoas'});
}
function drawQuad(h, L) {
  const r = L.areas; if (r.length < 2) return empty(h, 'Poucas licenciaturas com Enade e trajetória no recorte.');
  const xs = r.map(x => x.tda), ys = r.map(x => x.prof), x0 = Math.floor(Math.min(...xs) / 10) * 10 - 5, x1 = Math.ceil(Math.max(...xs) / 10) * 10 + 5, mid = (x0 + x1) / 2;
  const y0 = Math.max(0, Math.floor(Math.min(...ys) / 10) * 10 - 10), y1 = Math.min(100, Math.ceil(Math.max(...ys) / 10) * 10 + 5);
  scatter(h, r.map(c => ({x:c.tda, y:c.prof, r:5 + Math.sqrt(c.part) / 2, cor:c.tda < L.a.fim.tda && c.prof > L.profPct ? C.blue : c.tda > L.a.fim.tda && c.prof < L.profPct ? C.loss : C.gray, lbl:c.nome, dx:c.tda > mid ? -12 : 12, a:c.tda > mid ? 'end' : 'start', dy:4,
    tip:`<b>${c.nome}</b><br>Desistência (coorte 2015): ${pc(c.tda)}<br>Proficientes (Enade 2025): ${pc(c.prof)}<br>Participantes: ${c.part}<br>Cursos ligados: ${c.cursos}`})),
    {x0, x1, y0, y1, h:380, xTicks:Array.from({length:Math.floor((x1 - x0) / 10) + 1}, (_, i) => Math.ceil(x0 / 10) * 10 + i * 10).filter(v => v <= x1), yTicks:Array.from({length:Math.floor((y1 - y0) / 10) + 1}, (_, i) => y0 + i * 10),
      xUnit:P, yUnit:P, xTitle:'Desistência acumulada (coorte 2015)', yTitle:'Proficientes no Enade 2025', vline:L.a.fim.tda, hline:L.profPct,
      quad:[{x:x0 + .5, y:y1 - 1.5, t:'Retém e forma bem', c:C.blue}, {x:x1 - .5, y:y0 + 1.5, t:'Perde e forma mal', c:C.loss, a:'end'}], alpha:.8});
}
function drawMT(h, rows, metric, onClick) {
  const by = Object.fromEntries(rows.map(m => [m.id, m])), maxV = Math.max(...rows.map(m => m.vagas)), maxJ = Math.max(...rows.map(m => m.jov));
  const low = new Set(rows.filter(m => m.vagas > 0).sort((a, b) => a.v100 - b.v100).slice(0, 15).map(m => m.id)), NO = '#e4e0e5';
  choropleth(h, GEO_MT, it => {
    const m = by[it.id], sel = loc.mun === it.id;
    if (!m) return {fill:NO, tip:`<b>${it.nome}</b><br>Sem dados`};
    let fill; if (metric === 'v100') fill = m.vagas === 0 ? NO : ramp(m.v100 / 40, RAMP_TEAL); else if (metric === 'vagas') fill = m.vagas === 0 ? NO : ramp(Math.sqrt(m.vagas / maxV), RAMP_TEAL);
    else if (metric === 'jov') fill = ramp(Math.sqrt(m.jov / maxJ), RAMP_SEQ); else fill = m.vagas === 0 ? NO : low.has(m.id) ? C.lossDeep : '#bfe3e0';
    return {fill, stroke:sel ? C.ink : '#fff', sw:sel ? 2.4 : .7, tip:`<b>${m.nome}</b><br>Jovens de 18–24 anos: ${nk(m.pop)}<br>Vagas presenciais (2022): ${nk(m.vagas)}<br>Vagas por 100 jovens: ${m.vagas > 0 ? fmt(m.v100, 1) : 'sem oferta'}`};
  }, onClick);
}
function drawB2Cols(h, B) {
  groupedColumns(h, CENSO_ANOS.map(String), [{nome:'FIES', cor:C.navy, values:B.serie.fies}, {nome:'ProUni integral', cor:C.loss, values:B.serie.pi}, {nome:'ProUni parcial', cor:C.sand, values:B.serie.pp}],
    {vf:v => v >= 1000 ? fmt(v / 1000, 1) + ' mil' : nk(v), yf:v => fmt(v / 1000, 0) + ' mil', step:2000});
}
function drawB2Scatter(h, pts, w) {
  const x1 = Math.max(10, Math.ceil(Math.max(...pts.map(p => p.fin)) / 10) * 10);
  scatter(h, pts.map(c => ({x:c.fin, y:c.tda, r:3 + Math.sqrt(c.B) / 3, cor:C.loss, tip:`<b>${c.nome}</b><br>IES: ${c.ies}<br>Matrículas financiadas (2021–2024): ${pc(c.fin)}<br>FIES: ${pc(c.fies)} · ProUni: ${pc(c.prouni)}<br>Desistência (coorte 2015): ${pc(c.tda)}`})),
    {x0:0, x1, y0:0, y1:100, h:340, w, xTicks:Array.from({length:x1 / 10 + 1}, (_, i) => i * 10), yTicks:[0, 25, 50, 75, 100], xUnit:P, yUnit:P, xTitle:'Matrículas com FIES ou ProUni, 2021–2024', yTitle:'Desistência (coorte 2015)', trend:true, alpha:.5});
}

/* ---------- páginas ---------- */
const PAGES = [];
const addPage = cfg => PAGES.push(cfg);

/* Brasil */
const ufv = sig => { const a = uf(sig, state.rede); return a ? {ing:a.N / 1000, des:a.fim.tda, conc:a.fim.tca, curs:a.fim.tap, a} : null; };
addPage({id:'br', title:'Panorama nacional', sub:'Coorte 2015, graduações presenciais, acompanhadas até 2024. Clique em um estado para ver os detalhes.', src:'INEP · Trajetória', render(el) {
  const sel = loc.uf, bra = brasil(state.rede), B = {ing:bra.N / 1000, des:bra.fim.tda, conc:bra.fim.tca, curs:bra.fim.tap, a:bra}, U = sel ? ufv(sel) || B : B, nome = sel ? GEO_BR.items.find(i => i.sigla === sel).nome : 'Brasil';
  const ranking = Object.keys(DATA.uf).filter(s => ufv(s)).sort((a, b) => ufv(a).des - ufv(b).des), rank = sel ? ranking.indexOf(sel) + 1 : null;
  const dl = (a, b, inv) => { const d = a - b; return `<span class="delta ${(d > 0) !== !!inv ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmt(d, 1)} p.p.</span>`; };
  el.innerHTML = pageHead(this) + `<div class="grid c12">
    ${card('Mapa por estado', 'Cada estado é colorido pelo indicador escolhido', `<div class="ctl"><label>Indicador${seg('ufm', [['desist', 'Desistência'], ['conc', 'Conclusão'], ['ing', 'Ingressantes']])}</label></div>${slot('mapbr')}<div id="mapbr-leg"></div>`)}
    <div class="grid" style="margin:0;align-content:start">
      <div class="card accent"><div class="info-title"><span class="tag">${sel || 'BR'}</span><h3>${nome}</h3></div>
        <p class="hint">${sel ? `${rank}º menor desistência entre as ${ranking.length} UFs` : 'Total nacional. Selecione um estado no mapa.'}</p>
        <div class="kpis" style="grid-template-columns:repeat(2,1fr);margin:0 0 10px">${kpi(fmt(U.ing, 1) + ' mil', 'ingressantes em 2015')}${kpi(pc(U.des), 'desistiram')}${kpi(pc(U.conc), 'concluíram')}${kpi(pc(U.curs), 'ainda cursavam em 2024')}</div>
        <div class="strip"><span style="width:${U.conc}%;background:${C.blue}"></span><span style="width:${U.curs}%;background:${C.gray}"></span><span style="width:${U.des}%;background:${C.loss}"></span></div>
        ${sel ? `<table class="table"><tr><th>Indicador</th><th class="n">${sel}</th><th class="n">Brasil</th><th class="n">Diferença</th></tr>
          <tr><td>Desistência</td><td class="n">${pc(U.des)}</td><td class="n">${pc(B.des)}</td><td class="n">${dl(U.des, B.des)}</td></tr>
          <tr><td>Conclusão</td><td class="n">${pc(U.conc)}</td><td class="n">${pc(B.conc)}</td><td class="n">${dl(U.conc, B.conc, true)}</td></tr>
          <tr><td>Participação nos ingressantes</td><td class="n">${pc(U.ing / B.ing * 100)}</td><td class="n">100%</td><td class="n">—</td></tr></table>` : ''}
      </div>
      ${card('Evolução nacional', sel ? `Acumulado ao longo dos anos: Brasil e ${sel}` : 'Desistência e conclusão acumuladas da coorte 2015', slot('nat'))}
    </div></div>${note('Fonte: INEP, Indicadores de Trajetória 2015–2024. Taxas sobre ingressantes descontados os falecidos.')}`;
  const metric = loc.ufm, get = sig => { const v = ufv(sig); return !v ? null : metric === 'desist' ? v.des : metric === 'conc' ? v.conc : Math.sqrt(v.ing); };
  const all = Object.keys(DATA.uf).map(get).filter(v => v != null), mn = Math.min(...all), mx = Math.max(...all), stops = metric === 'conc' ? RAMP_TEAL : RAMP_SEQ;
  choropleth($('mapbr'), GEO_BR, it => { const v = ufv(it.sigla), s = it.sigla === sel; if (!v) return {fill:'#e4e0e5', tip:`<b>${it.nome}</b><br>Sem cursos no recorte`};
    return {fill:ramp((get(it.sigla) - mn) / (mx - mn || 1), stops), stroke:s ? C.ink : '#fff', sw:s ? 2.4 : .8, tip:`<b>${it.nome} (${it.sigla})</b><br>Ingressantes: ${nk(v.a.N)}<br>Desistência: ${pc(v.des)}<br>Conclusão: ${pc(v.conc)}`}; }, it => { loc.uf = loc.uf === it.sigla ? null : it.sigla; renderAll(); });
  $('mapbr-leg').innerHTML = rampLegend(stops, metric === 'ing' ? fmt(mn * mn, 1) + ' mil' : pc(mn, 0), metric === 'ing' ? fmt(mx * mx, 0) + ' mil' : pc(mx, 0));
  const ser = [{nome:'Desistência Brasil', cor:C.loss, values:B.a.anos.map(d => d.tda)}, {nome:'Conclusão Brasil', cor:C.blue, values:B.a.anos.map(d => d.tca)}];
  if (sel && U !== B) ser.push({nome:'Desistência ' + sel, cor:C.lossDeep, dash:'5 4', values:U.a.anos.map(d => d.tda)}, {nome:'Conclusão ' + sel, cor:C.navy, dash:'5 4', values:U.a.anos.map(d => d.tca)});
  lineChart($('nat'), ANOS, ser, {unit:P, ymax:80, h:240, labelEnd:true});
}});

/* P1 */
addPage({id:'p1', title:'Trajetória acadêmica', sub:'Coorte 2015, cursos presenciais de Mato Grosso: quanto da turma desistiu, concluiu e seguia em 2024.', src:'INEP · Trajetória', render(el) {
  const cs = cursos(); if (!cs.length) return semDados(el, this);
  const a = agrega(cs), f = a.fim, k = a.pico.ano - 2014, ate2 = a.anos[1].S / f.S * 100;
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(a.N), 'ingressantes na coorte 2015')}${kpi(pc(f.tca), 'concluíram até 2024')}${kpi(pc(f.tda), 'desistiram até 2024')}${kpi(pc(f.tap), 'permaneciam em 2024')}${kpi(k + 'º ano', `de maior desistência (${a.pico.ano}: ${nk(a.pico.s)} estudantes)`)}</div>
   <div class="grid c21">${card('Evolução da desistência e da conclusão', 'Percentual acumulado da turma em cada ano de acompanhamento', slot('p1l'))}${card('Quem compõe a coorte 2015', 'Ingressantes por grau acadêmico e rede (ignora os filtros de rede e grau)', slot('p1c'))}</div>
   <div class="grid c21">${card('Situação da turma ao longo dos anos', 'Concluiu + cursando + desistiu somam 100% em cada ano', slot('p1a'))}${card('Perda a cada ano', `Pontos percentuais da turma que desistem no ano; ${pc(ate2, 0)} das desistências ocorrem até o 2º ano`, slot('p1b'))}</div>
   ${note(`${nk(a.cursos)} cursos. Denominador: ingressantes menos falecidos (${nk(f.B)}). Desistência inclui desvinculação e transferência de curso; não prova abandono do ensino superior. Só a coorte 2015 está disponível nos Indicadores de Trajetória.`)}`;
  lineChart($('p1l'), ANOS, [{nome:'Desistência', cor:C.loss, values:a.anos.map(x => x.tda)}, {nome:'Conclusão', cor:C.blue, values:a.anos.map(x => x.tca)}, {nome:'Permanência', cor:C.gray, values:a.anos.map(x => x.tap)}], {unit:P, ymax:100, labelEnd:true, h:280});
  const comp = cursos(['rede', 'grau']), graus = [1, 2, 3].filter(g => comp.some(c => c.grau === g));
  groupedColumns($('p1c'), graus.map(g => GRAU_NOME[g]), [['publica', 'Pública', C.navy], ['privada', 'Privada', C.loss]].map(([r, n, cor]) => ({nome:n, cor, values:graus.map(g => comp.filter(c => c.grau === g && c.rede === r).reduce((s, c) => s + c.ing, 0))})), {vf:nk, yf:v => fmt(v / 1000, 0) + ' mil', step:4000, h:280, w:460});
  drawStacked($('p1a'), a); drawLoss($('p1b'), a);
}});

/* P2 */
addPage({id:'p2', title:'Cursos e áreas do conhecimento', sub:'Tamanho = ingressantes; cor = desistência acumulada até 2024 (verde-água baixa, coral alta).', src:'INEP · Trajetória', render(el) {
  const cs = cursos(); if (!cs.length) return semDados(el, this);
  const rows = rotulos(cs), mt = agrega(cs).fim.tda, rank = rows.filter(r => r.N >= MIN_RANKING), areas = areasRows(cs);
  el.innerHTML = pageHead(this) + `<div class="grid">${card('Mapa de árvore: cursos agrupados por área', `Cada retângulo reúne os cursos de mesmo nome (rótulo CINE) em MT; grupos com menos de ${MIN_COORTE} ingressantes ficam de fora`, `${slot('tm')}${rampLegend(RAMP_DIV, 'menor desistência', 'maior desistência')}`)}</div>
   <div class="grid c2">${card('Cursos nos extremos', `Seis maiores e seis menores desistências entre cursos com ao menos ${MIN_RANKING} ingressantes, a partir da média de MT`, slot('p2a'))}
    ${card('Ritmo da perda por área, no mesmo ano do curso', 'Desistência acumulada do 1º ao 10º ano: média de MT, área com maior e com menor perda', slot('p2b'))}</div>
   <div class="grid">${card('Áreas de conhecimento', 'Ordenadas da maior para a menor desistência acumulada', `<table class="table"><tr><th>Área (CINE)</th><th class="n">Cursos</th><th class="n">Ingressantes</th><th class="n">Desistência</th></tr>${areas.map(x => `<tr><td><span class="dot" style="background:${ramp((x.d - 10) / 75, RAMP_DIV)}"></span>${x.area}</td><td class="n">${x.cursos}</td><td class="n">${nk(x.N)}</td><td class="n"><b>${pc(x.d)}</b></td></tr>`).join('')}</table>`)}</div>
   ${note('Só existe a coorte 2015 nos Indicadores de Trajetória; por isso a comparação no mesmo ano do curso é feita entre áreas, e não entre coortes.')}`;
  const groups = [...new Set(rows.map(r => r.area))].map(a => ({nome:curta(a), children:rows.filter(r => r.area === a && r.N >= MIN_COORTE).map(r => ({nome:r.nome, v:r.N, c:r.d}))})).filter(g => g.children.length);
  treemap($('tm'), groups, {h:460});
  rank.length >= 2 ? extremes($('p2a'), rank, mt) : empty($('p2a'), 'Poucos cursos com ingressantes suficientes no recorte.');
  drawAreaCurves($('p2b'), cs);
}});

/* P3 */
addPage({id:'p3', title:'Comparativo por rede e modalidade', sub:'Situação dos vínculos, matrículas e evasão anual por rede e modalidade, 2021–2024.', src:'INEP · Censo da Educação Superior', render(el) {
  const cen = censo(state), ano = loc.p3ano, i = CENSO_ANOS.indexOf(ano), gs = gruposAtivos();
  const sit = Object.fromEntries(GRUPOS.map(g => [g.id, situacao(cen.soma(ano, g.rede, g.mod))])), mat = Object.fromEntries(GRUPOS.map(g => [g.id, cen.soma(ano, g.rede, g.mod)]));
  const lb = Object.fromEntries(GRUPOS.map(g => [g.id, i ? lobo(mat[g.id], cen.soma(CENSO_ANOS[i - 1], g.rede, g.mod)) : null]));
  const tog = (key, t) => `<button type="button" data-t="${key}" style="${loc.p3[key] ? 'background:var(--ink);color:#fff' : ''}">${t}</button>`;
  el.innerHTML = pageHead(this) + `<div class="ctl"><label>Ano${seg('p3ano', CENSO_ANOS.map(a => [a, String(a)]))}</label></div>
   <div class="grid c2">${card('Presencial', `Situação dos vínculos em ${ano}, por rede`, slot('p3a'))}${card('EAD', `Situação dos vínculos em ${ano}, por rede`, slot('p3b'))}</div>
   <div class="grid c2">${card('Tabela comparativa', `Indicadores de ${ano} por rede e modalidade`, `<table class="table"><tr><th>Indicador</th>${GRUPOS.map(g => `<th class="n">${g.nome}</th>`).join('')}</tr>
      <tr><td><b>Matrículas</b></td>${GRUPOS.map(g => `<td class="n">${nk(mat[g.id].QT_MAT)}</td>`).join('')}</tr>
      ${[['perm', 'Permanência'], ['conc', 'Conclusão'], ['desv', 'Desvinculação']].map(([k, t]) => `<tr><td><b>${t}</b></td>${GRUPOS.map(g => `<td class="n">${pc(sit[g.id]?.[k])}</td>`).join('')}</tr>`).join('')}
      <tr><td><b>Evasão anual estimada</b></td>${GRUPOS.map(g => `<td class="n">${pc(lb[g.id])}</td>`).join('')}</tr></table>`)}
    ${card('Matrículas por rede e modalidade', 'Em milhares, 2021–2024', slot('p3m'))}</div>
   <div class="grid">${card('Evasão anual', loc.p3m === 'lobo' ? 'Estimativa por balanço de matrículas: 100 × (1 − (Mₜ − Iₜ) ÷ (Mₜ₋₁ − Cₜ₋₁)); 2021 exige o Censo 2020 e fica ausente' : 'Desvinculados + transferidos ÷ todos os vínculos do ano; a faixa marca o ano atípico',
      `<div class="ctl"><label>Medida${seg('p3m', [['lobo', 'Estimativa anual'], ['desv', 'Desvinculação no ano']])}</label><label>Rede<div class="seg">${tog('pub', 'Pública')}${tog('pri', 'Privada')}</div></label><label>Modalidade<div class="seg">${tog('pres', 'Presencial')}${tog('ead', 'EAD')}</div></label></div>${slot('p3e')}`)}</div>
   ${note('Fonte: microdados do Censo da Educação Superior (cursos de graduação ofertados em MT; presencial na dimensão 1 e EAD na dimensão 2). Vínculos = matrículas + trancados + desvinculados + transferidos + falecidos. Permanência = cursando + trancados.')}`;
  const inds = ['Permanência', 'Conclusão', 'Desvinculação'], keys = ['perm', 'conc', 'desv'];
  [[1, 'p3a'], [2, 'p3b']].forEach(([mod, id]) => { const ss = gs.filter(g => g.mod === mod && sit[g.id]); ss.length ? groupedColumns($(id), inds, ss.map(g => ({nome:g.rede === 'publica' ? 'Pública' : 'Privada', cor:g.rede === 'publica' ? C.navy : C.loss, values:keys.map(k => sit[g.id][k])})), {vf:v => fmt(v, 1) + P, ymax:100, yf:v => v + P, h:270}) : empty($(id)); });
  drawMat($('p3m')); drawEvasao($('p3e'), loc.p3m, 1100);
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { loc.p3[b.dataset.t] = !loc.p3[b.dataset.t]; renderAll(); });
}});

/* P4 */
addPage({id:'p4', title:'Qualidade do ensino', sub:'CPC de cada curso, desistência por faixa de CPC e componentes de qualidade associados.', src:'INEP · CPC + Trajetória', render(el) {
  const cs = cursos(), todos = cpcPontos(cs), pts = todos.filter(p => p.cpc >= loc.p4);
  const rho = spearman(pts.map(p => p.cpc), pts.map(p => p.tda)), tb = pts.slice().sort((a, b) => b.cpc - a.cpc).slice(0, 10);
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(pts.length), `cursos com CPC (de ${nk(cs.length)} no recorte)`)}${kpi(rho == null ? '—' : fmt(rho, 2), `correlação CPC × desistência (${forca(rho) || 'sem dados'})`)}${kpi(pc(taxa(pts)), 'desistência desses cursos')}</div>
   <div class="grid c21">${card('CPC × desistência', 'Cada bolha é um curso; tamanho = ingressantes de 2015; linha tracejada = tendência linear', `<div class="ctl"><label>CPC mínimo<select id="p4min">${[0, 2, 3, 4].map(v => `<option value="${v}" ${loc.p4 === v ? 'selected' : ''}>${v === 0 ? 'Todos' : '≥ ' + v}</option>`).join('')}</select></label></div>${slot('p4a')}${legend([[C.navy, 'Pública'], [C.loss, 'Privada']])}`)}
    ${card('CPC por curso', 'Dez maiores CPCs do recorte', `<table class="table"><tr><th>Curso</th><th class="n">CPC</th><th class="n">Desistência</th></tr>${tb.map(x => `<tr><td>${x.nome}<br><span class="hint">${x.ies.length > 40 ? x.ies.slice(0, 39) + '…' : x.ies}</span></td><td class="n"><b>${fmt(x.cpc, 2)}</b></td><td class="n">${pc(x.tda, 0)}</td></tr>`).join('') || '<tr><td colspan="3">Sem cursos no recorte.</td></tr>'}</table>`)}</div>
   <div class="grid c2">${card('Desistência por faixa de CPC e rede', 'Taxa agregada dos cursos de cada faixa; faixas com menos de 5 cursos ficam sem ponto', slot('p4h1'))}${card('O que mais separa os cursos', 'Desistência do tercil de cursos com nota mais alta e mais baixa em cada componente do CPC', slot('p4h2'))}</div>
   ${note('CPC: edição mais recente de cada curso entre 2021 e 2023, ligada por código do curso à trajetória da coorte 2015 (pelo menos 10 ingressantes). O CPC mede o curso anos depois do ingresso; correlação não prova causa.')}`;
  $('p4min').onchange = e => { loc.p4 = +e.target.value; renderAll(); };
  pts.length ? drawScatterCPC($('p4a'), pts) : empty($('p4a'));
  const faixas = [1, 2, 3, 4, 5], fx = l => faixas.map(f => { const q = l.filter(p => p.faixa === f); return q.length >= 5 ? taxa(q) : null; });
  const ser = [['publica', 'Pública', C.navy], ['privada', 'Privada', C.loss]].filter(([r]) => state.rede === 'todas' || state.rede === r).map(([r, n, cor]) => ({nome:n, cor, values:fx(todos.filter(p => p.rede === r))}));
  if (state.rede === 'todas') ser.push({nome:'Todas', cor:C.ink, dash:'5 4', values:fx(todos)});
  todos.length ? lineChart($('p4h1'), faixas.map(f => 'Faixa ' + f), ser, {unit:P, ymax:100, labelEnd:true, h:300}) : empty($('p4h1'));
  const g = COMPONENTES.map(([k, n]) => ({nome:n, ...tercis(todos, k)})).filter(r => r.alto != null).sort((a, b) => (b.baixo - b.alto) - (a.baixo - a.alto));
  g.length ? gapDots($('p4h2'), g) : empty($('p4h2'), 'Poucos cursos com CPC no recorte.');
}});

/* P5 */
addPage({id:'p5', title:'Licenciaturas e Enade', sub:'Ingressantes, concluintes e desistência da coorte 2015 e proficiência no Enade 2025.', src:'INEP · Enade 2025 + Trajetória', render(el) {
  const L = licData(); if (!L.lic.length) return semDados(el, this);
  const f = L.a.fim, rot = rotulos(L.lic).sort((a, b) => b.N - a.N).slice(0, 10);
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(L.a.N), 'ingressantes em licenciaturas (2015)')}${kpi(pc(f.tda), 'desistiram até 2024')}${kpi(pc(f.tca), 'concluíram até 2024')}${kpi(pc(L.profPct), `dos ${nk(L.part)} participantes do Enade 2025 são proficientes`)}</div>
   <div class="grid c2">${card('Ingressantes e concluintes por licenciatura', 'Coorte 2015: ingressantes e concluintes acumulados até 2024', slot('p5a'))}${card('Pizza de pizza', 'Situação dos ingressantes de 2015 e, ao lado, proficiência dos participantes do Enade 2025', slot('p5p'))}</div>
   <div class="grid c2">${card('Do ingresso ao diploma', 'De cada 100 ingressantes em licenciaturas, quantos seguem a cada etapa', slot('p5f'))}${card('Desistência × proficiência por licenciatura', 'Linhas tracejadas: média de MT; bolha = participantes do Enade', slot('p5s'))}</div>
   <div class="grid">${card('Desistência e proficiência por licenciatura', 'Mesmos cursos ligados por código; da maior para a menor desistência', slot('p5h'))}</div>
   ${note('Enade 2025 (concluintes avaliados) e trajetória 2015 (ingressantes) são populações diferentes: as taxas não são multiplicadas. Proficiência = concluintes no padrão 1 de proficiência ou acima ÷ participantes.')}`;
  hbarsGrouped($('p5a'), rot.map(r => ({nome:r.nome.replace(' formação de professor', ''), vals:[r.N, r.C]})), [{nome:'Ingressantes', cor:C.navy}, {nome:'Concluintes', cor:C.loss}], {f:nk, ml:190});
  L.part ? drawPie($('p5p'), L) : empty($('p5p'), 'Sem participantes do Enade no recorte.');
  funnel($('p5f'), [{nome:'Ingressaram', v:100, cor:C.navy, nota:`${nk(L.a.N)} estudantes em 2015`}, {nome:'Seguiam após o 1º ano', v:100 - L.a.anos[0].tda, cor:C.blue, nota:`${pc(L.a.anos[0].tda)} saíram no 1º ano`},
    {nome:'Seguiam após o 2º ano', v:100 - L.a.anos[1].tda, cor:'#4fa8a3', nota:`mais ${pc(L.a.anos[1].tda - L.a.anos[0].tda)} no 2º ano`}, {nome:'Não desistiram até 2024', v:100 - f.tda, cor:C.sky, nota:`${pc(f.tap)} ainda cursando`}, {nome:'Concluíram', v:f.tca, cor:C.loss, nota:`${nk(f.C)} diplomados até 2024`}]);
  drawQuad($('p5s'), L);
  L.areas.length ? butterfly($('p5h'), L.areas.slice().sort((a, b) => b.tda - a.tda).map(c => ({nome:c.nome, l:c.tda, r:c.prof})), {nome:'Desistência acumulada (coorte 2015)', cor:C.loss, max:100}, {nome:'Proficientes no Enade 2025', cor:C.navy, max:100}) : empty($('p5h'));
}});

/* B1 */
addPage({id:'b1', title:'Distribuição geográfica da oferta', sub:'Vagas presenciais de graduação em 2022 por município de Mato Grosso, jovens de 18 a 24 anos e vagas por 100 jovens.', src:'INEP · Censo 2022 + IBGE · Censo 2022', render(el) {
  const rows = b1rows(), des = rows.filter(m => m.vagas === 0), jovDes = des.reduce((a, m) => a + m.pop, 0), popTot = rows.reduce((a, m) => a + m.pop, 0), vg = rows.reduce((a, m) => a + m.vagas, 0), sel = rows.find(m => m.id === loc.mun);
  const low = rows.filter(m => m.vagas > 0).sort((a, b) => a.v100 - b.v100).slice(0, 8), top = des.slice().sort((a, b) => b.pop - a.pop).slice(0, 8);
  const legs = {v100:rampLegend(RAMP_TEAL, '0', '40+ vagas por 100 jovens') + legend([['#e4e0e5', 'Sem oferta presencial']]), vagas:rampLegend(RAMP_TEAL, 'menos vagas', 'mais vagas') + legend([['#e4e0e5', 'Sem oferta presencial']]), jov:rampLegend(RAMP_SEQ, 'menos jovens', 'mais jovens'), menor:legend([[C.lossDeep, '15 menores ofertas proporcionais'], ['#bfe3e0', 'Demais com oferta'], ['#e4e0e5', 'Sem oferta']])};
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(vg), 'vagas presenciais em 2022')}${kpi(fmt(100 * vg / popTot, 1), 'vagas por 100 jovens em MT')}${kpi(`${des.length} de ${rows.length}`, 'municípios sem oferta presencial')}${kpi(fmt(jovDes / 1000, 1) + ' mil', `jovens de 18–24 nesses municípios (${pc(100 * jovDes / popTot, 0)})`)}</div>
   <div class="grid c21">${card('Mapa coroplético de Mato Grosso', 'Clique em um município para ver os detalhes', `<div class="ctl"><label>Indicador${seg('munm', [['v100', 'Vagas por 100 jovens'], ['vagas', 'Vagas presenciais'], ['jov', 'Jovens 18–24'], ['menor', 'Menor oferta']])}</label></div><div style="max-width:620px;margin:auto">${slot('mt')}</div>${legs[loc.munm]}`)}
    <div class="grid" style="margin:0;align-content:start">
      <div class="card accent"><div class="info-title"><span class="tag bonus">MT</span><h3>${sel ? sel.nome : 'Selecione um município'}</h3></div>${sel ? `<table class="table"><tr><td>Jovens de 18 a 24 anos</td><td class="n"><b>${nk(sel.pop)}</b></td></tr><tr><td>Vagas presenciais (2022)</td><td class="n"><b>${nk(sel.vagas)}</b></td></tr><tr><td>Vagas por 100 jovens</td><td class="n"><b>${sel.vagas > 0 ? fmt(sel.v100, 1) : 'sem oferta'}</b></td></tr><tr><td>Posição na oferta proporcional</td><td class="n"><b>${rows.slice().sort((a, b) => b.v100 - a.v100).findIndex(m => m.id === sel.id) + 1}º de ${rows.length}</b></td></tr></table>` : '<p class="hint">Os dados do município aparecem aqui.</p>'}</div>
      ${card('Sem oferta, maior população jovem', 'Municípios sem vaga presencial de graduação', `<table class="table"><tr><th>Município</th><th class="n">Jovens 18–24</th></tr>${top.map(m => `<tr><td>${m.nome}</td><td class="n">${nk(m.pop)}</td></tr>`).join('') || '<tr><td colspan="2">Nenhum.</td></tr>'}</table>`)}
      ${card('Menor oferta proporcional', 'Municípios com oferta, em vagas por 100 jovens', `<table class="table"><tr><th>Município</th><th class="n">Vagas/100</th></tr>${low.map(m => `<tr><td>${m.nome}</td><td class="n">${fmt(m.v100, 1)}</td></tr>`).join('')}</table>`)}
    </div></div>
   ${note('Vagas: QT_VG_TOTAL dos cursos presenciais de graduação ofertados no município (Censo da Educação Superior 2022). População: IBGE, Censo 2022, tabela 9514 (18, 19 e 20 a 24 anos); a soma dos municípios confere com o total estadual de Idades_tratadas.xlsx (397.671). Não é taxa de ocupação: um jovem pode estudar em outro município ou no EAD.')}`;
  drawMT($('mt'), rows, loc.munm, it => { loc.mun = it.id; renderAll(); });
}});

/* B2 */
addPage({id:'b2', title:'Financiamento estudantil e permanência', sub:'FIES e ProUni na rede privada de MT, 2021–2024, e relação com a desistência dos cursos.', src:'INEP · Censo + Trajetória', render(el) {
  const B = b2data(), s = B.serie, i = 3, sh = (v, j) => s.mat[j] ? 100 * v[j] / s.mat[j] : null, q = B.q;
  el.innerHTML = pageHead(this) + `<div class="kpis">${kpi(nk(s.fies[i]), `matrículas com FIES em 2024 (${pc(sh(s.fies, i))})`)}${kpi(nk(s.pi[i] + s.pp[i]), `matrículas com ProUni em 2024 (${pc(sh(s.pi, i) + sh(s.pp, i))})`)}${kpi(pc(sh(s.fies, 0)) + ' → ' + pc(sh(s.fies, i)), 'participação do FIES, 2021 → 2024')}${q.length ? kpi((q[3].desist - q[0].desist > 0 ? '+' : '') + fmt(q[3].desist - q[0].desist, 1) + ' p.p.', 'desistência do quartil mais financiado vs. o menos') : ''}</div>
   <div class="grid c2">${card('Matrículas financiadas por ano', 'Rede privada, presencial + EAD', slot('b2c'))}${card('Participação nas matrículas privadas', 'Em %, cada programa separado (pode haver sobreposição)', slot('b2a'))}</div>
   <div class="grid c2">${card('Desistência por quartil de financiamento', 'Cursos privados presenciais da coorte 2015; ponto = taxa agregada, traço = IC 95% aproximado', q.length ? slot('b2q') : '<div class="empty">Poucos cursos no recorte.</div>')}${card('Cada curso privado', 'Financiamento × desistência; tamanho = ingressantes', B.pts.length > 2 ? slot('b2s') + `<div class="note">Spearman ${B.rho == null ? '—' : fmt(B.rho, 2)} (${forca(B.rho)}) entre ${B.pts.length} cursos.</div>` : '<div class="empty">Poucos cursos no recorte.</div>')}</div>
   ${note('Financiamento por curso = (FIES + ProUni integral + ProUni parcial) ÷ matrículas, somando 2021–2024. Esses matriculados não são os ingressantes de 2015: a relação é entre cursos, sem causalidade. No EAD privado de MT não há matrículas com FIES registradas.')}`;
  drawB2Cols($('b2c'), B);
  lineChart($('b2a'), CENSO_ANOS, [{nome:'FIES', cor:C.navy, values:s.fies.map((_, j) => sh(s.fies, j))}, {nome:'ProUni integral', cor:C.loss, values:s.pi.map((_, j) => sh(s.pi, j))}, {nome:'ProUni parcial', cor:C.sand, values:s.pp.map((_, j) => sh(s.pp, j))}], {unit:P, ymax:8, labelEnd:true, h:300});
  if (q.length) whiskers($('b2q'), q);
  if (B.pts.length > 2) drawB2Scatter($('b2s'), B.pts, 640);
}});

/* Respostas */
addPage({id:'ans', title:'Respostas às perguntas', sub:'', src:'INEP · IBGE', render(el) {
  const cs = cursos(), a = agrega(cs), f = a.fim, rows = rotulos(cs).filter(r => r.N >= MIN_RANKING).sort((x, y) => y.d - x.d), hi = rows[0], lo = rows[rows.length - 1], ar = areasRows(cs).filter(x => x.N >= MIN_RANKING);
  const cen = censo(state), pe = GRUPOS.map(g => ({...g, v:lobo(cen.soma(2024, g.rede, g.mod), cen.soma(2023, g.rede, g.mod))})), at = anoAtipico(p3series(cen, 'desv', GRUPOS));
  const pri = pe.find(g => g.id === 'pri-ead'), pub = pe.find(g => g.id === 'pub-pres');
  const pts = cpcPontos(cs), rho = spearman(pts.map(p => p.cpc), pts.map(p => p.tda)), comp = COMPONENTES.map(([k, nome]) => ({nome, ...tercis(pts, k)})).filter(x => x.rho != null), best = comp.slice().sort((x, y) => (y.baixo - y.alto) - (x.baixo - x.alto))[0];
  const L = licData(), pior = L.areas.filter(x => x.part >= 30).sort((x, y) => x.prof - y.prof)[0];
  const b1 = b1rows(), des = b1.filter(m => m.vagas === 0), popT = b1.reduce((s, m) => s + m.pop, 0), jd = des.reduce((s, m) => s + m.pop, 0), vg = b1.reduce((s, m) => s + m.vagas, 0);
  const B = b2data(), s = B.serie, shf = j => 100 * s.fies[j] / s.mat[j], shp = j => 100 * (s.pi[j] + s.pp[j]) / s.mat[j], q = B.q;
  const A = [
   {t:'P1', q:'Quanto da turma fica pelo caminho?', h:cs.length ? `De cada 100 ingressantes de 2015 em cursos presenciais de MT, ${fmt(f.tda, 0)} desistiram, ${fmt(f.tca, 0)} concluíram e ${fmt(f.tap, 0)} ainda cursavam em 2024. A maior perda ocorre no ${a.pico.ano - 2014}º ano (${a.pico.ano}), quando ${nk(a.pico.s)} estudantes, ${fmt(a.pico.tada, 1)} p.p. da turma, desistiram.` : 'Nenhum curso no recorte.',
    s:cs.length ? [[pc(f.tda), 'desistência acumulada'], [pc(f.tca), 'conclusão'], [(a.pico.ano - 2014) + 'º ano', 'pico de desistência']] : [], c1:['Situação da turma', h => cs.length ? drawStacked(h, a) : empty(h)], c2:['Perda anual', h => cs.length ? drawLoss(h, a) : empty(h)]},
   {t:'P2', q:'Onde a rota mais se perde?', h:hi ? `Entre cursos com ao menos ${MIN_RANKING} ingressantes, a rota mais se perde em ${hi.nome} (${pc(hi.d, 0)}) e menos em ${lo.nome} (${pc(lo.d, 0)}). Por área, ${ar[0] ? curta(ar[0].area) + ' tem a maior desistência (' + pc(ar[0].d, 0) + ')' : ''}${ar.length > 1 ? ' e ' + curta(ar[ar.length - 1].area) + ' a menor (' + pc(ar[ar.length - 1].d, 0) + ')' : ''}.` : 'Poucos cursos no recorte.',
    s:hi ? [[pc(hi.d, 0), 'maior: ' + hi.nome], [pc(lo.d, 0), 'menor: ' + lo.nome], [fmt(hi.d - lo.d, 0) + ' p.p.', 'amplitude entre cursos']] : [], c1:['Cursos nos extremos', h => rows.length >= 2 ? extremes(h, rows, f.tda) : empty(h)], c2:['Ritmo da perda por área', h => drawAreaCurves(h, cs)]},
   {t:'P3', q:'Pública × privada, presencial × EAD', h:`Em 2024, a privada EAD tem a maior evasão anual estimada (${pc(pri.v, 0)}), contra ${pc(pub.v, 0)} na pública presencial. ${at ? `${at.ano} é atípico: na ${at.grupo.toLowerCase()}, a desvinculação vai a ${pc(at.v)} dos vínculos, ante ${pc(at.med)} nos demais anos.` : ''}`,
    s:[[pc(pri.v, 0), 'evasão anual · privada EAD (2024)'], [pc(pub.v, 0), 'pública presencial (2024)'], [at ? String(at.ano) : '—', 'ano atípico']], c1:['Evasão anual estimada', h => drawEvasao(h, 'lobo')], c2:['Desvinculação no ano', h => drawEvasao(h, 'desv')]},
   {t:'P4', q:'Qualidade retém?', h:pts.length > 2 ? `${Math.abs(rho) < .1 ? 'Não de forma consistente' : rho < 0 ? 'Em parte' : 'Não'}: entre ${pts.length} cursos com CPC, a correlação de Spearman entre CPC e desistência é ${fmt(rho, 2)} (${forca(rho)}). ${best ? `O componente que mais separa os cursos é ${best.nome.toLowerCase()}: ${pc(best.baixo, 0)} de desistência no tercil de nota mais baixa contra ${pc(best.alto, 0)} no de nota mais alta.` : ''}` : 'Poucos cursos com CPC no recorte.',
    s:[[rho == null ? '—' : fmt(rho, 2), 'correlação CPC × desistência'], [best ? (best.baixo - best.alto > 0 ? '+' : '') + fmt(best.baixo - best.alto, 0) + ' p.p.' : '—', best ? best.nome : 'componente'], [String(pts.length), 'cursos analisados']],
    c1:['CPC × desistência', h => pts.length ? drawScatterCPC(h, pts) : empty(h)], c2:['Correlação de cada componente', h => comp.length ? correlations(h, comp.map(x => [x.nome, x.rho, x.n])) : empty(h)]},
   {t:'P5', q:'O funil das licenciaturas', h:L.lic.length ? `Nas licenciaturas presenciais, ${fmt(L.a.fim.tda, 0)} de cada 100 ingressantes de 2015 desistiram e ${fmt(L.a.fim.tca, 0)} concluíram. No Enade 2025, ${pc(L.profPct, 0)} dos ${nk(L.part)} participantes atingiram a proficiência${pior ? `; o menor resultado é de ${pior.nome} (${pc(pior.prof, 0)}), com ${pc(pior.tda, 0)} de desistência` : ''}.` : 'Nenhuma licenciatura no recorte.',
    s:[[pc(L.a.fim.tda, 0), 'desistem'], [pc(L.a.fim.tca, 0), 'concluem'], [pc(L.profPct, 0), 'proficientes no Enade 2025']], c1:['Pizza de pizza', h => L.part ? drawPie(h, L) : empty(h)], c2:['Desistência × proficiência', h => drawQuad(h, L)]},
   {t:'B1', q:'Desertos de ensino superior', h:`${des.length} dos ${b1.length} municípios de MT não têm vaga presencial de graduação (2022); neles vivem ${fmt(jd / 1000, 1)} mil jovens de 18 a 24 anos (${pc(100 * jd / popT, 0)}). No estado, são ${fmt(100 * vg / popT, 1)} vagas presenciais por 100 jovens.`,
    s:[[String(des.length), 'municípios sem oferta'], [fmt(jd / 1000, 1) + ' mil', 'jovens nesses municípios'], [fmt(100 * vg / popT, 1), 'vagas por 100 jovens']],
    c1:['Vagas por 100 jovens', h => { h.style.maxWidth = '560px'; h.style.margin = 'auto'; drawMT(h, b1, 'v100'); }], c2:['Menor oferta proporcional', h => { const l = b1.filter(m => m.vagas > 0).sort((x, y) => x.v100 - y.v100).slice(0, 10); hbarsGrouped(h, l.map(m => ({nome:m.nome, vals:[m.v100]})), [{nome:'Vagas por 100 jovens', cor:C.loss}], {f:v => fmt(v, 1), ml:170}); }]},
   {t:'B2', q:'Financiamento e permanência', h:`O peso do financiamento caiu: o FIES passou de ${pc(shf(0))} para ${pc(shf(3))} das matrículas privadas entre 2021 e 2024, e o ProUni de ${pc(shp(0))} para ${pc(shp(3))}. ${q.length ? `Entre ${B.pts.length} cursos privados presenciais, os mais financiados não evadem menos: ${pc(q[3].desist, 0)} no quartil mais financiado contra ${pc(q[0].desist, 0)} no menos financiado.` : ''}`,
    s:[[pc(shf(3)), 'FIES nas matrículas privadas (2024)'], [pc(shp(3)), 'ProUni (2024)'], [q.length ? (q[3].desist - q[0].desist > 0 ? '+' : '') + fmt(q[3].desist - q[0].desist, 0) + ' p.p.' : '—', 'Q4 vs. Q1 de financiamento']],
    c1:['Quartis de financiamento', h => q.length ? whiskers(h, q) : empty(h)], c2:['Matrículas financiadas', h => drawB2Cols(h, B)]},
  ];
  const sel = A[loc.ans];
  el.innerHTML = pageHead(this) + `<div class="qcards">${A.map((x, i) => `<button type="button" class="qcard ${i === loc.ans ? 'on' : ''}" data-i="${i}"><span class="qwm ${x.t[0] === 'B' ? 'bonus' : ''}">${x.t}</span><span class="qt">${x.q}</span><b>${x.s[0] ? x.s[0][0] : '—'}</b><span class="ql">${x.s[0] ? x.s[0][1] : ''}</span></button>`).join('')}</div>
   <div class="ans-panel"><div class="ans-head"><span class="tag ${sel.t[0] === 'B' ? 'bonus' : ''}">${sel.t}</span><div><div class="ans-q">Pergunta</div><h3>${sel.q}</h3></div></div>
    <div class="ans-body"><div class="ans-text"><div class="ans-q">Resposta</div><p>${sel.h}</p></div><div class="stats">${sel.s.map(([v, l]) => kpi(v, l)).join('')}</div></div></div>
   <div class="grid c2" style="margin-top:14px">${card(sel.c1[0], 'Evidência principal', slot('ea'))}${card(sel.c2[0], 'Evidência complementar', slot('eb'))}</div>`;
  sel.c1[1]($('ea')); sel.c2[1]($('eb'));
  el.querySelectorAll('.qcard').forEach(b => b.onclick = () => { loc.ans = +b.dataset.i; renderAll(); });
}});

/* Resumo final */
addPage({id:'resumo', title:'Resumo final', sub:'Três conclusões que os dados sustentam e a recomendação que decorre delas. Reflete os filtros ativos.', src:'INEP · IBGE', render(el) {
  const cs = cursos(); if (!cs.length) return semDados(el, this);
  const a = agrega(cs), f = a.fim, ate2 = 100 * a.anos[1].S / f.S, ar = areasRows(cs).filter(x => x.N >= MIN_RANKING), hiA = ar[0], loA = ar[ar.length - 1];
  const rows = rotulos(cs).filter(r => r.N >= MIN_RANKING).sort((x, y) => y.d - x.d), top3 = rows.slice(0, 3).map(r => r.nome.replace(' formação de professor', ' (licenciatura)'));
  const pub = agrega(cs.filter(c => c.rede === 'publica')).fim.tda, pri = agrega(cs.filter(c => c.rede === 'privada')).fim.tda;
  const cen = censo(state), ead = lobo(cen.soma(2024, 'privada', 2), cen.soma(2023, 'privada', 2));
  const pts = cpcPontos(cs), rho = spearman(pts.map(p => p.cpc), pts.map(p => p.tda)), B = b2data(), q = B.q, dq = q.length ? q[3].desist - q[0].desist : null;
  const b1 = b1rows(), des = b1.filter(m => m.vagas === 0);
  const naoExplica = (rho == null || Math.abs(rho) < .3) && (dq == null || dq >= 0);
  const C3 = [
   {n:pc(f.tda, 0), t:'A perda é alta e acontece cedo', x:`${fmt(f.tda, 0)} de cada 100 ingressantes de 2015 desistiram do curso. ${pc(ate2, 0)} de todas as desistências ocorreram até o 2º ano, e o pico é no ${a.pico.ano - 2014}º ano (${fmt(a.pico.tada, 1)} p.p. da turma).`, ev:'P1 · Trajetória', go:'p1'},
   {n:hiA ? pc(hiA.d, 0) : '—', t:'A perda é desigual entre áreas, cursos e redes', x:`${hiA ? curta(hiA.area) + ' perde ' + pc(hiA.d, 0) + ' da turma, contra ' + pc(loA.d, 0) + ' em ' + curta(loA.area) + '. ' : ''}Na rede privada presencial a desistência é ${pc(pri, 0)}, ante ${pc(pub, 0)} na pública; no EAD privado a evasão anual estimada chega a ${pc(ead, 0)}.`, ev:'P2 e P3 · Cursos, rede e modalidade', go:'p2'},
   {n:rho == null ? '—' : fmt(rho, 2), t:naoExplica ? 'CPC e financiamento não explicam a diferença' : 'Qualidade e financiamento se associam à permanência', x:`A correlação entre CPC e desistência é ${forca(rho)} (${rho == null ? '—' : fmt(rho, 2)}), e nos cursos mais financiados a desistência ${dq != null && dq > 0 ? 'é maior, e não menor' : dq != null && dq < -3 ? 'é menor' : 'é semelhante'}${dq != null ? ` (${dq > 0 ? '+' : ''}${fmt(dq, 0)} p.p. do quartil mais para o menos financiado)` : ''}. Os fatores da desistência precisam ser buscados também fora desses indicadores.`, ev:'P4 e B2 · Qualidade e financiamento', go:'p4'}
  ];
  const minis = [
    {v:a.anos.map(x => x.tada), cor:C.loss, cap:'Desistência a cada ano, 2015–2024 (p.p.)'},
    {v:ar.map(x => x.d), cor:C.sand, cap:'Desistência por área, da maior para a menor'},
    {v:q.map(x => x.desist), cor:C.blue, cap:'Desistência por quartil de financiamento (Q1 a Q4)'}
  ];
  const tese = `${fmt(f.tda / 10, 0)} em cada 10 ingressantes de 2015 em cursos presenciais de MT desistiram do curso, ${ate2 >= 35 ? 'boa parte nos dois primeiros anos' : 'ao longo de toda a trajetória'}. A perda se concentra em ${hiA ? curta(hiA.area) : 'algumas áreas'}${top3.length ? ', em cursos como ' + top3.slice(0, 2).join(' e ') : ''}, e é maior na rede ${pri > pub ? 'privada' : 'pública'}${naoExplica ? '; nem o CPC nem o financiamento explicam essa diferença' : ''}.`;
  const steps = [['Quanto', 'P1'], ['Onde', 'P2 · P3'], ['Por quê', 'P4 · P5 · B2'], ['O que fazer', 'Recomendação']];
  el.innerHTML = pageHead(this) + `<div class="sum-top"><div class="thesis"><span class="ans-q">Tese</span><p>${tese}</p></div>
    <div class="path">${steps.map((s, i) => `<div class="step ${i === 3 ? 'last' : ''}"><span class="sn">${i + 1}</span><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('')}</div></div>
   <h3 class="sec">Três conclusões</h3>
   <div class="concl-list">${C3.map((c, i) => `<div class="card concl"><div class="c-num">${i + 1}</div>
     <div class="c-metric"><b>${c.n}</b><span>${c.t}</span></div>
     <div class="c-text"><p>${c.x}</p><button type="button" class="link" data-go="${c.go}"><i class="fi fi-rr-angle-right"></i>Ver evidência: ${c.ev}</button></div>
     <div class="c-mini"><div id="mini${i}"></div><span>${minis[i].cap}</span></div></div>`).join('')}</div>
   <h3 class="sec">Recomendação</h3>
   <div class="reco"><div class="reco-head"><i class="fi fi-rr-flag"></i><div><span class="ans-q">Prioridade de ação</span><h3>Agir nos dois primeiros anos dos cursos com maior perda</h3></div></div>
    <div class="reco-body"><div class="reco-why"><h4>Por que aqui</h4>
      <div class="pills"><div class="pill"><b>${pc(ate2, 0)}</b><span>das desistências acontecem até o 2º ano</span></div>
      <div class="pill"><b>${hiA ? pc(hiA.d, 0) : '—'}</b><span>de desistência em ${hiA ? curta(hiA.area) : '—'}, a área com maior perda</span></div>
      <div class="pill"><b>${des.length} de ${b1.length}</b><span>municípios sem vaga presencial de graduação</span></div></div></div>
     <div class="reco-do"><h4>O que fazer</h4><ol class="acts">
      <li><b>Acompanhar cedo</b><span>Busca ativa e apoio acadêmico no 1º e no 2º ano, quando a turma mais se perde.</span></li>
      <li><b>Priorizar os cursos críticos</b><span>${top3.length ? top3.join(', ') : 'Cursos com maior desistência'}.</span></li>
      <li><b>Ir além do CPC e do financiamento</b><span>Investigar fatores do estudante (renda, trabalho, deslocamento), que essas bases não medem.</span></li>
      <li><b>Ampliar o acesso</b><span>Polos e oferta presencial nos municípios sem graduação.</span></li></ol></div></div></div>
   ${note('Fontes: INEP (Trajetória 2015–2024, Censo da Educação Superior 2021–2024, CPC 2021–2023, Enade 2025) e IBGE (Censo 2022). Associações entre cursos não provam causa. Gerado por scripts/build_fixed_data.py.')}`;
  minis.forEach((m, k) => m.v.length ? sparkline($('mini' + k), m.v, m.cor) : null);
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(PAGES.findIndex(p => p.id === b.dataset.go)));
}});

/* ---------- orquestração ---------- */
const ORDEM = ['ans', 'p1', 'p2', 'p3', 'p4', 'p5', 'b1', 'b2', 'resumo', 'br'];
PAGES.sort((x, y) => ORDEM.indexOf(x.id) - ORDEM.indexOf(y.id));
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
