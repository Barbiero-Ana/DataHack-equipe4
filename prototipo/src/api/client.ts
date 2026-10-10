import type {AnalysisFilters, Dashboard} from './dashboard';
import type {AnnualResponse, Catalog, Filters, PopulationResponse} from './types';

const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${base}/analytics/${path}`, {signal, cache: 'no-store', headers: {Accept: 'application/json'}});
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail?.message === 'string' ? detail.message :
      `Não foi possível consultar os dados (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  dashboard: (filters: AnalysisFilters, signal: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
    return get<Dashboard>(`dashboard?${params}`,signal);
  },
  catalog: (signal: AbortSignal) => get<Catalog>('catalog', signal),
  annual: (filters: Filters, signal: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return get<AnnualResponse>(`annual?${params}`, signal);
  },
  population: (signal: AbortSignal) => get<PopulationResponse>('population?year=2022', signal),
};
