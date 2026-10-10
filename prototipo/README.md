# Frontend — Rota do Diploma

Frontend oficial em `prototipo/`, com React + Vite + TypeScript e identidade visual do protótipo original. O seletor no topo alterna entre **Dados da API** (consulta o backend) e **Dados fixos** (valores reais e estáticos, calculados das bases oficiais e embutidos no site). Não há mais dados simulados. `?dados=fixos` na URL abre direto no modo fixo.

## Executar

```sh
cd prototipo
npm ci
npm run dev
```

Node 24 LTS; abra http://127.0.0.1:5173/. Execute a API na porta 8000 em outro terminal. O proxy local encaminha `/api` ao backend. `npm run build` verifica TypeScript e gera `dist/`.

## Gráficos reais

| Pergunta | Gráficos |
| --- | --- |
| P1 | Trajetória acumulada, desistências anuais, situação final, ingressantes por rede |
| P2 | Treemap por curso/área, taxa ponderada por área, ranking por curso |
| P3 | Matrículas e estimativa anual, tabela com componentes da fórmula |
| P4 | CPC × desistência, faixas CPC e associações Spearman dos componentes |
| P5 | Situação das licenciaturas, proficiência dos avaliados, associação e ranking por curso |
| B1 | Mapa de vagas reais por município, ranking de oferta e população estadual por faixa etária |
| B2 | Contagens e participação FIES/ProUni, associação por curso e faixas de participação FIES |

Em **Respostas**, cada cartão seleciona a síntese e os mesmos gráficos reais da pergunta. As taxas usam os numeradores e denominadores agregados. Enade 2025 e trajetória 2015 são populações diferentes: não há funil que multiplique suas taxas. FIES/ProUni permanecem separados, sem somar possíveis beneficiários sobrepostos.

A coorte publicada é 2015, presencial, observada até 2024. Produtos de curso excluem coortes menores que 10; CPC/Enade também exigem pelo menos 10 participantes. Exclusões e cobertura estão disponíveis na tela e na auditoria. A estimativa de evasão de 2021 permanece ausente sem Censo 2020.

B1 mostra vagas reais municipais de 2022; cinza representa ausência de registro no recorte. A população disponível é estadual: não há mapa de vagas por 100 jovens nem contagem de desertos municipais. A aba Contexto MT informa que não existem totais nacionais na versão carregada.

## Organização

- `src/App.tsx`: navegação e filtros reais.
- `src/api/`: contratos e cliente REST.
- `src/hooks/`: requisições canceláveis e conferência de versão.
- `src/components/ApiPages.tsx`: páginas conectadas à API.
- `src/components/QuestionsReal.tsx`: respostas e cálculos de apresentação.
- `src/components/RealCharts.tsx`: gráficos React/SVG e adaptação dos mapas/treemap originais.
- `src/visualization/`: primitivas SVG e geometria preservadas do protótipo, usadas com dados reais.
- `src/demo/` e `DemoPages.tsx`: modo **Dados fixos**. `fixed-data.json` é gerado por `scripts/build_fixed_data.py`; `fixed.js` faz os cálculos com filtros; `renderer.js` monta as dez páginas; `fixedCharts.js` tem as variantes de gráfico desse modo. Carregado sob demanda (chunk separado).
- `src/styles.css` e `public/`: CSS, marca e imagens originais.

Os dados vêm de `/api/v1/analytics/dashboard`, `/annual` e `/population`. O produto dashboard é calculado por pandas em `pipelines/dashboard.py` e persistido em `analytics.dashboard_mt`. Não há dados oficiais embutidos no código JavaScript.

## Publicar e validar

[Deploy Vercel/Railway](../docs/deploy.md), usando Railpack no backend, sem Docker. Na Vercel, `VITE_API_BASE_URL` recebe somente a URL pública da API com `/api/v1`; nunca credenciais PostgreSQL. Não existem rewrites para navegação por hash. Dados, builds, `.env` e `node_modules` ficam fora do Git.

```sh
# Na raiz do repositório, com API local e banco configurados:
backend/.venv/bin/python -m pipelines.check_dashboard
```

Cópia do protótipo original em `outputs/migration/prototipo_original/`, ignorada pelo Git. Registro dos gráficos, cobertura e validação em [graficos_reais.md](../docs/graficos_reais.md).

## Dados fixos

Valores reais, sem API. Para regenerar a partir de `/dados` (na raiz, com pandas e openpyxl):

```sh
backend/.venv/bin/python prototipo/scripts/build_fixed_data.py
```

O script lê a trajetória (coorte 2015, Brasil), o Censo 2021–2024 de MT, CPC 2021–2023, Enade 2025 e `Idades_tratadas.xlsx`, e grava `src/demo/fixed-data.json` com hashes das fontes e auditoria. A população municipal de 18–24 anos vem do IBGE (Censo 2022, tabela SIDRA 9514), salva em `scripts/fontes/`; o script interrompe se a soma dos municípios não conferir com o total estadual do arquivo de idades. Fórmulas: [formulas_indicadores.md](../docs/formulas_indicadores.md). Cache de leitura em `outputs/fixed_data_cache/` (fora do Git).
