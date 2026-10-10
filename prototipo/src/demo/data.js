import {GEO_MT} from '../visualization/geo.js';
/* Dados simulados (mock). Estrutura inspirada nos arquivos INEP em /dados.
   Substituir por chamadas à API quando o backend estiver pronto. */
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const AREAS = ['Saúde e bem-estar','Educação','Negócios, administração e direito','Engenharia, produção e construção','Computação e TIC','Ciências naturais, matemática e estatística','Agricultura e veterinária','Serviços'];
const LOCAIS = ['Cuiabá','Várzea Grande','Rondonópolis','Sinop','Tangará da Serra','Cáceres','Interior'];

/* pesos de participação nos ingressantes e fatores de desistência por filtro */
const W = {
  rede:{todas:1,publica:.14,privada:.86}, grau:{todos:1,bacharelado:.58,licenciatura:.24,tecnologo:.18},
  area:{todas:1,...Object.fromEntries(AREAS.map((a,i)=>[a,[.17,.2,.24,.11,.07,.05,.07,.09][i]]))},
  local:{todos:1,...Object.fromEntries(LOCAIS.map((a,i)=>[a,[.28,.1,.13,.1,.07,.05,.27][i]]))}
};
const K = {
  rede:{todas:1,publica:.72,privada:1.14}, grau:{todos:1,bacharelado:.95,licenciatura:1.12,tecnologo:1.06},
  area:{todas:1,...Object.fromEntries(AREAS.map((a,i)=>[a,[.62,1.15,1.05,1.08,1.18,1.2,.85,.95][i]]))},
  local:{todos:1,'Cuiabá':.96,'Várzea Grande':1.04,'Rondonópolis':1,'Sinop':.93,'Tangará da Serra':1.08,'Cáceres':1.05,'Interior':1.12}
};
const INGRESSANTES_2015 = 41200;
const factor = f => Math.min(1.7, Math.max(.4, K.rede[f.rede] * K.grau[f.grau] * K.area[f.area] * K.local[f.local]));
const weight = f => W.rede[f.rede] * W.grau[f.grau] * W.area[f.area] * W.local[f.local];

/* P1 · coorte 2015, percentual da turma por ano (2015..2024) */
const ANOS = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
const P1_LOSS = [11,12,9,7,5.5,4.5,3,2,1,.5];     // perda anual, p.p. da turma
const P1_CONC = [0,0,0,3,9,10,8,5,2.5,1.5];       // conclusão anual, p.p.
function p1(f){
  const k = factor(f);
  let loss = P1_LOSS.map(v => v * k), conc = P1_CONC.map(v => v / Math.pow(k, .8));
  const tl = loss.reduce((a,b)=>a+b), tc = conc.reduce((a,b)=>a+b);
  if (tl + tc > 97){ const s = 97 / (tl + tc); loss = loss.map(v=>v*s); conc = conc.map(v=>v*s); }
  let cl = 0, cc = 0;
  const cum = ANOS.map((y,i)=>{ cl += loss[i]; cc += conc[i]; return {ano:y, desistiu:cl, concluiu:cc, cursando:100-cl-cc, perda:loss[i]}; });
  const last = cum[cum.length-1];
  const peak = cum.reduce((m,d)=>d.perda>m.perda?d:m);
  return {cum, last, peak, n: Math.round(INGRESSANTES_2015 * weight(f))};
}

