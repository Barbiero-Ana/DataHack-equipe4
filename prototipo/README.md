# Frontend — protótipo Rota do Diploma

Frontend oficial em `prototipo/`, adaptado a React + Vite + TypeScript. A identidade visual, os assets, as dez páginas, os mapas e os gráficos do protótipo existente foram preservados. Não há um segundo frontend.

## Executar

Use Node 24 LTS ou versão compatível com o campo `engines` do package.json:

```sh
cd prototipo
npm ci
npm run dev
```

Acesse http://127.0.0.1:5173/. Execute a API em http://127.0.0.1:8000/ em outro terminal. O proxy de desenvolvimento envia `/api` para a API, evitando configuração CORS local. `npm run build` verifica TypeScript e gera `dist/`. `npm run preview` serve o build; para testar dados nesse modo, use `VITE_API_BASE_URL` absoluto e configure CORS na API, pois o proxy é somente de desenvolvimento.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Navegação, modo de dados e filtros React |
| `src/pages.ts` | Ordem e identificação das dez páginas |
| `src/api/` | Cliente REST e contratos TypeScript |
| `src/hooks/useAnalytics.ts` | Carregamento, cancelamento e conferência da versão dos dados |
| `src/components/ApiPages.tsx` | Apresentação dos indicadores do banco |
| `src/components/SeriesChart.tsx` | Gráficos React/SVG dos indicadores reais |
| `src/components/AnnualTable.tsx` | Tabela com componentes da fórmula |
| `src/components/DemoPages.tsx` | Integração isolada com os gráficos existentes |
| `src/demo/` | Dados simulados, geometria e renderizadores originais em ES modules |
| `src/styles.css` | CSS original e ajustes de integração/responsividade |
| `public/` | Logos e ícone originais |

A migração é incremental: o shell, os controles e as telas que recebem API estão em React/TypeScript; os renderizadores demonstrativos permanecem em JavaScript modularizado. `allowJs` permite o reuso; `checkJs` está desativado apenas para essa compatibilidade. O TypeScript permanece estrito para os módulos `.ts`/`.tsx`. Não se trata de uma conversão completa dos renderizadores antigos para componentes React. A ilha de demonstração escreve somente nas seções que controla, monta/desmonta com React e não injeta respostas da API em templates HTML.

## Dados e filtros

O modo inicial **Dados da API** consulta a versão ativa no banco. A P3 permite ano, rede (1 pública, 2 privada) e modalidade (1 presencial, 2 EAD). A tabela apresenta matrículas, desvinculações, estimativa anual, disponibilidade e os componentes para conferir a fórmula. A estimativa de 2021 fica indisponível quando falta Censo 2020; nunca vira zero. As linhas dos gráficos não atravessam anos ausentes.

A B1 mostra o cruzamento Censo/população de 2022 **somente na UF 51**, todas as redes e modalidade presencial. Ela não recebe os filtros da P3. A população estadual não é distribuída artificialmente por município. As demais perguntas mostram a situação dos produtos analíticos, sem apresentar simulações como conclusões oficiais.

**Demonstração** mantém o visual e as interações das dez telas originais, com uma faixa permanente indicando valores simulados e fontes identificadas como simulação. Os filtros Grau, Área e Polo atuam apenas na demonstração enquanto os produtos analíticos correspondentes não estiverem publicados. As conclusões desse modo servem para revisar o protótipo; não são resultados das bases.

Requisições antigas são canceladas ao mudar filtros; os resultados do filtro anterior são removidos enquanto a nova consulta carrega. Catálogo, indicadores anuais e população devem ter a mesma `release_id`; se a versão mudar entre chamadas, a tela pede nova consulta. Erros de conexão têm mensagem e botão para tentar novamente; nenhuma simulação substitui silenciosamente uma falha.

## Publicar

Veja [deploy Vercel + Railway](../docs/deploy.md). `VITE_API_BASE_URL` é pública e recebe apenas o endereço HTTP da API, por exemplo `https://DOMINIO-DA-API/api/v1`. Nunca coloque credenciais ou DATABASE_URL em variáveis VITE. `.env.example` contém a configuração local. `dist/`, `node_modules/` e `.env` ficam fora do Git.

Uma cópia do protótipo anterior à migração foi preservada localmente em `outputs/migration/prototipo_original/`, fora do Git.
