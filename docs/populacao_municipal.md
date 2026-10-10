# População municipal — B1

A planilha `dados/tabelaMUNICIPIO.xlsx` complementa o Censo da Educação Superior de 2022. O processamento reproduzível está em `pipelines/municipal_population.py`.

Foram identificados 141 municípios de Mato Grosso e conferidos 423 valores (18 anos, 19 anos e 20–24 anos) contra a referência local oficial SIDRA 9514, ano 2022. Os códigos IBGE são recuperados por correspondência única de nome. A soma é 397.671 jovens, igual ao total estadual. Não houve divergência nessa conferência.

## Persistência

- `control.municipal_population_import`: origem, hashes, ano e auditoria da importação.
- `raw.municipal_population`: linhas da planilha, preservadas.
- `staging.municipal_population`: códigos municipais e população validada.
- `analytics.dashboard`: produto publicado com oferta e população em conjuntos separados.

A migration `0004_municipal_population` adiciona as tabelas. A importação atualiza o produto na mesma transação; repetir o mesmo arquivo não duplica suas linhas.

## Fórmula e filtros

Vagas por 100 jovens = 100 × vagas presenciais de 2022 / população municipal de 18–24 anos de 2022. O filtro de rede altera vagas e matrículas, mas não a população. Vagas de todas as idades não representam jovens efetivamente matriculados: o indicador mede oferta relativa.

Os registros de oferta abrangem 42 municípios; os outros 99 têm população, mas ausência de registro de oferta não vira zero. Vaga zero explicitamente registrada é preservada como zero. Divisão por população zero permanece indisponível.

## Reprodução

Na raiz do projeto:

```sh
backend/.venv/bin/python -m pipelines.municipal_population --check-only
backend/.venv/bin/python -m pipelines.municipal_population
backend/.venv/bin/python -m pipelines.check_dashboard
```

O primeiro comando apenas valida; o segundo persiste usando a conexão configurada. CSV e auditoria ficam em `outputs/municipal_population/`, fora do Git. A validação integrada compara os oito conjuntos publicados com pandas e verifica seis combinações de filtros e quatro requisições inválidas.
