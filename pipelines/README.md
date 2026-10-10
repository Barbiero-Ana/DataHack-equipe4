# Preparação e qualidade das bases

Os códigos Python utilizados estão neste diretório e devem ser versionados. A API continua em `backend/`; pandas e Seaborn são dependências da preparação.

Da raiz do projeto, com Python 3.12 ou superior:

```sh
python3 -m venv pipelines/.venv
pipelines/.venv/bin/python -m pip install -r pipelines/requirements.txt
pipelines/.venv/bin/python -m pipelines.run
```

Neste ambiente já instalado: `backend/.venv/bin/python -m pipelines.run`.

Entrada padrão: `dados/`. Alternativa: `--input /caminho/absoluto/dadosm`. Saída padrão: `outputs/quality/`. Os arquivos são lidos integralmente; staging guarda os indicadores de MT e as IES nacionais para os cruzamentos. A execução não escreve no PostgreSQL.

| Código | Responsabilidade |
| --- | --- |
| `extract.py` | Leitura em lotes, cabeçalhos, rodapés, metadados e hashes |
| `transform.py` | Tipos, nomes, enums, limpeza de texto, filtro MT e população 18–24 |
| `validate.py` | Chaves, duplicatas, ausências, valores inválidos e conflitos |
| `integrate.py` | População + Censo 2022, por UF/ano, após agregação da oferta |
| `review.py` | Reconciliação temporal, cobertura e gráfico Seaborn |
| `annual.py` | Pergunta 3: estimativa anual e volume de desvinculações por rede/modalidade |
| `run.py` | Execução e gravação das evidências |
| `catalog.py` | Inventário leve para versionar a execução |
| `tests/test_quality.py` | Casos que poderiam produzir resultados incorretos |

Saídas locais:

- `manifest.json`: hashes antes/depois, contagens Brasil/MT, aliases, rodapés, metadados e erros com amostras de até 20 linhas por arquivo.
- `staging/<base>/*.parquet`: dados padronizados, com arquivo/linha de origem e flags de revisão.
- `quarantine/*.parquet`: linhas retidas no recorte com problemas técnicos. Erros fora de MT aparecem no manifest e permanecem nos originais.
- `trajectory_diagnostics_MT.parquet`: cálculos para conferir as taxas oficiais.
- `population_census_2022_MT.parquet`: vínculo estadual MT entre população de 2022 e oferta presencial do mesmo ano. Não distribui população por município.
- `diagnostics.json`, `report.md`, `missingness.png`: diagnóstico e visualização das ausências.
- `p3_annual_MT.parquet`, `p3_annual_audit.json`: resultados e auditoria da pergunta 3; ano sem base anterior permanece ausente com motivo.

Staging não significa aprovação metodológica. Ausência de erro técnico não resolve dimensões, categoria especial, janela temporal ou definição de evasão. Não impute zero nem elimine duplicatas silenciosamente. Consulte `docs/data_quality.md` e `docs/questions.md`.

Após concluir uma execução, gere a evidência leve para Git:

```sh
pipelines/.venv/bin/python -m pipelines.catalog
```

Valide o código com as ferramentas de desenvolvimento já instaladas:

```sh
backend/.venv/bin/ruff check pipelines --config pipelines/pyproject.toml
backend/.venv/bin/python -m pytest pipelines/tests -q
```

Uma execução sobrescreve as saídas dos arquivos presentes. Arquivos antigos removidos da entrada podem continuar na saída: consulte somente os caminhos do manifest atual. Dependências diretas são fixadas em requirements; Python e pandas aparecem no manifest.

Para recalcular somente a pergunta 3 usando o manifest e staging atuais, sem reler os originais:

```sh
backend/.venv/bin/python -m pipelines.annual
```

A execução completa de `pipelines.run` também gera essas saídas. Para incluir o Censo 2020, adicionar o arquivo de cursos em `dados/` e refazer a preparação/validação; não preencher manualmente a estimativa de 2021.

## PostgreSQL e validação pelo terminal

O carregador `python -m pipelines.load` persiste uma versão candidata nas quatro camadas,
lê novamente os originais para raw e confere a correspondência com os Parquet limpos.
`python -m pipelines.query` consulta e valida a versão ativa em modo somente leitura.
Execute com `backend/.venv/bin/python` na raiz e com ambas as listas de dependências instaladas.

Consulte [o roteiro de terminal](../docs/validacao_terminal.md) para migrations, carga,
filtros por ano/rede/modalidade/curso/município, auditoria e testes de rollback.
O staging inicial é técnico e versionado; os modelos finais por família dependem dos dicionários.
