import {useEffect,useRef} from 'react';
import {C,stackedArea,lineChart,lollipop} from '../visualization/charts.js';
import {groupedColumns} from '../visualization/charts2.js';
import type {CourseRow} from '../api/dashboard';

type Year = {year:number;concluded:number;remaining:number;dropout:number;loss:number};
/** Reutiliza os desenhos do protótipo; recebe somente agregações da API. */
export function TrajectoryChart({rows,kind}:{rows:Year[];kind:'area'|'line'|'loss'}){
 const host=useRef<HTMLDivElement>(null);
 const title={area:'Situação da turma ao longo dos anos',line:'Evolução da desistência e da conclusão',loss:'Perda a cada ano'}[kind];
 useEffect(()=>{
  if(!host.current)return;
  host.current.replaceChildren();
  if(rows.length<2)return;
  const layers=[{nome:'Concluiu',cor:C.blue,key:'concluded'},{nome:'Cursando',cor:C.gray,key:'remaining'},{nome:'Desistiu',cor:C.loss,key:'dropout'}];
  if(kind==='area')stackedArea(host.current,rows.map(r=>({...r,ano:r.year})),layers);
  else if(kind==='line')lineChart(host.current,rows.map(r=>r.year),layers.map(l=>({nome:l.nome,cor:l.cor,values:rows.map(r=>r[l.key as 'concluded'|'remaining'|'dropout'])})),{unit:'%',ymax:100,labelEnd:true,h:280});
  else lollipop(host.current,rows.map(r=>({...r,ano:r.year})),'loss',rows.findIndex(r=>r.loss===Math.max(...rows.map(v=>v.loss))));
  host.current.querySelector('svg')?.setAttribute('aria-label',title);
 },[rows,kind,title]);
 return <>{rows.length<2&&<p className="empty">Série insuficiente para mostrar a evolução.</p>}<div ref={host}/></>;
}
export function CohortComposition({courses}:{courses:CourseRow[]}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!host.current)return;
  const names:Record<string,string>={'1':'Bacharelado','2':'Licenciatura','3':'Tecnológico'};
  const degrees=Object.keys(names).filter(g=>courses.some(r=>r.degree===g));
  groupedColumns(host.current,degrees.map(g=>names[g]),[{code:'1',nome:'Pública',cor:C.navy},{code:'2',nome:'Privada',cor:C.loss}].map(n=>({...n,values:degrees.map(g=>courses.filter(r=>r.degree===g&&r.network===n.code).reduce((sum,r)=>sum+r.ingress,0))})),{vf:(v:number)=>v.toLocaleString('pt-BR'),yf:(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:0}),step:4000,h:280,w:460});
  host.current.querySelector('svg')?.setAttribute('aria-label','Ingressantes por grau acadêmico e rede');
 },[courses]);
 return <div ref={host}/>;
}