/* P2 · cursos (desistência acumulada coorte 2015, % por rede) */
const CURSOS = [
 ['Medicina','Saúde e bem-estar','bacharelado',7,5,8],['Odontologia','Saúde e bem-estar','bacharelado',18,14,19],['Enfermagem','Saúde e bem-estar','bacharelado',34,27,35],
 ['Fisioterapia','Saúde e bem-estar','bacharelado',30,24,31],['Farmácia','Saúde e bem-estar','bacharelado',36,29,37],['Psicologia','Saúde e bem-estar','bacharelado',36,30,37],
 ['Pedagogia','Educação','licenciatura',52,43,54],['Matemática','Educação','licenciatura',71,66,78],['Letras','Educação','licenciatura',62,55,69],
 ['Educação Física','Educação','licenciatura',55,48,57],['História','Educação','licenciatura',64,58,70],['Física','Educação','licenciatura',77,74,80],
 ['Direito','Negócios, administração e direito','bacharelado',38,29,41],['Administração','Negócios, administração e direito','bacharelado',58,47,60],['Ciências Contábeis','Negócios, administração e direito','bacharelado',55,46,57],
 ['Gestão de Recursos Humanos','Negócios, administração e direito','tecnologo',57,50,58],['Gestão Comercial','Negócios, administração e direito','tecnologo',63,52,64],
 ['Engenharia Civil','Engenharia, produção e construção','bacharelado',48,38,50],['Engenharia Elétrica','Engenharia, produção e construção','bacharelado',62,51,66],['Arquitetura e Urbanismo','Engenharia, produção e construção','bacharelado',33,26,34],
 ['Ciência da Computação','Computação e TIC','bacharelado',66,57,70],['Sistemas de Informação','Computação e TIC','bacharelado',64,56,67],['Análise e Desenv. de Sistemas','Computação e TIC','tecnologo',60,52,61],
 ['Química','Ciências naturais, matemática e estatística','licenciatura',69,63,75],['Ciências Biológicas','Ciências naturais, matemática e estatística','licenciatura',60,54,66],['Estatística','Ciências naturais, matemática e estatística','bacharelado',58,52,64],
 ['Agronomia','Agricultura e veterinária','bacharelado',41,33,43],['Medicina Veterinária','Agricultura e veterinária','bacharelado',28,22,29],
 ['Serviço Social','Serviços','bacharelado',45,38,47],['Gastronomia','Serviços','tecnologo',56,50,57]
].map(([nome,area,grau,tot,pub,priv])=>({nome,area,grau,tot,pub,priv}));

/* P2 · curva acumulada por ano do curso e coorte */
const CURVA = [14,26,35,41,45,48];
const COORTE_F = {2015:1,2016:1.02,2017:1,2018:.98,2019:1.07,2020:1.15};
const AREA_F = Object.fromEntries(AREAS.map((a,i)=>[a,[.6,1.1,1.06,1.0,1.17,1.22,.78,.95][i]]));

/* P3 · evasão anual (%) e matrículas (mil), 2021–2024 */
const P3 = [
 {id:'pub-pres',nome:'Pública presencial',rede:'publica',mod:'presencial',evasao:[9.8,10.9,9.6,9.1],mat:[41.2,42.0,43.1,43.9]},
 {id:'pri-pres',nome:'Privada presencial',rede:'privada',mod:'presencial',evasao:[17.5,19.6,18.1,17.0],mat:[79.0,81.5,84.0,87.0]},
 {id:'pub-ead',nome:'Pública EAD',rede:'publica',mod:'ead',evasao:[21.0,24.1,20.8,19.9],mat:[7.8,8.4,8.9,9.5]},
 {id:'pri-ead',nome:'Privada EAD',rede:'privada',mod:'ead',evasao:[29.5,34.2,31.2,30.1],mat:[98,118,142,171]}
];
const P3_ANOS = [2021,2022,2023,2024];

/* P4 · cursos com CPC (1–5), desistência (%) e matrículas */
const P4 = (()=>{
  const r = rng(42), nomesBase = CURSOS.map(c=>c);
  const out = [];
  for (let i=0;i<72;i++){
    const c = nomesBase[Math.floor(r()*nomesBase.length)], rede = r()<.2?'publica':'privada';
    const cpc = Math.min(5,Math.max(1,(rede==='publica'?3.5:2.8) + (r()-.5)*2.4 + (c.tot<30?.5:0)));
    const drop = Math.min(88,Math.max(4, 74 - 9.5*cpc + (rede==='privada'?5:-4) + (c.tot-50)*.25 + (r()-.5)*34));
    out.push({nome:c.nome,area:c.area,grau:c.grau,rede,cpc:+cpc.toFixed(2),desist:+drop.toFixed(1),mat:Math.round(60+r()*r()*1400)});
  }
  return out;
})();
const P4_DRIVERS = [
 ['Proporção de mestres e doutores',-.44],['Nota geral no Enade',-.37],['Modalidade EAD',.36],['Turno noturno',.29],
 ['Rede privada',.23],['Infraestrutura (nota)',-.18],['Tamanho da turma',.09],['Ano de criação do curso',-.05]
];

/* P5 · licenciaturas */
const P5_FUNIL = {desistem:56, cursando:3, concluem:41, enade:37, proficientes:13};
const P5_CURSOS = [
 ['Pedagogia',52,41],['Matemática',71,26],['Letras',62,38],['Educação Física',55,34],['História',64,39],
 ['Geografia',66,36],['Ciências Biológicas',60,33],['Química',69,24],['Física',77,19],['Artes Visuais',58,44]
].map(([nome,desist,prof])=>({nome,desist,prof}));

