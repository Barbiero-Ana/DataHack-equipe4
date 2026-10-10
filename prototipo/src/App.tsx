import {useCallback,useEffect,useRef,useState} from 'react';
import {ApiPages} from './components/ApiPages';
import {Tooltip} from './components/Tooltip';
import {useAnalytics} from './hooks/useAnalytics';
import {useDashboard} from './hooks/useDashboard';
import {defaultAnalysisFilters} from './api/dashboard';
import type {AnalysisFilters} from './api/dashboard';
import type {Code,Filters} from './api/types';
import {pages} from './pages';
import type {PageId} from './pages';
function hashPage():PageId{return pages.find(p=>`#${p.id}`===location.hash)?.id||'ans';}
export default function App(){
 const [current,setCurrent]=useState<PageId>(hashPage);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [filters,setFilters]=useState<Filters>({year:'',network:'',modality:''});
 const [analysisFilters,setAnalysisFilters]=useState<AnalysisFilters>(defaultAnalysisFilters);
 const [revision,setRevision]=useState(0);
 const annual=useAnalytics(filters,revision),dashboard=useDashboard(analysisFilters,revision);
 const tabs=useRef<HTMLDivElement>(null);
 const navigate=useCallback((id:PageId)=>{setCurrent(id);history.replaceState(null,'',`#${id}`);},[]);
 const index=pages.findIndex(p=>p.id===current);
 useEffect(()=>{
  const hash=()=>setCurrent(hashPage());
  const keyboard=(event:KeyboardEvent)=>{
   if(event.target instanceof Element&&event.target.closest('select,input,textarea,[contenteditable="true"]'))return;
   if(event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
    event.preventDefault();navigate(pages[Math.max(0,Math.min(pages.length-1,index+(event.key==='ArrowRight'?1:-1)))].id);
   }
  };
  window.addEventListener('hashchange',hash);document.addEventListener('keydown',keyboard);
  tabs.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({inline:'nearest',block:'nearest'});
  return()=>{window.removeEventListener('hashchange',hash);document.removeEventListener('keydown',keyboard);};
 },[index,navigate]);
 const reset=()=>{setFilters({year:'',network:'',modality:''});setAnalysisFilters({...defaultAnalysisFilters});};
 const setShared=(key:'network'|'modality',value:string)=>{setFilters({...filters,[key]:value as ''|Code});setAnalysisFilters({...analysisFilters,[key]:value});};
 return <><div className="app"><header className="top"><div className="brand"><img src="/image.png" alt="Rota do Diploma"/></div>
  <div className="top-title">Rota do Diploma</div><span className="live-source">Dados reais · INEP/IBGE</span>
  <button type="button" className={`ghost ${filtersOpen?'on':''}`} aria-expanded={filtersOpen} aria-controls="fpane" onClick={()=>setFiltersOpen(!filtersOpen)}><i className="fi fi-rr-filter"/>Filtros</button></header>
  <div className="data-banner api" role="status">Dados reais · INEP/IBGE · Mato Grosso · cálculos e cruzamentos auditáveis na API.</div>
  <div className="body"><ApiPages current={current} data={annual.data} chart={dashboard.data} loading={dashboard.loading||(current==='p3'&&annual.loading)} error={dashboard.error||(current==='p3'?annual.error:null)} retry={()=>setRevision(v=>v+1)}/>
   <aside className={`fpane ${filtersOpen?'open':''}`} id="fpane" aria-label="Filtros" aria-hidden={!filtersOpen} inert={!filtersOpen}>
    <div className="fp-head"><strong>Filtros</strong><span>Aplicados aos gráficos reais</span></div>
    {current==='p3'&&<label>Ano<select value={filters.year} onChange={e=>setFilters({...filters,year:e.target.value})}><option value="">Todos</option>{annual.catalog?.annual_years.map(y=><option value={y} key={y}>{y}</option>)}</select></label>}
    <label>Rede<select value={filters.network} onChange={e=>setShared('network',e.target.value)}><option value="">Todas</option><option value="1">Pública</option><option value="2">Privada</option></select></label>
    <label>Modalidade<select value={filters.modality} onChange={e=>setShared('modality',e.target.value)}><option value="">Todas</option><option value="1">Presencial</option><option value="2">EAD</option></select></label>
    {current!=='p3'&&<><label>Grau<select value={analysisFilters.degree} onChange={e=>setAnalysisFilters({...analysisFilters,degree:e.target.value})}><option value="">Todos</option><option value="1">Bacharelado</option><option value="2">Licenciatura</option><option value="3">Tecnológico</option></select></label>
    <label>Área (CINE)<select value={analysisFilters.area} onChange={e=>setAnalysisFilters({...analysisFilters,area:e.target.value})}><option value="">Todas</option>{dashboard.options?.areas.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
    <label>Município<select value={analysisFilters.municipality} onChange={e=>setAnalysisFilters({...analysisFilters,municipality:e.target.value})}><option value="">Todos</option>{dashboard.options?.municipalities.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label></>}
    <p className="note">Trajetória: coorte 2015 presencial. P3: ano/rede/modalidade. Mapa B1: 2022, presencial, rede/município. Financiamento: rede privada. Ausência de resultado não vira zero.</p>
    <button type="button" onClick={reset}><i className="fi fi-rr-refresh"/>Limpar filtros</button>
   </aside></div>
  <footer className="tabs"><div className="tab-list" ref={tabs} role="tablist" aria-label="Perguntas e análises">{pages.map(page=><button type="button" role="tab" aria-selected={current===page.id} className={`tab ${current===page.id?'on':''}`} key={page.id} onClick={()=>navigate(page.id)}>{page.id==='br'?'Contexto MT':page.label}</button>)}</div>
   <img className="tabs-logo" src="/PandaLogoFull.png" alt="Pandas em Pânico"/>
   <button type="button" className="nav-btn" aria-label="Página anterior" disabled={index===0} onClick={()=>navigate(pages[index-1].id)}>‹</button>
   <button type="button" className="nav-btn" aria-label="Próxima página" disabled={index===pages.length-1} onClick={()=>navigate(pages[index+1].id)}>›</button><span className="count">{index+1} de {pages.length}</span></footer>
 </div><Tooltip key={current}/></>;
}
