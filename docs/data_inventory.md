# Inventário da execução de qualidade

Evidência gerada por `python -m pipelines.catalog`; dados originais fora do Git.
Python 3.13.7; pandas 2.3.3; regras 1.0.0; recorte MT, com IES nacionais para cruzamento.

| Arquivo | MiB | Estado | Linhas Brasil | Linhas MT | Erros técnicos |
| --- | ---: | --- | ---: | ---: | ---: |
| CPC_2021.xlsx | 2.02 | processed | 7997 | 155 | 0 |
| CPC_2023.xlsx | 2.94 | processed | 9812 | 238 | 0 |
| Idades_tratadas.xlsx | 0.01 | processed | 33 | 1 | 0 |
| MICRODADOS_CADASTRO_CURSOS_2021.CSV | 245.95 | processed | 444786 | 12278 | 0 |
| MICRODADOS_CADASTRO_CURSOS_2022.CSV | 316.77 | processed | 573019 | 15059 | 0 |
| MICRODADOS_CADASTRO_CURSOS_2023.CSV | 374.53 | processed | 671610 | 17022 | 0 |
| MICRODADOS_CADASTRO_CURSOS_2024.CSV | 431.87 | processed | 720349 | 18315 | 0 |
| MICRODADOS_CADASTRO_IES_2021.CSV | 1.03 | processed | 2574 | 69 | 0 |
| MICRODADOS_ED_SUP_IES_2022.CSV | 0.95 | processed | 2595 | 72 | 0 |
| MICRODADOS_ED_SUP_IES_2023.CSV | 0.96 | processed | 2580 | 72 | 0 |
| MICRODADOS_ED_SUP_IES_2024.CSV | 0.95 | processed | 2561 | 74 | 0 |
| conceito_enade_licenciaturas.xlsx | 0.52 | processed | 4948 | 97 | 0 |
| cpc_2022.xlsx | 2.91 | processed | 9891 | 165 | 1 |
| indicadores_trajetoria_educacao_superior_2015_2024.ods | 36.54 | alternative_format_not_loaded | — | — | 0 |
| indicadores_trajetoria_educacao_superior_2015_2024.xlsx | 40.82 | processed | 281430 | 5150 | 0 |

Erros são células/regras, não necessariamente pessoas ou linhas distintas.
Leitura integral dos arquivos tabulares selecionados; ODS alternativo não carregado.
Não foram eliminadas duplicatas ou imputados valores. Hashes são conferidos antes e depois.

## Diagnóstico do recorte

```json
{
  "network_rows_in_staging": {
    "cpc": {
      "publica": 211,
      "privada": 347,
      "pending": 0,
      "conflicts": 0
    },
    "censo_cursos": {
      "publica": 1917,
      "privada": 60757,
      "pending": 0,
      "conflicts": 0
    },
    "censo_ies": {
      "publica": 1209,
      "privada": 9052,
      "pending": 49,
      "conflicts": 0
    },
    "enade": {
      "publica": 79,
      "privada": 18,
      "pending": 0,
      "conflicts": 0
    },
    "trajetoria": {
      "publica": 1980,
      "privada": 3170,
      "pending": 0,
      "conflicts": 0
    }
  },
  "trajectory_MT": {
    "cohorts": [
      2015
    ],
    "reference_years": [
      2015,
      2016,
      2017,
      2018,
      2019,
      2020,
      2021,
      2022,
      2023,
      2024
    ],
    "cohort_ingress_count_changes": 0,
    "nonpositive_adjusted_denominator": 0,
    "missing_observation_years": 0,
    "tda_decreasing": 0,
    "tca_decreasing": 0,
    "rows_after_maximum_followup_year": 877,
    "TAP_count_formula_mismatch": 0,
    "TCA_count_formula_mismatch": 0,
    "TDA_count_formula_mismatch": 0,
    "TCAN_count_formula_mismatch": 0,
    "TADA_count_formula_mismatch": 0,
    "cohort2015_presential_rows_2024": 515
  },
  "trajectory_to_cpc_MT": {
    "left_distinct_keys": 515,
    "matched": 398,
    "coverage_pct": 77.28,
    "right_duplicate_rows": 0,
    "left_rows_with_null_key": 0,
    "right_rows_with_null_key": 0,
    "note": "Cobertura por código, sem validar alinhamento temporal ou causalidade."
  },
  "trajectory_to_enade_MT": {
    "left_distinct_keys": 515,
    "matched": 68,
    "coverage_pct": 13.2,
    "right_duplicate_rows": 0,
    "left_rows_with_null_key": 0,
    "right_rows_with_null_key": 0,
    "note": "Cobertura por código, sem validar alinhamento temporal ou causalidade."
  },
  "licenciatura_trajectory_to_enade_MT": {
    "left_distinct_keys": 99,
    "matched": 68,
    "coverage_pct": 68.69,
    "right_duplicate_rows": 0,
    "left_rows_with_null_key": 0,
    "right_rows_with_null_key": 0,
    "note": "Cobertura por código, sem validar alinhamento temporal ou causalidade."
  },
  "census_to_ies": {
    "left_distinct_keys": 660,
    "matched": 660,
    "coverage_pct": 100.0,
    "right_duplicate_rows": 0,
    "left_rows_with_null_key": 0,
    "right_rows_with_null_key": 0,
    "note": "Cobertura por código, sem validar alinhamento temporal ou causalidade."
  },
  "MT_course_rows_with_IES_headquarters_outside_MT": 57947,
  "population": {
    "rows_MT": 1,
    "municipality_code_present": false,
    "B1_status": "blocked_missing_municipal_population",
    "reference_year_from_workbook_metadata": 2022,
    "population_MT_18_24": 397671,
    "census_2022_state_link": {
      "status": "validated_state_level",
      "keys": [
        "CO_UF",
        "NU_ANO_CENSO"
      ],
      "cardinality": "one_to_one_after_aggregation",
      "result": [
        {
          "CO_UF": "51",
          "NU_ANO_CENSO": 2022,
          "QT_CURSOS_PRESENCIAIS": 785,
          "QT_MAT_PRESENCIAL": 95355,
          "QT_VG_PRESENCIAL": 84508,
          "QT_POP_18_19": 108126,
          "QT_POP_20_24": 289545,
          "QT_POP_18_24": 397671
        }
      ],
      "municipal_B1": "pending_municipal_population_not_supplied_by_education_census"
    }
  }
}
```

