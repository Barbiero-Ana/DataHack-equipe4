import pandas as pd
import pytest

from pipelines.annual import annual_indicators


def census():
    return pd.DataFrame({
        "NU_ANO_CENSO": [2021, 2021, 2022, 2022],
        "CO_UF": ["51"] * 4, "CO_MUNICIPIO": ["5103403"] * 4, "CO_IES": ["1"] * 4,
        "CO_CURSO": ["10", "20", "10", "20"],
        "TP_REDE_PADRONIZADA": ["1"] * 4, "TP_MODALIDADE_ENSINO": ["1"] * 4,
        "TP_DIMENSAO": ["1"] * 4,
        "QT_MAT": [100, 200, 80, 150], "QT_ING": [30, 50, 20, 30],
        "QT_CONC": [10, 30, 20, 20], "QT_SIT_DESVINCULADO": [5, 8, 10, 14],
    })


def selected(result, year):
    return result.loc[result.NU_ANO_CENSO.eq(year)
                      & result.TP_REDE_PADRONIZADA.eq("1")
                      & result.TP_MODALIDADE_ENSINO.eq("1")].iloc[0]


def test_ratio_of_totals_and_independent_desvinculacoes():
    result = annual_indicators(census(), years=(2021, 2022))
    row = selected(result, 2022)
    assert row.NUMERADOR_PERMANENCIA == 180
    assert row.DENOMINADOR_PERMANENCIA == 260
    assert row.EVASAO_ESTIMADA_PCT == pytest.approx(100 * (1 - 180/260))
    assert row.QT_SIT_DESVINCULADO == 24
    assert selected(result, 2021).STATUS_ESTIMATIVA == "sem_base_ano_anterior"
    assert pd.isna(selected(result, 2021).EVASAO_ESTIMADA_PCT)


def test_nonconsecutive_year_is_not_previous_year():
    data = census()
    data.loc[data.NU_ANO_CENSO.eq(2022), "NU_ANO_CENSO"] = 2023
    row = selected(annual_indicators(data, years=(2023,)), 2023)
    assert row.STATUS_ESTIMATIVA == "sem_base_ano_anterior"
    assert pd.isna(row.EVASAO_ESTIMADA_PCT)


def test_zero_denominator_and_outlier_not_clipped():
    data = census()
    data.loc[data.NU_ANO_CENSO.eq(2021), "QT_CONC"] = [100, 200]
    row = selected(annual_indicators(data), 2022)
    assert row.STATUS_ESTIMATIVA == "denominador_nao_positivo"
    assert pd.isna(row.EVASAO_ESTIMADA_PCT)
    data = census()
    data.loc[data.NU_ANO_CENSO.eq(2022), "QT_MAT"] = [1000, 1000]
    row = selected(annual_indicators(data), 2022)
    assert row.EVASAO_ESTIMADA_PCT < 0
    assert row.STATUS_ESTIMATIVA == "revisar_estimativa_fora_0_100"


def test_invalid_input_and_duplicate_offer_rejected():
    data = census()
    with pytest.raises(ValueError, match="duplicada"):
        annual_indicators(pd.concat([data, data.iloc[:1]]))
    data.loc[0, "QT_MAT"] = float("nan")
    with pytest.raises(ValueError, match="Medida ausente"):
        annual_indicators(data)


def test_geography_and_dimension_filter_do_not_duplicate_totals():
    data = census()
    extra = data.copy()
    extra["TP_DIMENSAO"] = "3"
    outside = data.copy()
    outside["CO_UF"] = "35"
    row = selected(annual_indicators(pd.concat([data, extra, outside])), 2022)
    assert row.QT_MAT == 230
