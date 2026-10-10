# Validação do frontend e da API

Atualizado em 10/10/2026. Frontend oficial em `prototipo/`. A página Respostas apresenta as sete perguntas e seus gráficos reais.

| Verificação | Resultado |
| --- | --- |
| TypeScript e build Vite | Passaram |
| Backend e pipelines | 72 testes passaram; quatro opcionais PostgreSQL ignorados |
| Dashboard pandas × PostgreSQL | Sete conjuntos idênticos |
| Dashboard HTTP × cálculos | Seis combinações de filtros passaram |
| Filtros inválidos | Quatro casos retornaram 422 |
| API anual e população × SQL | 45 combinações passaram na validação anterior |
| Respostas no navegador | Sete perguntas abertas; 22 gráficos renderizados |
| JavaScript | Nenhum erro observado na conferência |

Comandos, cobertura e limites: [graficos_reais.md](graficos_reais.md). Relatório: `outputs/dashboard/validation.json`. Publicação: [deploy.md](deploy.md).

Backend Python/Railpack, sem Docker. Nenhum deploy remoto novo nesta etapa. Protótipo original preservado na cópia local ignorada pelo Git `outputs/migration/prototipo_original/`.