## Alterações de esquema do Censo

- MICRODADOS_CADASTRO_CURSOS_2021.CSV: 200 colunas de origem normalizadas.
- MICRODADOS_CADASTRO_CURSOS_2022.CSV: 200 colunas de origem normalizadas.
  Acrescentadas: nenhuma.
  Removidas: nenhuma.
- MICRODADOS_CADASTRO_CURSOS_2023.CSV: 202 colunas de origem normalizadas.
  Acrescentadas: IN_COMUNITARIA, IN_CONFESSIONAL.
  Removidas: nenhuma.
- MICRODADOS_CADASTRO_CURSOS_2024.CSV: 223 colunas de origem normalizadas.
  Acrescentadas: QT_CONC_RVIDOSO, QT_CONC_RVINTERN, QT_CONC_RVMEDAL, QT_CONC_RVPOVT, QT_CONC_RVPPI, QT_CONC_RVQUILO, QT_CONC_RVREFU, QT_CONC_RVTRANS, QT_ING_RVIDOSO, QT_ING_RVINTERN, QT_ING_RVMEDAL, QT_ING_RVPOVT, QT_ING_RVPPI, QT_ING_RVQUILO, QT_ING_RVREFU, QT_ING_RVTRANS, QT_MAT_RVIDOSO, QT_MAT_RVINTERN, QT_MAT_RVMEDAL, QT_MAT_RVPOVT, QT_MAT_RVPPI, QT_MAT_RVQUILO, QT_MAT_RVREFU, QT_MAT_RVTRANS.
  Removidas: QT_CONC_RVETNICO, QT_ING_RVETNICO, QT_MAT_RVETNICO.

## Problemas e classificação

- cpc_2022.xlsx: `{"parse:PROPORCAO_DE_CONCLUINTES_PARTICIPANTES_COM_NOTA_NO_ENEM": 1}`.
  Linha 250, curso 1517: `{"_ORIGINAL_PROPORCAO_DE_CONCLUINTES_PARTICIPANTES_COM_NOTA_NO_ENEM": "#NÚM!"}`.

Rede padronizada: 1 pública / 2 privada. Categoria administrativa 2 é pública
estadual. Categoria especial sem rede fica pendente, conforme docs/data_quality.md.

## SHA-256 dos originais

| Arquivo | SHA-256 |
| --- | --- |
| CPC_2021.xlsx | `430a174e959968a8716c1af8076936b8088821e22cc9880fd9b532b2a90654b2` |
| CPC_2023.xlsx | `5bf616a7dd56445796f606c080c0462488418274db2828604b8bc39eedd71c3f` |
| Idades_tratadas.xlsx | `889f08ef1d902570593c96f12b318a2ef9ee752c22dd0310f587bc70456a5503` |
| MICRODADOS_CADASTRO_CURSOS_2021.CSV | `810843b4bbaadae6e8bfee83dfcba949ebb898a297ff3385a25506dd81b3734d` |
| MICRODADOS_CADASTRO_CURSOS_2022.CSV | `20735eea06b896394977d9c8a05b88925dde6ffa385d3b444d2ab25a6c090565` |
| MICRODADOS_CADASTRO_CURSOS_2023.CSV | `0cafa1b464e8ff61023c8202e931289888ed4b8adf158ac90e28fa5eb29293fe` |
| MICRODADOS_CADASTRO_CURSOS_2024.CSV | `e5033b7713560f199648ab18fd62b7afbf4a68d90bd70d79cc946906f0c0d228` |
| MICRODADOS_CADASTRO_IES_2021.CSV | `03d0761ab848e651c69ce8d67b7a39d4998e0b00194d03a48ff68f44f5ff11a1` |
| MICRODADOS_ED_SUP_IES_2022.CSV | `27c44cb460d02a11ea5e4aafbeaa4257d216a2adf42e3ce2945b1073659cba3b` |
| MICRODADOS_ED_SUP_IES_2023.CSV | `1864760932e78dd8113b12b62ec328252a6f83de6f6fd73dca3e671cd18e0131` |
| MICRODADOS_ED_SUP_IES_2024.CSV | `aaa37fb9433d005686616bb9e48c5d7083526fdcc171973e787eed35a2ee349d` |
| conceito_enade_licenciaturas.xlsx | `12e73c0603d388711f914dae9d8e3ea15b46aa56fde2a11b4634baa9e8417911` |
| cpc_2022.xlsx | `1243a2b8d132165a0fdd758d5d02e84815251dc667ccbcf796bb3c4d6657d8eb` |
| indicadores_trajetoria_educacao_superior_2015_2024.ods | `83260915a5be3da0af84c9614afa24ead20f68ace359ac2210eb5f0c95995756` |
| indicadores_trajetoria_educacao_superior_2015_2024.xlsx | `831fa6adeac46f8610a8715b4df1493784e1b21b5ca2f77eb837ac9f59d573d9` |
