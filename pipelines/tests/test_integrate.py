import pandas as pd
import pytest

from pipelines.integrate import link_population_census


def sources():
    census = pd.DataFrame({
        "CO_UF": ["51"] * 4, "NU_ANO_CENSO": [2022, 2022, 2021, 2022],
        "CO_CURSO": ["10", "20", "30", "10"],
        "TP_DIMENSAO": ["1", "1", "1", "2"],
        "TP_MODALIDADE_ENSINO": ["1", "1", "1", "2"],
        "QT_MAT": [50, 20, 999, 999], "QT_VG_TOTAL": [30, 10, 999, 0],
    })
    population = pd.DataFrame({
        "PAIS_REGIOES_ESTADOS": ["Mato Grosso"],
        "QT_POP_18_19": [100], "QT_POP_20_24": [300], "QT_POP_18_24": [400],
    })
    return census, population


def test_state_population_is_joined_once_and_same_year():
    census, population = sources()
    result = link_population_census(census, population, 2022)
    assert len(result) == 1
    assert result.loc[0, "QT_POP_18_24"] == 400
    assert result.loc[0, "QT_VG_PRESENCIAL"] == 40
    assert result.loc[0, "QT_MAT_PRESENCIAL"] == 70


def test_reject_wrong_year_or_duplicate_population():
    census, population = sources()
    with pytest.raises(ValueError, match="2022"):
        link_population_census(census, population, 2024)
    with pytest.raises(ValueError, match="exatamente uma"):
        link_population_census(census, pd.concat([population, population]), 2022)


def test_reject_duplicated_course_and_missing_measure():
    census, population = sources()
    with pytest.raises(ValueError, match="Curso repetido"):
        link_population_census(pd.concat([census, census.iloc[:1]]), population, 2022)
    census.loc[0, "QT_VG_TOTAL"] = float("nan")
    with pytest.raises(ValueError, match="Medidas ausentes"):
        link_population_census(census, population, 2022)
