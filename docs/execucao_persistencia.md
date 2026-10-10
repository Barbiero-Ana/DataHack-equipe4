# Execução da persistência — 10/10/2026

## Implementação

Migration `0002_ingestion`, carga `pipelines/load.py`, consulta `pipelines/query.py` e SQL
em `sql/`. A publicação candidata passa por validação antes de trocar o ponteiro ativo.
Não há carga automática no startup do backend.

## Testes locais concluídos

PostgreSQL local 14.20, em instância isolada e bancos `test_*`:

- Backend: 29 testes passaram, incluindo migrations reaplicadas com preservação da sentinela,
  readiness e timeout.
- Pipeline: 24 testes passaram, incluindo idempotência, filtros, bloqueio de alteração no
  Parquet, rollback e nova tentativa após falha.
- Ruff: backend e pipeline sem erros.
- Carga real: 14 arquivos, 78.790 registros raw, seis famílias em staging.
- Comparação SQL × pandas: componentes e resultados anuais, 45 combinações de filtros,
  população/Censo 2022 e contagens de linhagem passaram.
- Reexecução/novas versões: raw foi reaproveitado; versões anteriores ficaram preservadas.

O backend mantém um aviso de depreciação já existente do HTTPX/Starlette no TestClient;
os testes passaram com as dependências atuais.

## Recorte da versão real

| Família | Registros |
| --- | ---: |
| Cursos do Censo | 62.674 |
| IES nacionais | 10.310 |
| Trajetória MT | 5.150 |
| CPC MT | 558 |
| Enade MT | 97 |
| População MT | 1 |
| **Total** | **78.790** |

Staging retém os payloads normalizados e identificadores/contagens centrais tipados.
Os modelos definitivos por família continuam dependentes dos dicionários.
Raw retém as linhas correspondentes a esse recorte; não foram carregadas todas as linhas
nacionais dos arquivos de cursos, trajetória e avaliações. O arquivo completo continua
como referência física, com URI e SHA-256. O ODS alternativo permanece não carregado.

Nenhum registro retido recebeu flag de erro técnico nesta execução. Há 49 avisos de rede
não resolvida em IES nacionais de categoria especial; não foram imputados como privadas.
A ausência de erros nessas verificações não comprova que todas as regras de negócio estejam fechadas.

## Produtos disponíveis

- `analytics.annual_mt`: 16 linhas (2021–2024 × duas redes × duas modalidades).
- 12 taxas calculadas para 2022–2024; quatro taxas de 2021 ausentes por falta do Censo 2020.
  As desvinculações continuam presentes nas 16 linhas.
- `analytics.population_census_mt`: uma linha estadual de 2022, com população jovem
  397.671, 785 cursos presenciais, 95.355 matrículas e 84.508 vagas.

Exemplo: privada/presencial, 2024 → 12.949 desvinculações; estimativa anual
29,140024783147457%; numerador 28.592 e denominador 40.350.
Os produtos são diagnósticos: confirmar os dicionários, a seleção de dimensões e os totais
antes de apresentar os resultados como indicadores definitivos.

## Railway

Inspeção anterior à carga: PostgreSQL 18.6, sem tabelas nem revisão Alembic aplicada.
As migrations foram aplicadas e a inspeção confirmou `0002_ingestion` e as quatro camadas.
Carga concluída e validada. Versão ativa: `a1e9a162-edb5-4d75-91ff-c6d07f7a96ac`.

| Objeto | Contagem |
| --- | ---: |
| Arquivos registrados | 14 |
| Tentativas/versões concluídas | 1 |
| Raw | 78.790 |
| Staging | 78.790 |
| Resultados anuais | 16 |
| População/Censo | 1 |
| Avisos de rede | 49 |
| Tentativas com falha | 0 |

A validação independente `pipelines.query validate` passou novamente no Railway.
A reexecução retornou `already_loaded` para a mesma versão, sem duplicar a carga.
Foram conferidos também os filtros reais de staging contra pandas:

| Filtro | SQL | pandas |
| --- | ---: | ---: |
| Censo 2024, privada/presencial, município 5103403 | 129 | 129 |
| Trajetória 2024, pública/presencial | 198 | 198 |
| CPC 2023, privada/EAD | 3 | 3 |
| Enade 2025, privada/EAD | 5 | 5 |
| Censo, curso 1210438, todas as edições/dimensões retidas | 49 | 49 |

`pipelines/check_filters.py` permite reproduzir essas cinco comparações. A contagem por curso
acima inclui anos e dimensões diferentes; não equivale a 49 cursos distintos.
Tabelas e índices das quatro camadas ocupavam 374.980.608 bytes (~357,6 MiB) na medição.
Health checks do backend local conectado ao Railway retornaram 200 para live e ready;
isso não significa que o backend HTTP foi implantado no Railway.

Evidências locais, ignoradas pelo Git: `outputs/database/railway_status.json`,
`railway_validation.log`, `railway_repeat.log`, `railway_record_filters.log`, amostras JSON
dos resultados anuais/população e `relation_sizes.json`. Não contêm credenciais.

## Extensão: API e protótipo

API dos dois produtos analíticos implementada e integrada ao frontend oficial em `prototipo/`.
Respostas versionadas comparáveis à CLI e filtros de ano, rede e modalidade disponíveis.
A migração preserva os gráficos originais em uma ilha JavaScript demonstrativa; navegação
e telas da API estão em React/TypeScript.

Próximo passo: implementar os contratos/resultados das outras perguntas. Para a série anual completa, falta o Censo 2020; para o bônus municipal,
falta população 18–24 por município. Os originais precisam de armazenamento/backup
persistente antes de depender de sua reprodução fora desta máquina.

Comandos e limites de interpretação em [validacao_terminal.md](validacao_terminal.md).
