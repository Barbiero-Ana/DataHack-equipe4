import type {ReactNode} from 'react';
import {MunicipalEvidence} from './MunicipalEvidence';
import type {Dashboard,CourseRow} from '../api/dashboard';
import type {AnalyticsData} from '../hooks/useAnalytics';
import {Bars,Lines,Scatter,Distribution,Tree,palette,number,pct,ratio} from './RealCharts';
import {SeriesChart} from './SeriesChart';
import type {PageId} from '../pages';
export function RealCard({title,hint,children}:{title:string;hint:string;children:ReactNode}){
 return <div className="card"><h3>{title}</h3><p className="hint">{hint}</p>{children}</div>;
}
export function summarize(rows:CourseRow[]){
 const sums={ingress:0,denominator:0,concluded:0,dropout:0,remaining:0,annual_dropout:0};
 for(const row of rows)for(const key of Object.keys(sums) as (keyof typeof sums)[])sums[key]+=row[key];
 return {...sums,dropout_pct:ratio(sums.dropout,sums.denominator),concluded_pct:ratio(sums.concluded,sums.denominator),remaining_pct:ratio(sums.remaining,sums.denominator)};
}
function ranks(values:number[]){const sorted=[...values].sort((a,b)=>a-b);return values.map(v=>(sorted.indexOf(v)+sorted.lastIndexOf(v))/2+1);}
function correlation(points:{x:number;y:number}[]){
 if(points.length<3)return null;const x=ranks(points.map(p=>p.x)),y=ranks(points.map(p=>p.y));
 const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
 const cov=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0),vx=x.reduce((s,v)=>s+(v-mx)**2,0),vy=y.reduce((s,v)=>s+(v-my)**2,0);
 return vx>0&&vy>0?cov/Math.sqrt(vx*vy):null;
}
const descriptions={p1:'Quanto da turma fica pelo caminho?',p2:'Onde a rota mais se perde?',p3:'Pública × privada, presencial × EAD',p4:'Qualidade e desistência',p5:'Licenciaturas e proficiência',b1:'Oferta presencial nos municípios',b2:'Financiamento e permanência'};
export type Question=keyof typeof descriptions;
const courseLabel=(r:CourseRow)=>`${r.name} · ${r.course}`;
export function QuestionEvidence({question,chart,annual}:{question:Question;chart:Dashboard;annual:AnalyticsData|null}){
 const d=chart.data, courses=d.courses;
 const years=[...new Set(d.trajectory.map(r=>r.year))].sort();
 const timeline=years.map(year=>summarize(d.trajectory.filter(r=>r.year===year)));
 const notes=<details className="note"><summary>Cobertura e limites da análise</summary><ul>{chart.audit.notes.map(n=><li key={n}>{n}</li>)}</ul>
 <p>Universo antes dos filtros: {chart.audit.cpc.published_courses}/{chart.audit.cpc.universe_courses} cursos publicáveis no CPC; {chart.audit.enade.published_courses}/{chart.audit.enade.universe_courses} licenciaturas publicáveis no Enade. Células com menos de {chart.audit.minimum_cell} alunos no denominador não são publicadas.</p></details>;
 let evidence:ReactNode;
 if(question==='p1' && !courses.length) return <p className="empty">Nenhum curso de trajetória da coorte 2015 no recorte selecionado. As medidas estão indisponíveis.</p>;
 if(question==='p1'){
  const totals=summarize(courses),annualLoss=timeline.map((r,i)=>({label:String(years[i]),value:r.annual_dropout}));
  evidence=<><div className="kpis"><Metric value={number(totals.ingress)} label="ingressantes · coorte 2015"/><Metric value={pct(totals.dropout_pct)} label="desistência acumulada"/><Metric value={pct(totals.concluded_pct)} label="conclusão acumulada"/><Metric value={pct(totals.remaining_pct)} label="permanência em 2024"/></div>
   <div className="grid c2"><RealCard title="Trajetória da coorte 2015" hint="Taxas ponderadas pelo denominador ajustado por falecimentos; presencial, MT.">
    <Lines years={years} percent series={[{label:'Desistência',color:palette[1],values:timeline.map(r=>r.dropout_pct)},{label:'Conclusão',color:palette[0],values:timeline.map(r=>r.concluded_pct)},{label:'Permanência',color:palette[2],values:timeline.map(r=>r.remaining_pct)}]}/></RealCard>
    <RealCard title="Desistências anuais" hint="Contagens anuais da mesma coorte; ingressantes não são somados entre referências."><Bars rows={annualLoss} color={palette[1]}/></RealCard>
    <RealCard title="Situação em 2024" hint={`Denominador ajustado: ${number(totals.denominator)}; ingressantes originais: ${number(totals.ingress)}.`}><Distribution items={[{label:'Concluíram',value:totals.concluded,color:palette[0]},{label:'Desistiram',value:totals.dropout,color:palette[1]},{label:'Permaneciam',value:totals.remaining,color:palette[2]}]}/></RealCard>
    <RealCard title="Ingressantes por rede" hint="Uma contagem da coorte 2015 por curso; outras coortes não estão disponíveis."><Bars rows={['1','2'].flatMap(n=>{const group=courses.filter(r=>r.network===n);return group.length?[{label:n==='1'?'Pública':'Privada',value:summarize(group).ingress}]:[];})}/></RealCard></div></>;
 }else if(question==='p2'){
  const areas=[...new Set(courses.map(r=>r.area))].map(area=>({label:area,value:summarize(courses.filter(r=>r.area===area)).dropout_pct})).filter((r):r is {label:string;value:number}=>r.value!==null).sort((a,b)=>b.value-a.value);
  evidence=<><RealCard title="Cursos agrupados por área" hint="Valores reais; tamanho é a coorte original e cor é a desistência acumulada até 2024."><Tree rows={courses}/></RealCard>
   <div className="grid c2"><RealCard title="Desistência por área" hint="Soma dos desistentes / soma dos denominadores ajustados, não média simples."><Bars rows={areas} percent color={palette[1]}/></RealCard>
   <RealCard title="Cursos com maior desistência" hint="Cada vínculo curso/IES é identificado pelo código; coorte com pelo menos 10 ingressantes."><Bars rows={[...courses].sort((a,b)=>b.dropout_pct-a.dropout_pct).slice(0,10).map(r=>({label:courseLabel(r),value:r.dropout_pct}))} percent color={palette[1]}/></RealCard></div></>;
 }else if(question==='p3'){
  evidence=annual?<div className="grid c2"><RealCard title="Matrículas por rede e modalidade" hint="Censo 2021–2024 · filtros próprios da P3."><SeriesChart rows={annual.annual.records} metric="qt_mat"/></RealCard>
   <RealCard title="Estimativa de evasão anual" hint="Balanço de matrículas; 2021 indisponível sem Censo 2020. Não equivale à desistência da coorte."><SeriesChart rows={annual.annual.records} metric="evasao_estimada_pct"/></RealCard></div>:<p className="empty">Aguardando os indicadores anuais da API.</p>;
 }else if(question==='p4'){
  const points=d.cpc.map(r=>({label:`${courseLabel(r)} · CPC ${r.edition}`,x:r.cpc,y:r.dropout_pct,size:r.ingress,color:r.network==='1'?palette[0]:palette[1]}));
  const rho=correlation(points);
  const components=[...new Set(d.cpc.flatMap(r=>Object.keys(r.components)))].map(label=>({label,value:correlation(d.cpc.filter(r=>r.components[label]!==null&&r.components[label]!==undefined).map(r=>({x:r.components[label]!,y:r.dropout_pct})))}));
  evidence=<><p className="methodology">{d.cpc.length} cursos com CPC numérico, correspondência por curso + IES e pelo menos 10 participantes. Spearman CPC/desistência: {number(rho,3)}. Associação entre cursos; não demonstra causa.</p>
   <div className="grid c2"><RealCard title="CPC × desistência" hint="Última edição disponível (2021–2023) × coorte 2015 observada em 2024; bolha = ingressantes."><Scatter points={points} xlabel="CPC contínuo" ylabel="Desistência acumulada (%)"/></RealCard>
   <RealCard title="Desistência por faixa CPC" hint="Faixa oficial do arquivo; taxas ponderadas pelo denominador da coorte."><Bars rows={['1','2','3','4','5'].flatMap(b=>{const group=d.cpc.filter(r=>r.cpc_band===b);const value=summarize(group).dropout_pct;return value===null?[]:[{label:`Faixa ${b} · ${group.length} cursos`,value}];})} percent color={palette[1]}/></RealCard></div>
   <RealCard title="Componentes do CPC e associação com desistência" hint="Spearman em cursos com ambas as medidas. Ausência e amostra insuficiente não viram correlação zero."><table className="table"><thead><tr><th>Componente</th><th>Spearman</th></tr></thead><tbody>{components.map(r=><tr key={r.label}><td>{r.label}</td><td>{number(r.value,3)}</td></tr>)}</tbody></table></RealCard></>;
 }else if(question==='p5'){
  const lic=courses.filter(r=>r.degree==='2'),sum=summarize(lic),part=d.enade.reduce((s,r)=>s+r.participants,0),prof=d.enade.reduce((s,r)=>s+r.proficient,0);
  evidence=<><p className="methodology">Trajetória e Enade são populações distintas. Estes gráficos não multiplicam conclusão da coorte pela proficiência de 2025.</p>
   <div className="grid c2"><RealCard title="Licenciaturas · trajetória 2015–2024" hint={`${lic.length} cursos; denominador ajustado ${number(sum.denominator)}.`}><Distribution items={[{label:'Concluíram',value:sum.concluded,color:palette[0]},{label:'Desistiram',value:sum.dropout,color:palette[1]},{label:'Permaneciam',value:sum.remaining,color:palette[2]}]}/></RealCard>
   <RealCard title="Enade 2025 · cursos correspondentes" hint={`${d.enade.length} cursos publicáveis; proficiência = ${number(prof)} / ${number(part)} participantes.`}><Distribution items={[{label:'Proficientes',value:prof,color:palette[0]},{label:'Não proficientes',value:part-prof,color:palette[1]}]}/></RealCard>
   <RealCard title="Desistência × proficiência por curso" hint="Correspondência curso + IES; coorte 2015 e avaliados 2025, sem vínculo individual."><Scatter points={d.enade.map(r=>({label:courseLabel(r),x:r.dropout_pct,y:r.proficiency_pct,size:r.participants}))} xlabel="Desistência da coorte (%)" ylabel="Proficiência Enade 2025 (%)"/></RealCard>
   <RealCard title="Proficiência por licenciatura" hint="Proficientes / participantes de cada curso, com pelo menos 10 avaliados."><Bars rows={[...d.enade].sort((a,b)=>b.proficiency_pct-a.proficiency_pct).slice(0,10).map(r=>({label:courseLabel(r),value:r.proficiency_pct}))} percent/></RealCard></div></>;
 }else if(question==='b1'){
  evidence=<><MunicipalEvidence rows={d.municipal}/>
   {annual?.population.records[0]&&<RealCard title="Complemento estadual · Censo 2022" hint="População e oferta no mesmo ano e UF; não recebe filtros municipais."><Bars rows={[{label:'População 18–19 anos',value:annual.population.records[0].qt_pop_18_19},{label:'População 20–24 anos',value:annual.population.records[0].qt_pop_20_24}]}/></RealCard>}</>;
 }else{
  const fy=[...new Set(d.finance.map(r=>r.year))].sort(),measure=(key:'matriculated'|'fies'|'prouni_full'|'prouni_partial',year:number)=>d.finance.filter(r=>r.year===year).reduce((s,r)=>s+r[key],0);
  const points=d.funding_relationship.map(r=>({label:courseLabel(r),x:r.fies_pct,y:r.dropout_pct,size:r.ingress}));
  const bins=[{label:'Sem FIES',lo:0,hi:0},{label:'FIES: >0–5%',lo:0,hi:5},{label:'FIES: >5–10%',lo:5,hi:10},{label:'FIES: >10%',lo:10,hi:100}];
  const quartiles=bins.flatMap(bin=>{const group=d.funding_relationship.filter(r=>bin.hi===0?r.fies_pct===0:r.fies_pct>bin.lo&&r.fies_pct<=bin.hi);const value=summarize(group).dropout_pct;return value===null?[]:[{label:`${bin.label} · ${group.length} cursos`,value}];});
  evidence=<><p className="methodology">Rede privada · FIES e ProUni separados, sem somar beneficiários potencialmente sobrepostos. Relação exploratória: financiamento 2024 × trajetória da coorte 2015 em 2024, não efeito causal.</p>
   <div className="grid c2"><RealCard title="Matrículas financiadas por ano" hint="Contagens reais da rede privada, 2021–2024."><Lines years={fy} series={(['fies','prouni_full','prouni_partial'] as const).map((key,i)=>({label:['FIES','ProUni integral','ProUni parcial'][i],color:palette[i],values:fy.map(year=>measure(key,year))}))}/></RealCard>
   <RealCard title="Participação nas matrículas privadas" hint="Razão dos totais do recorte, separadamente por programa."><Lines years={fy} percent series={(['fies','prouni_full','prouni_partial'] as const).map((key,i)=>({label:['FIES','ProUni integral','ProUni parcial'][i],color:palette[i],values:fy.map(year=>ratio(measure(key,year),measure('matriculated',year)))}))}/></RealCard>
   <RealCard title="FIES × desistência por curso" hint={`${points.length} cursos correspondentes; matrícula atual ≥ 10 e coorte original ≥ 10.`}><Scatter points={points} xlabel="Matrículas FIES 2024 (%)" ylabel="Desistência da coorte (%)"/></RealCard>
   <RealCard title="Desistência por participação FIES" hint="Faixas explícitas de participação FIES em 2024; taxa ponderada pela coorte. Associação descritiva, sem efeito causal."><Bars rows={quartiles} percent color={palette[1]}/></RealCard></div></>;
 }
 return <>{evidence}{notes}</>;
}
function Metric({value,label}:{value:string;label:string}){return <div className="kpi"><b>{value}</b><span>{label}</span></div>;}
export function RealQuestionsPage({current,chart,annual,selected,setSelected}:{current:PageId;chart:Dashboard;annual:AnalyticsData|null;selected:Question;setSelected:(value:Question)=>void}){
 const d=chart.data,summary=summarize(d.courses);
 const values:Record<Question,string>={p1:pct(summary.dropout_pct),p2:number(d.courses.length),p3:number(annual?.annual.total),p4:number(d.cpc.length),p5:number(d.enade.length),b1:number(new Set(d.municipal.map(r=>r.municipality)).size),b2:number(d.funding_relationship.length)};
 const labels:Record<Question,string>={p1:'desistência acumulada',p2:'cursos da coorte',p3:'registros anuais no recorte',p4:'cursos CPC correspondentes',p5:'licenciaturas Enade correspondentes',b1:'municípios com registros',b2:'cursos com financiamento ligado'};
 const question=(current in descriptions?current:selected) as Question;
 const licSummary=summarize(d.courses.filter(r=>r.degree==='2'));
 const prof=d.enade.reduce((sum,r)=>sum+r.proficient,0), participants=d.enade.reduce((sum,r)=>sum+r.participants,0);
 const cpcRho=correlation(d.cpc.map(r=>({x:r.cpc,y:r.dropout_pct})));
 const sortedCourses=[...d.courses].sort((a,b)=>b.dropout_pct-a.dropout_pct);
 const summaries:Record<Question,string>={
  p1:summary.denominator>0?`No recorte publicado, ${pct(summary.dropout_pct)} dos vínculos da coorte 2015 desistiram do curso até 2024; ${pct(summary.concluded_pct)} concluíram e ${pct(summary.remaining_pct)} permaneciam.`:'Não há cursos da coorte 2015 no recorte selecionado.',
  p2:sortedCourses.length?`O ranking compara ${sortedCourses.length} cursos no mesmo acompanhamento. A maior taxa neste recorte é ${pct(sortedCourses[0].dropout_pct)}, em ${courseLabel(sortedCourses[0])}. As áreas são agregadas pelos numeradores e denominadores.`:'Sem cursos no recorte.',
  p3:'Os gráficos comparam matrículas e estimativa anual por rede/modalidade. A estimativa usa o ano anterior; 2021 permanece indisponível sem Censo 2020. Grau, área e município não filtram este produto estadual.',
  p4:`Nos ${d.cpc.length} cursos com ambas as medidas, Spearman CPC/desistência é ${number(cpcRho,3)}. A associação observada não demonstra que qualidade cause retenção. Cada ponto informa a edição CPC.`,
  p5:`Nas licenciaturas da coorte, a desistência é ${pct(licSummary.dropout_pct)}. Nos ${d.enade.length} cursos correspondentes publicáveis do Enade 2025, ${number(prof)} de ${number(participants)} avaliados são proficientes (${pct(ratio(prof,participants))}). São populações diferentes.`,
  b1:`Há registros de oferta presencial em ${values.b1} municípios neste recorte de 2022. O mapa mostra vagas reais. A população estadual não permite calcular vagas por 100 jovens em cada município nem contar desertos municipais.`,
  b2:`Financiamento e trajetória foram ligados em ${d.funding_relationship.length} cursos privados. FIES e ProUni aparecem separadamente; os dados não identificam o financiamento dos mesmos ingressantes de 2015 nem demonstram efeito causal.`,
 };
 return <>{(current==='ans'||current==='resumo')&&<>
  <div className="qcards">{(Object.keys(descriptions) as Question[]).map(q=><button type="button" className={`qcard ${selected===q?'on':''}`} key={q} onClick={()=>setSelected(q)}>
  <span className={`qwm ${q.startsWith('b')?'bonus':''}`}>{q.toUpperCase()}</span><span className="qt">{descriptions[q]}</span><b>{values[q]}</b><span className="ql">{labels[q]}</span></button>)}</div>
  <div className="ans-panel"><div className="ans-head"><span className="tag">{selected.toUpperCase()}</span><h3>{descriptions[selected]}</h3></div><div className="ans-body"><p>{summaries[selected]}</p><div><p className="note">Fonte: INEP/IBGE · MT · dados consultados na API. As taxas agregadas usam os numeradores e denominadores do mesmo universo.</p></div></div></div>
 </>}
 <div style={{marginTop:14}}><QuestionEvidence question={question} chart={chart} annual={annual}/></div>
 <p className="note">Produto {chart.chart_contract} · versão {chart.metadata.release_id} · {chart.audit.trajectory.suppressed_courses_under10} cursos com coorte menor que 10 excluídos da publicação.</p></>;
}
