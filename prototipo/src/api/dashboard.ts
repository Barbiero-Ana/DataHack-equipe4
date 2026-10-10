export interface AnalysisFilters {network: string; modality: string; degree: string; area: string; municipality: string}
export const defaultAnalysisFilters: AnalysisFilters = {network:'',modality:'',degree:'',area:'',municipality:''};
export interface CourseRow {ies:string; course:string; name:string; institution:string; network:string; modality:string;
  degree:string; municipality:string; area:string; area_code:string; year:number; ingress:number; remaining:number;
  denominator:number; annual_dropout:number; annual_concluded:number; deaths:number; concluded:number; dropout:number;
  dropout_pct:number; concluded_pct:number; remaining_pct:number; after_followup:boolean}
export interface QualityRow extends CourseRow {edition:number;participants:number;cpc:number;cpc_band:string;
  components:Record<string,number|null>}
export interface EnadeRow extends CourseRow {edition:number;participants:number;proficient:number;proficiency_pct:number}
export interface FinanceRow {year:number;modality:string;matriculated:number;fies:number;prouni_full:number;prouni_partial:number}
export interface FundingRow extends CourseRow {matriculated:number; fies:number;prouni_full:number;prouni_partial:number;
  fies_pct:number;prouni_full_pct:number;prouni_partial_pct:number}
export interface MunicipalPopulation {municipality:string;name:string;year:number;population:number;population_18:number;population_19:number;population_20_24:number}
export interface MunicipalRow {municipality:string;name:string;network:string;vacancies:number;matriculated:number}
export interface Dashboard {metadata:{release_id:string};chart_contract:string;
  data:{trajectory:CourseRow[];courses:CourseRow[];cpc:QualityRow[];enade:EnadeRow[];finance:FinanceRow[];
    funding_relationship:FundingRow[];municipal:MunicipalRow[];municipal_population?:MunicipalPopulation[]};
  options:{areas:{value:string;label:string}[];municipalities:{value:string;label:string}[]};
  audit:{notes:string[];minimum_cell:number;trajectory:{suppressed_courses_under10:number};
    cpc:{universe_courses:number;matched_courses:number;published_courses:number};
    enade:{universe_courses:number;matched_courses:number;published_courses:number}}
}
