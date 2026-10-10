// Cálculos do modo "Dados fixos" sobre fixed-data.json (gerado por scripts/build_fixed_data.py).
// Regras de docs/formulas_indicadores.md: somar numeradores e denominadores antes de dividir,
// denominador ajustado por falecidos, ausência nunca vira zero.
import DATA from './fixed-data.json';

export {DATA};
export const ANOS = DATA.anos;
export const CENSO_ANOS = DATA.censo_anos;
export const MIN_COORTE = 10;      // regra de célula pequena (outputs/dashboard/audit.json)
export const MIN_RANKING = 50;     // ranking de cursos/áreas: pelo menos 50 ingressantes

export const AREA_CURTA = {
  'Computação e Tecnologias da Informação e Comunicação (TIC)': 'Computação e TIC',
  'Agricultura, silvicultura, pesca e veterinária': 'Agricultura e veterinária',
  'Ciências naturais, matemática e estatística': 'Ciências naturais e matemática',
  'Ciências sociais, comunicação e informação': 'Ciências sociais e comunicação',
  'Engenharia, produção e construção': 'Engenharia e construção',
  'Negócios, administração e direito': 'Negócios, administração e direito',
};
export const curta = a => AREA_CURTA[a] || a;
export const AREAS = [...new Set(DATA.cursos.map(c => c.area))].sort();
export const POLOS = {'Cuiabá': 5103403, 'Várzea Grande': 5108402, 'Rondonópolis': 5107602, 'Sinop': 5107909, 'Tangará da Serra': 5107958, 'Cáceres': 5102504};
const GRAU = {bacharelado: 1, licenciatura: 2, tecnologo: 3};
export const GRAU_NOME = {1: 'Bacharelado', 2: 'Licenciatura', 3: 'Tecnológico'};

const okMun = (mun, local) => local === 'todos' || (local === 'Demais municípios' ? !Object.values(POLOS).includes(mun) : POLOS[local] === mun);
export function filtra(cursos, f, skip = []) {
  return cursos.filter(c => (skip.includes('rede') || f.rede === 'todas' || c.rede === f.rede)
    && (skip.includes('grau') || f.grau === 'todos' || c.grau === GRAU[f.grau])
    && (skip.includes('area') || f.area === 'todas' || c.area === f.area)
    && (skip.includes('local') || okMun(c.mun, f.local)));
}

/* Trajetória agregada: N, B ajustado, fluxos anuais e taxas acumuladas por ano de referência. */
export function agrega(cs) {
  const n = ANOS.length, z = () => Array(n).fill(0);
  const s = z(), c = z(), p = z(), f = z(); let N = 0;
  cs.forEach(x => { N += x.ing; for (let i = 0; i < n; i++) { s[i] += x.s[i]; c[i] += x.c[i]; p[i] += x.p[i]; f[i] += x.f[i]; } });
  let F = 0, S = 0, C = 0;
  const anos = ANOS.map((ano, i) => {
    F += f[i]; S += s[i]; C += c[i]; const B = N - F;
    return B > 0 ? {ano, B, S, C, P: p[i], s: s[i], tda: 100 * S / B, tca: 100 * C / B, tap: 100 * p[i] / B, tada: 100 * s[i] / B} : {ano, B, S, C, P: p[i], s: s[i], tda: null, tca: null, tap: null, tada: null};
  });
  const fim = anos[n - 1];
  const pico = anos.reduce((m, a) => (a.tada ?? -1) > (m.tada ?? -1) ? a : m, anos[0]);
  return {N, cursos: cs.length, anos, fim, pico};
}
export const tda = c => { const B = c.ing - c.f.reduce((a, b) => a + b, 0); return B > 0 ? 100 * c.s.reduce((a, b) => a + b, 0) / B : null; };
export const Bfinal = c => c.ing - c.f.reduce((a, b) => a + b, 0);

/* Agrupa cursos por chave, devolvendo o agregado de cada grupo. */
export function porGrupo(cs, chave) {
  const m = new Map();
  cs.forEach(c => { const k = chave(c); if (!m.has(k)) m.set(k, []); m.get(k).push(c); });
  return [...m].map(([k, v]) => ({k, ...agrega(v), lista: v}));
}

