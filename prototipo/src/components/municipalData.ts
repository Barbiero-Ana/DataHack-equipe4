import type {MunicipalRow,MunicipalPopulation} from '../api/dashboard';
export interface MunicipalMeasure {municipality:string;name:string;vacancies:number|null;matriculated:number|null;population:number|null;per100:number|null}
export function municipalMeasures(rows:MunicipalRow[], population:MunicipalPopulation[]):MunicipalMeasure[]{
 const result=new Map<string,MunicipalMeasure>();
 for(const r of population){
  if(result.has(r.municipality))throw new Error('População municipal duplicada.');
  result.set(r.municipality,{municipality:r.municipality,name:r.name,population:r.population,vacancies:null,matriculated:null,per100:null});
 }
 for(const r of rows){
  const value=result.get(r.municipality)||{municipality:r.municipality,name:r.name,population:null,vacancies:null,matriculated:null,per100:null};
  value.vacancies=(value.vacancies??0)+r.vacancies;
  value.matriculated=(value.matriculated??0)+r.matriculated;
  result.set(r.municipality,value);
 }
 for(const r of result.values())r.per100=r.vacancies!==null&&r.population!==null&&r.population>0?100*r.vacancies/r.population:null;
 return [...result.values()];
}
