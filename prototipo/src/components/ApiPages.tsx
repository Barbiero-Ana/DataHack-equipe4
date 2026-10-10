import {useState} from 'react';
import type {Question} from './QuestionsReal';
import type {PageId} from '../pages';
import {pages} from '../pages';
import type {AnalyticsData} from '../hooks/useAnalytics';
import type {Dashboard} from '../api/dashboard';
import {AnnualTable} from './AnnualTable';
import {RealQuestionsPage,QuestionEvidence} from './QuestionsReal';
export function ApiPages({current,data,chart,loading,error,retry}:{current:PageId;data:AnalyticsData|null;chart:Dashboard|null;
 loading:boolean;error:string|null;retry:()=>void}){
 const [selected,setSelected]=useState<Question>('p1');
 const title=current==='br'?'Contexto de Mato Grosso':pages.find(p=>p.id===current)!.title;
 const incompatible=chart&&data&&chart.metadata.release_id!==data.catalog.metadata.release_id;
 return <div className="viewport"><section className="page" aria-label={title} key={current}>
  <div className="page-head"><div className="grow"><h2>{title}</h2><p>Gráficos com dados reais · INEP/IBGE · Mato Grosso</p></div><span className="src">Dados da API</span></div>
  {loading?<p role="status" className="empty">Consultando os produtos gráficos reais…</p>:error||incompatible?<div role="alert" className="card"><p>{incompatible?'A versão dos dados mudou entre consultas. Atualize para conferir.':error}</p><button type="button" onClick={retry}>Tentar novamente</button></div>:chart?<>
   {current==='br'?<><p className="methodology">A versão carregada contém o recorte de Mato Grosso. Não há totais nacionais neste produto para preencher os demais estados.</p><QuestionEvidence question="p1" chart={chart} annual={data}/></>:
    <RealQuestionsPage current={current} chart={chart} annual={data} selected={selected} setSelected={setSelected}/>}
   {current==='p3'&&data&&<><div className="card"><h3>Tabela e validação do cálculo anual</h3><AnnualTable rows={data.annual.records}/></div>
    <details className="card calculation"><summary>Fórmula anual e versão</summary><p>100 × [1 − (matrículas atuais − ingressantes atuais) / (matrículas anteriores − concluintes anteriores)].</p><p>{data.annual.metadata.release_id}</p></details></>}
  </>:<p className="empty">Produto gráfico indisponível para a versão consultada.</p>}
 </section></div>;
}
