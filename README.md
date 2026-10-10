# Rota do Diploma

Inteligência educacional para o DataHack UNIVAG 2026, com foco nas graduações em Mato Grosso e futuras fontes oficiais INEP e IBGE.

As **Entregas 1 — Fundação e 2 — Persistência** estão implementadas. As migrations e o carregador das quatro camadas foram implementados e testados em PostgreSQL descartável. Consulte o registro de execução para saber a versão efetivamente carregada. Consulte [o guia do backend](backend/README.md) para instalação e execução.

A arquitetura definida usa FastAPI no Railway, PostgreSQL 18 no Railway, React + Vite + TypeScript na Vercel e pipelines Python + pandas + SQL. A comunicação entre frontend e backend usa REST/JSON. O frontend oficial é o [protótipo existente](prototipo/README.md), adaptado a React/Vite/TypeScript; as páginas e os gráficos de Respostas usam dados reais da API. Veja [a configuração de deploy](docs/deploy.md).

Os códigos de leitura, limpeza, filtro e validação com pandas estão em [pipelines/](pipelines/README.md). Consulte [as regras de qualidade](docs/data_quality.md), [o mapa das perguntas](docs/questions.md) e [o inventário da execução](docs/data_inventory.md). Saídas locais em `outputs/quality/`. As inconsistências estão em [InconsistencciasDados.md](InconsistencciasDados.md); consulte [a validação](docs/validacao_dados.md) e [os contratos das fórmulas](docs/formulas_indicadores.md) para metodologia e próximos passos.

## Arquivos locais e Git

Guarde os originais em `dados/` (entrada padrão da pipeline) ou `data/source/`, e saídas geradas em `outputs/`. Essas pastas, planilhas, CSVs, Parquet, bancos locais, arquivos compactados, ambientes virtuais, caches, logs e `.env` são ignorados pelo Git. Arquivos JSON de dados também devem ficar dentro de `data/`; JSON fora dessa pasta pode ser configuração e não é ignorado globalmente.

Versione código, testes, migrations, documentação, inventários e regras de validação. Os datasets serão adicionados localmente depois, sem entrar no histórico Git. Preserve o `.env` local; somente `.env.example` deve ser compartilhado. O ambiente virtual pode ser recriado a partir dos requirements.

Antes do primeiro commit, confira o que será incluído:

```sh
git status --short
git add .gitignore README.md InconsistencciasDados.md backend/ pipelines/ sql/ docs/ prototipo/
git diff --cached --stat
```

O `git add` respeita o `.gitignore`. Não use `git add -f` para incluir dados ou credenciais.

O plano de persistência nas quatro camadas está em [migracao_banco.md](docs/migracao_banco.md): controle/rastreabilidade, raw, staging, analytics e carga incremental.

A carga e os filtros agora possuem comandos Python no repositório. Veja [validação pelo terminal](docs/validacao_terminal.md) e [registro de execução](docs/execucao_persistencia.md).
