export type Code = '1' | '2';
export interface Metadata {release_id: string; contract_version: string; created_at: string;
  publication: 'diagnostico'; geographic_level: 'UF'; uf: '51'; pending: string[]}
export interface Filters {year: string; network: '' | Code; modality: '' | Code}
export interface Catalog {metadata: Metadata; annual_years: number[]; population_years: number[];
  networks: Record<Code, string>; modalities: Record<Code, string>}
export type EstimateStatus = 'calculada' | 'sem_base_ano_anterior' | 'sem_base_ano_atual' |
  'denominador_nao_positivo' | 'revisar_estimativa_fora_0_100';
export interface AnnualRecord {year: number; uf: '51'; network: Code; modality: Code;
  qt_mat: number | null; qt_ing: number | null; qt_conc: number | null;
  qt_desvinculado: number | null; qt_registros_oferta: number | null;
  qt_mat_anterior: number | null; qt_conc_anterior: number | null;
  numerador_permanencia: number | null; denominador_permanencia: number | null;
  evasao_estimada_pct: number | null; status_estimativa: EstimateStatus}
export interface AnnualResponse {metadata: Metadata; total: number; records: AnnualRecord[]}
export interface PopulationRecord {year: number; uf: '51'; qt_cursos_presenciais: number;
  qt_mat_presencial: number; qt_vg_presencial: number; qt_pop_18_19: number;
  qt_pop_20_24: number; qt_pop_18_24: number}
export interface PopulationResponse {metadata: Metadata; total: number; records: PopulationRecord[]}