/* B1 · municípios: [nome, lat, lon, jovens 18–24 (mil), vagas presenciais por 100 jovens] */
const MUN = [
 ['Cuiabá',-15.60,-56.10,38.5,34],['Várzea Grande',-15.65,-56.13,27.8,18],['Rondonópolis',-16.47,-54.64,25.3,31],['Sinop',-11.86,-55.50,15.8,38],
 ['Tangará da Serra',-14.62,-57.49,11.2,29],['Cáceres',-16.07,-57.68,9.9,26],['Sorriso',-12.54,-55.71,9.4,17],['Lucas do Rio Verde',-13.05,-55.91,7.6,14],
 ['Primavera do Leste',-15.56,-54.30,7.1,16],['Barra do Garças',-15.89,-52.26,6.3,33],['Alta Floresta',-9.88,-56.09,6.1,24],['Pontes e Lacerda',-15.23,-59.34,5.4,12],
 ['Juína',-11.37,-58.74,4.3,19],['Colíder',-10.81,-55.46,3.6,16],['Peixoto de Azevedo',-10.23,-54.98,3.4,7],['Nova Mutum',-13.83,-56.08,3.9,6],
 ['Campo Verde',-15.55,-55.17,3.3,2],['Diamantino',-14.41,-56.45,3.1,9],['Confresa',-10.64,-51.57,3.0,5],['Água Boa',-14.05,-52.16,2.7,8],
 ['Canarana',-13.55,-52.27,2.2,4],['Querência',-12.60,-52.18,2.4,0],['Juara',-11.25,-57.52,2.6,6],['Guarantã do Norte',-9.96,-54.91,2.3,3],
 ['Mirassol d\'Oeste',-15.68,-58.09,2.0,11],['São Félix do Araguaia',-11.62,-50.67,1.9,0],['Campo Novo do Parecis',-13.66,-57.89,2.4,0],['Jaciara',-15.96,-54.97,2.5,8],
 ['Poconé',-16.26,-56.62,2.2,0],['Barra do Bugres',-15.07,-57.18,2.3,10],['Nova Xavantina',-14.67,-52.35,2.0,22],['Paranatinga',-14.43,-54.05,1.7,0],
 ['Aripuanã',-10.17,-59.45,2.0,0],['Colniza',-9.46,-59.11,2.4,0],['Sapezal',-13.54,-58.81,1.5,0],['Rosário Oeste',-14.83,-56.43,1.1,0],
 ['Chapada dos Guimarães',-15.46,-55.75,1.5,5],['Comodoro',-13.66,-59.79,1.4,0],['Vila Rica',-10.01,-51.12,1.2,0],['Alto Araguaia',-17.31,-53.22,1.2,9],['Itiquira',-17.21,-54.15,0.9,0]
].map(([nome,lat,lon,jov,vagas])=>({nome,lat,lon,jov,vagas}));
const MUN_PUBLICA_SHARE = .21;

/* B2 · financiamento na rede privada */
const B2_SERIE = {anos:[2021,2022,2023,2024], fies:[3.4,2.9,2.6,2.4], prouni:[6.6,6.9,7.2,7.6], sem:[90.0,90.2,90.2,90.0]};
const B2_QUARTIS = [{q:'Q1 · menos financiados',fin:2,desist:21.4,lo:19.9,hi:22.9},{q:'Q2',fin:7,desist:19.8,lo:18.5,hi:21.1},{q:'Q3',fin:14,desist:17.6,lo:16.3,hi:18.9},{q:'Q4 · mais financiados',fin:29,desist:15.9,lo:14.4,hi:17.4}];
const B2_CURSOS = (()=>{ const r=rng(7); return CURSOS.map(c=>{ const fin=Math.min(60,Math.max(0,(100-c.tot)*.35 + (r()-.4)*22)); return {nome:c.nome,area:c.area,fin:+fin.toFixed(1),desist:+Math.max(6,c.priv*.42 - fin*.12 + (r()-.5)*5).toFixed(1),mat:Math.round(200+r()*r()*3000)}; }); })();

/* ===== Acréscimos da versão multipáginas ===== */
CURSOS.forEach((c, i) => { c.ing = Math.round(180 + ((i * 7919) % 97) / 97 * 2400 * (c.tot < 40 ? .7 : 1) + (c.grau === 'licenciatura' ? 300 : 0) + (c.nome === 'Direito' || c.nome === 'Administração' ? 2600 : 0)); });

