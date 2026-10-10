import {useEffect,useRef,useState} from 'react';
import type {MunicipalRow} from '../api/dashboard';
import {treemap,choropleth,ramp,RAMP_TEAL,RAMP_DIV} from '../visualization/charts2.js';
import {GEO_MT} from '../visualization/geo.js';
export const palette=['#145c63','#ff7e70','#9a9cb0','#e9a23b','#8ccfcb'];
export const number=(v:number|null|undefined,d=0)=>v==null?'Indisponível':v.toLocaleString('pt-BR',{maximumFractionDigits:d});
export const pct=(v:number|null|undefined)=>v==null?'Indisponível':`${number(v,1)}%`;
export const ratio=(n:number,d:number)=>d>0?100*n/d:null;
export interface Point {label:string;x:number;y:number;size?:number;color?:string}
export function Bars({rows,percent=false,color=palette[0]}:{rows:{label:string;value:number}[];percent?:boolean;color?:string}){
 if(!rows.length)return <p className="empty">Sem registros neste recorte.</p>;
 const height=Math.max(200,rows.length*32+30),max=Math.max(1,...rows.map(r=>r.value)),width=760,left=225,right=85;
 return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Comparação por categoria">{rows.map((r,i)=><g key={`${r.label}-${i}`}>
  <text x={left-10} y={i*32+29} textAnchor="end"><title>{r.label}</title>{r.label.length>29?`${r.label.slice(0,28)}…`:r.label}</text>
  <rect x={left} y={i*32+14} width={r.value/max*(width-left-right)} height="20" fill={color} rx="3"><title>{r.label}: {percent?pct(r.value):number(r.value)}</title></rect>
  <text x={left+r.value/max*(width-left-right)+8} y={i*32+29}>{percent?pct(r.value):number(r.value)}</text></g>)}</svg>;
}
export function Lines({years,series,percent=false}:{years:number[];series:{label:string;values:(number|null)[];color:string}[];percent?:boolean}){
 const values=series.flatMap(s=>s.values.filter((v):v is number=>v!==null));
 if(!values.length)return <p className="empty">Sem medidas disponíveis.</p>;
 const max=Math.max(1,...values),x=(i:number)=>65+i/Math.max(1,years.length-1)*610,y=(v:number)=>245-v/max*215;
 return <><svg viewBox="0 0 740 290" role="img" aria-label="Evolução anual">{[0,.25,.5,.75,1].map(k=><g key={k}>
  <line x1="65" x2="675" y1={y(k*max)} y2={y(k*max)} className="axis"/><text x="57" y={y(k*max)+4} textAnchor="end">{percent?pct(k*max):number(k*max)}</text></g>)}
  {years.map((year,i)=><text key={year} x={x(i)} y="270" textAnchor="middle">{year}</text>)}
  {series.map(s=><g key={s.label}>{s.values.map((v,i)=>v===null?null:<g key={i}>
   {i>0&&s.values[i-1]!==null&&<line x1={x(i-1)} x2={x(i)} y1={y(s.values[i-1]!)} y2={y(v)} stroke={s.color} strokeWidth="2.4"/>}
   <circle cx={x(i)} cy={y(v)} r="3" fill={s.color}><title>{s.label} · {years[i]}: {percent?pct(v):number(v)}</title></circle></g>)}</g>)}</svg>
  <div className="legend">{series.map(s=><span key={s.label}><i style={{background:s.color}}/>{s.label}</span>)}</div></>;
}
export function Scatter({points,xlabel,ylabel}:{points:Point[];xlabel:string;ylabel:string}){
 if(!points.length)return <p className="empty">Sem cursos com ambas as medidas válidas.</p>;
 const xmin=Math.min(0,...points.map(p=>p.x)),xmax=Math.max(1,...points.map(p=>p.x));
 const ymin=Math.min(0,...points.map(p=>p.y)),ymax=Math.max(1,...points.map(p=>p.y));
 const x=(v:number)=>65+(v-xmin)/(xmax-xmin)*600,y=(v:number)=>265-(v-ymin)/(ymax-ymin)*235;
 return <svg viewBox="0 0 750 330" role="img" aria-label={`${xlabel} versus ${ylabel}`}>
  {[0,.25,.5,.75,1].map(k=><g key={k}><line x1="65" x2="665" y1={y(ymin+k*(ymax-ymin))} y2={y(ymin+k*(ymax-ymin))} className="axis"/>
  <text x="57" y={y(ymin+k*(ymax-ymin))+4} textAnchor="end">{number(ymin+k*(ymax-ymin),1)}</text>
  <text x={x(xmin+k*(xmax-xmin))} y="285" textAnchor="middle">{number(xmin+k*(xmax-xmin),1)}</text></g>)}
  {points.map((p,i)=><circle key={i} cx={x(p.x)} cy={y(p.y)} r={Math.min(13,3+Math.sqrt(p.size||10)/8)} fill={p.color||palette[0]} opacity=".65">
   <title>{p.label} · {xlabel}: {number(p.x,2)} · {ylabel}: {number(p.y,2)}</title></circle>)}
  <text x="360" y="315" textAnchor="middle">{xlabel}</text><text x="16" y="160" textAnchor="middle" transform="rotate(-90 16 160)">{ylabel}</text></svg>;
}
export function Distribution({items}:{items:{label:string;value:number;color:string}[]}){
 const total=items.reduce((s,r)=>s+r.value,0);let start=0;
 if(!total)return <p className="empty">Sem denominador disponível.</p>;
 return <><svg viewBox="0 0 700 210" role="img" aria-label="Distribuição dos resultados">{items.map(r=>{
  const offset=start;start+=r.value/total*100;
  return <circle key={r.label} cx="130" cy="100" r="70" fill="none" stroke={r.color} strokeWidth="35" pathLength="100"
    strokeDasharray={`${r.value/total*100} ${100-r.value/total*100}`} strokeDashoffset={-offset} transform="rotate(-90 130 100)">
    <title>{r.label}: {number(r.value)} ({pct(ratio(r.value,total))})</title></circle>;})}
  <text x="130" y="98" textAnchor="middle" className="t-strong">{number(total)}</text><text x="130" y="117" textAnchor="middle">denominador</text>
  {items.map((r,i)=><g key={r.label}><rect x="260" y={45+i*45} width="12" height="12" rx="3" fill={r.color}/>
   <text x="285" y={56+i*45}>{r.label}: {number(r.value)} · {pct(ratio(r.value,total))}</text></g>)}</svg></>;
}
export function Tree({rows}:{rows:{name:string;area:string;ingress:number;dropout_pct:number;course:string}[]}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!host.current)return;
  if(!rows.length){host.current.replaceChildren();return;}
  const areas=[...new Set(rows.map(r=>r.area))];
  treemap(host.current,areas.map(area=>({nome:area,children:rows.filter(r=>r.area===area).map(r=>({nome:r.name,v:r.ingress,c:r.dropout_pct,extra:`Curso ${r.course}`}))})),{h:430});
 },[rows]);
 return <>{!rows.length&&<p className="empty">Sem cursos no recorte.</p>}<div ref={host}/><div className="legend"><span>Área = ingressantes da coorte 2015 · cor = desistência acumulada</span>{RAMP_DIV.map((_:number[],i:number)=><i key={i} style={{background:ramp(i/3,RAMP_DIV)}}/>)}</div></>;
}
export function MunicipalMap({rows}:{rows:MunicipalRow[]}){
 const host=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState('');
 const [metric,setMetric]=useState<'vacancies'|'matriculated'|'lowest'>('vacancies');
 const totals=new Map<string,{name:string;vacancies:number;matriculated:number}>();
 for(const row of rows){const t=totals.get(row.municipality)||{name:row.name,vacancies:0,matriculated:0};t.vacancies+=row.vacancies;t.matriculated+=row.matriculated;totals.set(row.municipality,t);}
 const measure=metric==='matriculated'?'matriculated':'vacancies';
 const max=Math.max(1,...[...totals.values()].map(r=>r[measure]));
 const low=new Set([...totals.entries()].filter(([,r])=>r.vacancies>0).sort((a,b)=>a[1].vacancies-b[1].vacancies||a[1].name.localeCompare(b[1].name,'pt-BR')).slice(0,15).map(([id])=>id));
 const title=metric==='matriculated'?'Matrículas presenciais':'Vagas presenciais';
 useEffect(()=>{
  if(!host.current)return;
  choropleth(host.current,GEO_MT,(it:{id:string;nome:string})=>{
   const value=totals.get(it.id);
   const fill=!value?'#e4e0e5':metric==='lowest'?(low.has(it.id)?'#cf584e':'#bfe3e0'):ramp(Math.sqrt(value[measure]/max),RAMP_TEAL);
   return {fill,stroke:it.id===selected?'#2b2d42':'#fff',sw:it.id===selected?2.4:.7,
    tip:value?`<b>${value.name}</b><br>Vagas presenciais 2022: ${number(value.vacancies)}<br>Matrículas: ${number(value.matriculated)}`:`<b>${it.nome}</b><br>Sem registro de oferta neste recorte`};
  },(it:{id:string})=>setSelected(it.id));
 },[rows,selected,metric]);
 const value=totals.get(selected);
 const selectedName=GEO_MT.items.find((it:{id:string})=>it.id===selected)?.nome;
 return <><div className="ctl"><div><span className="hint">Indicador do mapa</span><div className="seg map-indicators" role="group" aria-label="Indicador do mapa">
  <button type="button" className={metric==='vacancies'?'on':''} aria-pressed={metric==='vacancies'} onClick={()=>setMetric('vacancies')}>Vagas presenciais</button>
  <button type="button" className={metric==='matriculated'?'on':''} aria-pressed={metric==='matriculated'} onClick={()=>setMetric('matriculated')}>Matrículas</button>
  <button type="button" className={metric==='lowest'?'on':''} aria-pressed={metric==='lowest'} onClick={()=>setMetric('lowest')}>Menor oferta absoluta</button>
  <button type="button" disabled title="Requer população municipal de 18–24 anos">Vagas por 100 jovens</button>
  <button type="button" disabled title="Requer população municipal de 18–24 anos">Jovens 18–24</button>
 </div></div><label>Consultar município<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione</option>{[...GEO_MT.items].sort((a:{nome:string},b:{nome:string})=>a.nome.localeCompare(b.nome,'pt-BR')).map((it:{id:string;nome:string})=><option key={it.id} value={it.id}>{it.nome}</option>)}</select></label></div>
 <p className="note">Os indicadores por população aguardam a tabela municipal de 18–24 anos. A tabela estadual disponível não permite esse cálculo por município.</p>
 <div ref={host} style={{maxWidth:560,margin:'auto'}}/>
 <div className="legend" aria-label="Legenda do mapa">{metric==='lowest'?<><span><i style={{background:'#cf584e'}}/>{low.size} menores ofertas positivas em número de vagas</span><span><i style={{background:'#bfe3e0'}}/>Demais municípios com registro</span></>:<><span>{title} · 2022 · menos → mais</span><span className="map-scale">{[0,.25,.5,.75,1].map(t=><span key={t}><i style={{background:ramp(t,RAMP_TEAL)}}/>{number(Math.round(t*t*max))}</span>)}</span></>}<span><i style={{background:'#e4e0e5'}}/>Sem registro no recorte (não significa zero)</span></div>
 {metric!=='lowest'&&<p className="note">Escala de cores não linear (raiz quadrada), recalculada para o recorte exibido; os rótulos mostram as contagens reais.</p>}
 <div className="map-details" aria-live="polite"><h3>{selectedName||'Selecione um município'}</h3>{value?<table className="table"><tbody><tr><td>Vagas presenciais · 2022</td><td>{number(value.vacancies)}</td></tr><tr><td>Matrículas presenciais · 2022</td><td>{number(value.matriculated)}</td></tr><tr><td>Jovens 18–24 / vagas por 100 jovens</td><td>Indisponível na base municipal</td></tr></tbody></table>:<p className="note">{selected?'Sem registro de oferta no recorte; ausência não comprova oferta zero.':'Clique no mapa ou use a lista para consultar os valores.'}</p>}</div></>;
}
