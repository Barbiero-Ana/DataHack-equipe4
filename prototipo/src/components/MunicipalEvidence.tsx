import {useState} from 'react';
import type {MunicipalRow,MunicipalPopulation} from '../api/dashboard';
import {Bars,MunicipalMap,number} from './RealCharts';

export function MunicipalEvidence({rows,population=[]}:{rows:MunicipalRow[];population?:MunicipalPopulation[]}){
 const [network,setNetwork]=useState('');
 const filtered=rows.filter(r=>!network||r.network===network);
 const totals=new Map<string,{label:string;value:number;matriculated:number}>();
 for(const r of filtered){const v=totals.get(r.municipality)||{label:r.name,value:0,matriculated:0};v.value+=r.vacancies;v.matriculated+=r.matriculated;totals.set(r.municipality,v);}
 const municipalities=[...totals.values()];
 const popTotal=population.reduce((sum,r)=>sum+r.population,0);
 const proportional=population.flatMap(p=>{const offer=totals.get(p.municipality);return offer&&p.population>0?[{label:p.name,value:100*offer.value/p.population}]:[];}).sort((a,b)=>a.value-b.value);
 return <><div className="ctl"><label>Rede no B1<select value={network} onChange={e=>setNetwork(e.target.value)}><option value="">Todas as redes do recorte</option><option value="1">Pública</option><option value="2">Privada</option></select></label><button type="button" onClick={()=>setNetwork('')}>Limpar rede do B1</button></div>
 <p className="methodology">Censo 2022 · presencial. O filtro de rede acima atualiza mapa, totais e ranking dentro do recorte dos filtros gerais. Grau, área e modalidade não alteram o B1.</p>
 <div className="kpis"><div className="kpi"><b>{number(totals.size)}</b><span>municípios com registros</span></div><div className="kpi"><b>{number(filtered.length?municipalities.reduce((s,r)=>s+r.value,0):null)}</b><span>vagas presenciais</span></div><div className="kpi"><b>{number(filtered.length?municipalities.reduce((s,r)=>s+r.matriculated,0):null)}</b><span>matrículas presenciais</span></div>{population.length>0&&<div className="kpi"><b>{number(popTotal)}</b><span>jovens 18–24 · {population.length} municípios</span></div>}</div>
 {!filtered.length&&<p className="empty">Sem registros para essa combinação de filtros. As contagens abaixo não comprovam ausência de oferta.</p>}
 <div className="grid c21"><div className="card"><h3>Mapa de oferta presencial · Mato Grosso</h3><p className="hint">Selecione o indicador e consulte os detalhes de cada município.</p><MunicipalMap rows={filtered} population={population}/></div><div className="card"><h3>Maiores ofertas municipais</h3><p className="hint">Vagas presenciais totais em 2022, na rede selecionada.</p><Bars rows={municipalities.sort((a,b)=>b.value-a.value).slice(0,12)}/></div></div>{population.length>0&&<><p className="note">População contada uma vez por município, independentemente da rede. {population.filter(r=>!totals.has(r.municipality)).length} municípios têm população, mas não possuem registro de oferta no recorte; não são classificados automaticamente como desertos.</p><div className="card"><h3>Menor oferta proporcional registrada</h3><p className="hint">Vagas por 100 jovens de 18–24 anos, em 2022. Municípios sem registro de oferta ficam fora do ranking.</p><Bars rows={proportional.slice(0,12)}/></div></>}</>;
}
