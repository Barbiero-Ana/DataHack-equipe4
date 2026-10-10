"""Integra população e oferta no mesmo ano e nível geográfico."""

import pandas as pd


def link_population_census(
    census: pd.DataFrame, population: pd.DataFrame, population_year: int
) -> pd.DataFrame:
    """Junção estadual MT; a população não é distribuída artificialmente por município."""
    if population_year != 2022:
        raise ValueError("Este contrato exige população de 2022.")
    pop = population.loc[
        population["PAIS_REGIOES_ESTADOS"].str.casefold().eq("mato grosso")
    ].copy()
    if len(pop) != 1:
        raise ValueError("É necessária exatamente uma linha de população de MT.")
    if pop["QT_POP_18_24"].isna().any() or pop["QT_POP_18_24"].le(0).any():
        raise ValueError("População 18–24 ausente ou não positiva.")
    data = census.loc[
        census["NU_ANO_CENSO"].eq(population_year) & census["CO_UF"].eq("51")
        & census["TP_MODALIDADE_ENSINO"].eq("1") & census["TP_DIMENSAO"].eq("1")
    ].copy()
    if data.empty:
        raise ValueError("Nenhum curso presencial de MT em 2022 encontrado.")
    if data.duplicated(["NU_ANO_CENSO", "CO_UF", "CO_CURSO"]).any():
        raise ValueError("Curso repetido: revisar dimensão antes de agregar.")
    if data[["QT_MAT", "QT_VG_TOTAL"]].isna().any().any():
        raise ValueError("Medidas ausentes: não tratar como zero na agregação.")
    if "_REQUIRES_REVIEW" in data and data["_REQUIRES_REVIEW"].any():
        raise ValueError("Existem registros técnicos pendentes no recorte.")
    # Agregar antes de juntar impede repetir o denominador estadual por curso.
    totals = data.groupby(["CO_UF", "NU_ANO_CENSO"], as_index=False).agg(
        QT_CURSOS_PRESENCIAIS=("CO_CURSO", "nunique"),
        QT_MAT_PRESENCIAL=("QT_MAT", "sum"),
        QT_VG_PRESENCIAL=("QT_VG_TOTAL", "sum"),
    )
    pop["CO_UF"] = "51"  # Correspondência explícita do recorte Mato Grosso.
    pop["NU_ANO_CENSO"] = population_year
    result = totals.merge(
        pop[["CO_UF", "NU_ANO_CENSO", "QT_POP_18_19", "QT_POP_20_24", "QT_POP_18_24"]],
        on=["CO_UF", "NU_ANO_CENSO"], how="left", validate="one_to_one", indicator=True,
    )
    if not result["_merge"].eq("both").all():
        raise ValueError("Oferta sem correspondência na população.")
    return result.drop(columns="_merge")
