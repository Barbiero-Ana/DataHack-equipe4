import {useEffect, useState} from 'react';
import {api} from '../api/client';
import type {AnnualResponse, Catalog, Filters, PopulationResponse} from '../api/types';

export interface AnalyticsData {catalog: Catalog; annual: AnnualResponse; population: PopulationResponse}
export function useAnalytics(filters: Filters, revision: number) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<{data: AnalyticsData | null; loading: boolean; error: string | null}>(
    {data: null, loading: true, error: null});
  useEffect(() => {
    const controller = new AbortController();
    // Nunca apresenta linhas do filtro anterior como se fossem as do filtro atual.
    setState({data: null, loading: true, error: null});
    Promise.all([api.catalog(controller.signal), api.annual(filters, controller.signal),
      api.population(controller.signal)]).then(([catalog, annual, population]) => {
      if (controller.signal.aborted) return;
      if (catalog.metadata.release_id !== annual.metadata.release_id ||
          annual.metadata.release_id !== population.metadata.release_id) {
        throw new Error('A versão dos dados mudou durante a consulta. Recarregue para conferir.');
      }
      setCatalog(catalog);
      setState({data: {catalog, annual, population}, loading: false, error: null});
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({data: null, loading: false,
        error: error instanceof Error ? error.message : 'Falha ao consultar os dados.'});
    });
    return () => controller.abort();
  }, [filters.year, filters.network, filters.modality, revision]);
  return {...state, catalog};
}
