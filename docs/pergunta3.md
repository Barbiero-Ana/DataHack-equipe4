# Contrato escolhido da pergunta 3

Em 10/10/2026, o usuário escolheu **estimativa anual por balanço de matrículas + quantidade de desvinculações** para comparar redes pública/privada e modalidades presencial/EAD em MT, entre 2021–2024.

```text
E[g,t] = 100 * (1 - (M[g,t] - I[g,t]) / (M[g,t-1] - C[g,t-1]))
M = soma QT_MAT
I = soma QT_ING
C = soma QT_CONC
Desvinculações[g,t] = soma QT_SIT_DESVINCULADO[g,t]
```

Código: `pipelines/annual.py`; testes: `pipelines/tests/test_annual.py`. As duas medidas têm naturezas diferentes: desvinculações são contagens, e a estimativa é uma razão baseada nos estoques/fluxos dos anos consecutivos. Não interpretar como TADA de uma coorte ou como abandono definitivo do ensino superior.

Recorte operacional: oferta em MT (`CO_UF = 51`), rede padronizada 1/2, presencial/dimensão 1 e EAD/dimensão 2. Cada grupo é agregado antes da divisão. Uma linha de EAD por município é parte da distribuição espacial da oferta; não acrescentar também linhas nacionais do mesmo curso. Conferir o dicionário e totais oficiais antes de homologar os resultados para publicação.

As saídas guardam matrículas, ingressantes, concluintes, desvinculações, matrículas/concluintes do ano anterior, numerador, denominador, ano anterior, estimativa e motivo de ausência. Os hashes das fontes e versão do contrato ficam na auditoria.

Estado da execução atual:

- Quantidades disponíveis para 2021–2024, nos quatro grupos.
- Estimativas calculadas para 2022–2024: 12 células.
- Estimativas de 2021: quatro células pendentes de 2020, sem preencher com zero.
- Nenhuma estimativa calculada fora da faixa 0–100% nesta execução; isso não substitui a conferência metodológica.

Em 2023, as desvinculações presenciais públicas aumentam de 2.550 para 10.375, caindo para 2.983 em 2024. É uma variação a investigar por IES/curso e pelos componentes do balanço, não uma inconsistência comprovada. Não atribuir uma causa sem essa análise.

Saídas locais, fora do Git:

- `outputs/quality/p3_annual_MT.parquet`
- `outputs/quality/p3_annual_audit.json`
- `outputs/quality/p3_annual.md`

Para reproduzir somente esta etapa, usando o staging existente:

```sh
backend/.venv/bin/python -m pipelines.annual
```

A execução completa de `pipelines.run` também gera essas saídas. Para completar 2021, incorporar o arquivo de cursos do Censo 2020 em `dados/`, verificar o esquema e a classificação, preparar seus dados e recalcular. Não reutilizar 2021 como seu próprio ano anterior.

Método: [Lobo, Cadernos ABMES 25, seção de cálculo da evasão, pp. 29–31](https://abmes.org.br/arquivos/publicacoes/Cadernos25.pdf). Critérios gerais em `formulas_indicadores.md`. `InconsistencciasDados.md` permanece reservado às inconsistências confirmadas.