/* Spearman: correlação de Pearson entre postos (empates com posto médio). */
const postos = v => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = Array(v.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
export function spearman(x, y) {
  if (x.length < 3) return null;
  const a = postos(x), b = postos(y), n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}

/* ---------------- P3 · Censo (MT, graduação, dimensão fixa por modalidade) ---------------- */
const IX = Object.fromEntries(DATA.censo_cols.map((c, i) => [c, i]));
export function censo(f, skip = []) {
  const rows = DATA.censo.filter(r => (skip.includes('grau') || f.grau === 'todos' || r[IX.grau] === GRAU[f.grau]) && (skip.includes('area') || f.area === 'todas' || r[IX.area] === f.area));
  const soma = (ano, rede, mod) => {
    const o = {}; DATA.censo_cols.slice(5).forEach(k => o[k] = 0);
    rows.forEach(r => { if (r[IX.ano] === ano && (rede == null || r[IX.rede] === rede) && (mod == null || r[IX.mod] === mod)) DATA.censo_cols.slice(5).forEach(k => o[k] += r[IX[k]]); });
    return o;
  };
  return {soma};
}
export const GRUPOS = [
  {id: 'pub-pres', nome: 'Pública presencial', rede: 'publica', mod: 1},
  {id: 'pri-pres', nome: 'Privada presencial', rede: 'privada', mod: 1},
  {id: 'pub-ead', nome: 'Pública EAD', rede: 'publica', mod: 2},
  {id: 'pri-ead', nome: 'Privada EAD', rede: 'privada', mod: 2},
];
/* Situação dos vínculos no ano: permanência (cursando+trancados), conclusão e desvinculação (desvinculados+transferidos). */
export function situacao(o) {
  const V = o.QT_MAT + o.QT_SIT_TRANCADA + o.QT_SIT_DESVINCULADO + o.QT_SIT_TRANSFERIDO + o.QT_SIT_FALECIDO;
  if (!V) return null;
  return {V, perm: 100 * (o.QT_MAT - o.QT_CONC + o.QT_SIT_TRANCADA) / V, conc: 100 * o.QT_CONC / V, desv: 100 * (o.QT_SIT_DESVINCULADO + o.QT_SIT_TRANSFERIDO) / V};
}
/* Estimativa anual por balanço de matrículas (Lobo), método escolhido pela equipe: requer o ano anterior. */
export function lobo(o, ant) {
  if (!ant) return null;
  const den = ant.QT_MAT - ant.QT_CONC;
  return den > 0 ? 100 * (1 - (o.QT_MAT - o.QT_ING) / den) : null;
}
/* Ano atípico: o ano cuja desvinculação mais se afasta da mediana dos demais anos, em algum grupo. */
export function anoAtipico(series) {
  let melhor = null;
  CENSO_ANOS.forEach((ano, i) => series.forEach(s => {
    const v = s.values[i]; if (v == null) return;
    const outros = s.values.filter((x, j) => j !== i && x != null).sort((a, b) => a - b);
    if (!outros.length) return;
    const med = outros.length % 2 ? outros[(outros.length - 1) / 2] : (outros[outros.length / 2 - 1] + outros[outros.length / 2]) / 2;
    const d = Math.abs(v - med);
    if (!melhor || d > melhor.d) melhor = {ano, i, d, grupo: s.nome, v, med};
  }));
  return melhor;
}

/* ---------------- P4 · CPC ---------------- */
// Mesma lista de componentes publicada pelo banco (pipelines/dashboard.py, COMPONENTS).
export const COMPONENTES = [['cpc', 'CPC contínuo'], ['enade', 'Conceito Enade'], ['idd', 'IDD (valor agregado)'], ['mestres', 'Docentes mestres'], ['doutores', 'Docentes doutores'],
  ['infra', 'Infraestrutura'], ['odp', 'Organização didático-pedagógica'], ['regime', 'Regime de trabalho docente']];
export function cpcPontos(cs) {
  return cs.map(c => ({c, q: DATA.cpc[c.id], B: Bfinal(c)})).filter(x => x.q && x.B >= MIN_COORTE)
    .map(({c, q, B}) => ({...q, id: c.id, nome: c.nome, ies: c.ies, rede: c.rede, area: c.area, B, S: c.s.reduce((a, b) => a + b, 0), tda: tda(c)}));
}
const taxa = l => { const B = l.reduce((s, x) => s + x.B, 0); return B ? 100 * l.reduce((s, x) => s + x.S, 0) / B : null; };
export {taxa};
/* Desistência do tercil superior × inferior de cada componente. */
export function tercis(pts, k) {
  const v = pts.filter(p => p[k] != null).sort((a, b) => a[k] - b[k]);
  if (v.length < 9) return null;
  const t = Math.floor(v.length / 3);
  return {n: v.length, baixo: taxa(v.slice(0, t)), alto: taxa(v.slice(-t)), rho: spearman(v.map(p => p[k]), v.map(p => p.tda))};
}

/* ---------------- P5 · Enade 2025 (licenciaturas, MT) ---------------- */
export function enade(f) {
  return DATA.enade.map(([id, area, part, prof, mod, rede, mun, ligado]) => ({id, area, part, prof, mod, rede, mun, ligado}))
    .filter(e => (f.rede === 'todas' || e.rede === f.rede) && okMun(e.mun, f.local));
}

/* ---------------- B1 · municípios ---------------- */
export function municipios(f) {
  return Object.entries(DATA.mun).map(([id, [pop, pub, pri]]) => {
    const vagas = f.rede === 'publica' ? pub : f.rede === 'privada' ? pri : pub + pri;
    return {id, pop, jov: pop / 1000, vagas, v100: pop ? 100 * vagas / pop : null};
  });
}

/* ---------------- B2 · financiamento (rede privada) ---------------- */
// Regra do banco: Censo 2024, curso + IES, pelo menos 10 matrículas; FIES e ProUni separados.
export function financiamento(cs) {
  return cs.filter(c => c.rede === 'privada' && DATA.fin[c.id]).map(c => {
    const [mat, fies, pi, pp] = DATA.fin[c.id];
    return {id: c.id, nome: c.nome, ies: c.ies, B: Bfinal(c), S: c.s.reduce((a, b) => a + b, 0), tda: tda(c), mat, fies: 100 * fies / mat, prouni: 100 * (pi + pp) / mat, fin: 100 * fies / mat};
  });
}
// Faixas de participação FIES usadas nas páginas da API (QuestionsReal.tsx).
export const FAIXAS_FIES = [{q: 'Sem FIES', lo: 0, hi: 0}, {q: 'FIES >0–5%', lo: 0, hi: 5}, {q: 'FIES >5–10%', lo: 5, hi: 10}, {q: 'FIES >10%', lo: 10, hi: 100}];
export function quartis(pts) {
  return FAIXAS_FIES.map(b => {
    const l = pts.filter(p => b.hi === 0 ? p.fies === 0 : p.fies > b.lo && p.fies <= b.hi);
    if (!l.length) return null;
    const p = taxa(l) / 100, B = l.reduce((s, x) => s + x.B, 0), e = 196 * Math.sqrt(p * (1 - p) / B);   // IC 95% aproximado
    const f = l.map(x => x.fies).sort((a, b) => a - b);
    return {q: b.q, fin: f[Math.floor(f.length / 2)], desist: 100 * p, lo: 100 * p - e, hi: 100 * p + e, n: l.length};
  }).filter(Boolean);
}

/* ---------------- Brasil ---------------- */
export function uf(sigla, rede) {
  const r = DATA.uf[sigla]; if (!r) return null;
  const partes = rede === 'todas' ? Object.values(r) : [r[rede]].filter(Boolean);
  if (!partes.length) return null;
  return agrega(partes.map(x => ({ing: x.n, s: x.s, c: x.c, p: x.p, f: x.f})));
}
export function brasil(rede) { return agrega(Object.keys(DATA.uf).flatMap(s => (rede === 'todas' ? Object.values(DATA.uf[s]) : [DATA.uf[s][rede]].filter(Boolean)).map(x => ({ing: x.n, s: x.s, c: x.c, p: x.p, f: x.f})))); }