/* Brasil · coorte 2015 presencial: [ingressantes (mil), desistência %, conclusão %] */
const UF = {
 AC:[7.1,58,35],AL:[16.4,57,36],AP:[8.3,60,33],AM:[24.8,52,41],BA:[89.5,56,37],CE:[58.3,52,41],DF:[42.6,47,46],ES:[31.7,54,40],GO:[67.5,55,38],MA:[31.9,59,34],
 MT:[41.2,56,39],MS:[30.4,53,41],MG:[190.2,50,43],PA:[48.6,58,35],PB:[27.5,54,40],PR:[104.8,49,45],PE:[56.7,53,40],PI:[21.9,57,36],RJ:[96.4,55,38],RN:[24.2,55,38],
 RS:[78.3,48,45],RO:[14.5,59,34],RR:[4.9,56,37],SC:[67.9,47,46],SP:[420.3,51,42],SE:[14.3,55,38],TO:[13.6,57,36]
};
const BR_TOTAL = (() => { const t = Object.values(UF).reduce((a, v) => a + v[0], 0); return {ing:t, desist:Object.values(UF).reduce((a, v) => a + v[0] * v[1], 0) / t, conc:Object.values(UF).reduce((a, v) => a + v[0] * v[2], 0) / t}; })();
const UF_REDE = {publica:[.78,.9], privada:[1.04,1.0]}; // fatores de desistência e conclusão (apenas ilustrativo)

/* Municípios de MT (IBGE) com dados simulados; os 41 conhecidos mantêm valores definidos acima */
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MUN_ALL = (() => {
  const known = Object.fromEntries(MUN.map(m => [norm(m.nome), m]));
  return GEO_MT.items.map(it => {
    const k = known[norm(it.nome)], r = rng(+it.id);
    const jov = k ? k.jov : +(0.25 + r() * r() * 1.5).toFixed(2), v100 = k ? k.vagas : (r() < .82 ? 0 : +(1 + r() * 8).toFixed(1));
    return {id:it.id, nome:it.nome, jov, v100, vagas:Math.round(v100 * jov * 10)};
  });
})();

/* Licenciaturas: ingressantes e concluintes (coorte 2015) */
P5_CURSOS.forEach((c, i) => { c.ing = [5200, 1900, 3100, 3700, 1500, 1300, 2400, 700, 300, 800][i]; c.conc = Math.round(c.ing * (100 - c.desist - 3) / 100); });

/* Gráfico de pizza de pizza: situação dos ingressantes e perfil dos concluintes */
const P5_PROF = .36;

/* P4 · motivo (componente do CPC) */
const CPC_FAIXAS = ['Faixa 1', 'Faixa 2', 'Faixa 3', 'Faixa 4', 'Faixa 5'];
const CPC_DESIST = [72, 62, 52, 42, 33];
const CPC_MOTIVOS = [['Desempenho no Enade', 9], ['Corpo docente (mestres e doutores)', 7], ['Organização didático-pedagógica', 5], ['Infraestrutura', 4], ['Regime de trabalho docente', 2]];

/* B2 · estudantes financiados (mil), derivados das matrículas privadas */
const B2_ESTUDANTES = (() => { const priv = P3_ANOS.map((_, i) => (P3[1].mat[i] + P3[3].mat[i]) * 1000); return {priv, fies:priv.map((v, i) => Math.round(v * B2_SERIE.fies[i] / 100)), prouni:priv.map((v, i) => Math.round(v * B2_SERIE.prouni[i] / 100))}; })();

/* P1 · ingressantes por coorte (mil) */
const COORTES_ING = {2015:41.2, 2016:39.8, 2017:42.6, 2018:46.1, 2019:49.7, 2020:44.3};

export {rng, AREAS, LOCAIS, W, K, INGRESSANTES_2015, factor, weight, ANOS, P1_LOSS, P1_CONC, p1, CURSOS, CURVA, COORTE_F, AREA_F, P3, P3_ANOS, P4, P4_DRIVERS, P5_FUNIL, P5_CURSOS, MUN, MUN_PUBLICA_SHARE, B2_SERIE, B2_QUARTIS, B2_CURSOS, UF, BR_TOTAL, UF_REDE, norm, MUN_ALL, P5_PROF, CPC_FAIXAS, CPC_DESIST, CPC_MOTIVOS, B2_ESTUDANTES, COORTES_ING};
