import {useEffect,useState} from 'react';
import {api} from '../api/client';
import type {AnalysisFilters,Dashboard} from '../api/dashboard';
export function useDashboard(filters:AnalysisFilters, revision:number) {
 const [data,setData]=useState<Dashboard|null>(null);
 const [options,setOptions]=useState<Dashboard['options']|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setData(null);setError(null);
  api.dashboard(filters,controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   setData(result);setOptions(result.options);setLoading(false);
  }).catch((e:unknown)=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Falha ao consultar gráficos.');setLoading(false);}});
  return()=>controller.abort();
 },[filters.network,filters.modality,filters.degree,filters.area,filters.municipality,revision]);
 return {data,options,error,loading};
}
