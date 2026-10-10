export const pages = [
  {id: 'ans', label: 'Respostas', title: 'Respostas às perguntas'},
  {id: 'p1', label: 'P1 · Trajetória', title: 'Trajetória acadêmica'},
  {id: 'p2', label: 'P2 · Cursos e áreas', title: 'Cursos e áreas do conhecimento'},
  {id: 'p3', label: 'P3 · Rede e modalidade', title: 'Comparativo por rede e modalidade'},
  {id: 'p4', label: 'P4 · Qualidade', title: 'Qualidade e permanência'},
  {id: 'p5', label: 'P5 · Licenciaturas', title: 'O funil das licenciaturas'},
  {id: 'b1', label: 'B1 · Mapa de oferta', title: 'Distribuição geográfica da oferta'},
  {id: 'b2', label: 'B2 · Financiamento', title: 'Financiamento estudantil e permanência'},
  {id: 'br', label: 'Brasil', title: 'Panorama nacional'},
] as const;
export type PageId = typeof pages[number]['id'];
export type Mode = 'api' | 'demo';
export interface DemoFilters {rede: string; grau: string; area: string; local: string}
export const defaultDemoFilters: DemoFilters = {rede: 'todas', grau: 'todos', area: 'todas', local: 'todos'};
