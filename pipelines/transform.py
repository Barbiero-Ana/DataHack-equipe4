"""Padronização técnica conservadora, sem imputações ou deduplicação automática."""

import pandas as pd

from pipelines.extract import normalize_header

ALIASES = {
    "18_19_ANOS": "QT_POP_18_19",
    "20_24_ANOS": "QT_POP_20_24",
    "ANO": "NU_ANO_REFERENCIA",
    "CODIGO_DA_IES": "CO_IES",
    "CODIGO_DA_IES_1": "CO_IES",
    "CODIGO_DO_CURSO": "CO_CURSO",
    "CODIGO_DO_MUNICIPIO": "CO_MUNICIPIO",
    "SIGLA_DA_UF": "SG_UF",
    "NOME_DA_IES": "NO_IES",
    "NOME_DA_IES1": "NO_IES",
    "NOME_DA_IES_1": "NO_IES",
    "MODALIDADE_DE_ENSINO": "DS_MODALIDADE_ENSINO",
    "CATEGORIA_ADMINISTRATIVA": "DS_CATEGORIA_ADMINISTRATIVA",
    "CATEGORIA_ADMINISTRATIVA_2": "DS_CATEGORIA_ADMINISTRATIVA",
    "GRAU_ACADEMICO": "DS_GRAU_ACADEMICO",
    "CPC_CONTINUO": "CPC_CONTINUO",
    "CPC_FAIXA": "CPC_FAIXA",
    "CONCEITO_ENADE_FAIXA": "ENADE_FAIXA",
    "N_DE_CONCLUINTES_INSCRITOS": "QT_INSCRITOS",
    "NO_DE_CONCLUINTES_INSCRITOS": "QT_INSCRITOS",
    "N_DE_CONCLUINTES_PARTICIPANTES": "QT_PARTICIPANTES",
    "NO_DE_CONCLUINTES_PARTICIPANTES": "QT_PARTICIPANTES",
    "TOTAL_DE_CONCLUINTE_IGUAL_OU_ACIMA_DO_PADRAO_1_DE_PROFICIENCIA": "QT_PROFICIENTE",
    "PERCENTUAL_DE_CONCLUINTES_IGUAL_OU_ACIMA_DO_PADRAO_1_DE_PROFICIENCIA": (
        "PROFICIENCIA_PROPORCAO"
    ),
}
RATES = {"TAP", "TCA", "TDA", "TCAN", "TADA"}
MARKERS = {"SC", "-", "*", "**", "...", ".."}
NETWORK = {"1": "publica", "2": "privada"}
CATEGORY_NETWORK = {"1": "1", "2": "1", "3": "1", "4": "2", "5": "2"}


def classify_network(frame: pd.DataFrame) -> pd.DataFrame:
    """Enum da rede é diferente do enum administrativo; categoria 7 fica pendente."""
    data = frame.copy()
    if not any(c in data for c in ["TP_REDE", "TP_CATEGORIA_ADMINISTRATIVA",
                                  "DS_CATEGORIA_ADMINISTRATIVA"]):
        return data
    inferred = pd.Series(pd.NA, index=data.index, dtype="string")
    if "TP_CATEGORIA_ADMINISTRATIVA" in data:
        inferred = data["TP_CATEGORIA_ADMINISTRATIVA"].map(CATEGORY_NETWORK).astype("string")
    elif "DS_CATEGORIA_ADMINISTRATIVA" in data:
        text = data["DS_CATEGORIA_ADMINISTRATIVA"].astype("string").str.casefold()
        inferred = inferred.mask(text.str.startswith("pública", na=False), "1")
        inferred = inferred.mask(text.str.startswith("privada", na=False), "2")
    if "TP_REDE" in data:
        raw = data["TP_REDE"].astype("string")
        chosen = raw.where(raw.isin(NETWORK))
        data["_NETWORK_CONFLICT"] = (
            inferred.notna() & chosen.notna() & inferred.ne(chosen)
        ).fillna(False)
        data["REDE_ORIGEM"] = "TP_REDE"
    else:
        chosen = inferred
        data["_NETWORK_CONFLICT"] = False
        data["REDE_ORIGEM"] = "categoria_administrativa"
    if any(c in data for c in ["TP_REDE", "TP_CATEGORIA_ADMINISTRATIVA",
                               "DS_CATEGORIA_ADMINISTRATIVA"]):
        data["TP_REDE_PADRONIZADA"] = chosen.astype("string")
        data["DS_REDE"] = chosen.map(NETWORK).astype("string")
        data["REDE_PENDENTE"] = chosen.isna()
    return data


def numeric_column(column: str) -> bool:
    return column.startswith(
        ("QT_", "NU_ANO_", "NU_PRAZO_", "NOTA_", "PROPORCAO_")
    ) or column in RATES | {"CPC_CONTINUO", "PROFICIENCIA_PROPORCAO"}


def clean(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str], dict[str, int]]:
    mapping = {
        str(column): ALIASES.get(normalize_header(column), normalize_header(column))
        for column in frame.columns
    }
    if len(set(mapping.values())) != len(mapping):
        raise ValueError("Colisão de nomes após normalização: revisar os aliases.")
    source = frame.rename(columns=mapping)
    result = {}
    changes = {}
    for column in source:
        before = source[column].astype("string")
        values = (
            before.str.replace(r"[\u200b\ufeff]", "", regex=True).str.strip().replace("", pd.NA)
        )
        changed = before.fillna("<NULL>").ne(values.fillna("<NULL>"))
        changes[column] = int(changed.sum())
        if column.startswith(("CO_", "TP_", "NU_CEP")):
            # Remove somente a parte decimal nula de identificadores vindos do Excel.
            values = values.str.replace(r"^(\d+)\.0$", r"\1", regex=True)
        if column in {"CO_UF", "CO_MUNICIPIO", "CO_UF_IES", "CO_MUNICIPIO_IES"}:
            values = values.mask(values == "0")
        if numeric_column(column):
            markers = values.where(values.isin(MARKERS))
            number = pd.to_numeric(values.str.replace(",", ".", regex=False), errors="coerce")
            invalid = values.notna() & number.isna() & ~values.isin(MARKERS)
            result[f"_INVALID_{column}"] = invalid
            if markers.notna().any() or invalid.any():
                result[f"_ORIGINAL_{column}"] = values.where(markers.notna() | invalid)
            values = number.astype("Float64")
        result[column] = values
    data = pd.DataFrame(result, index=frame.index)
    if {"QT_POP_18_19", "QT_POP_20_24"} <= set(data):
        # A soma propaga ausência: não transforma uma faixa faltante em zero.
        data["QT_POP_18_24"] = data["QT_POP_18_19"] + data["QT_POP_20_24"]
    return classify_network(data), mapping, changes


def mt_mask(frame: pd.DataFrame) -> pd.Series:
    if "CO_UF" in frame:
        return frame["CO_UF"].eq("51").fillna(False)
    if "SG_UF" in frame:
        return frame["SG_UF"].eq("MT").fillna(False)
    # População fornecida está em UF/região, não município.
    if "PAIS_REGIOES_ESTADOS" in frame:
        return frame["PAIS_REGIOES_ESTADOS"].str.casefold().eq("mato grosso").fillna(False)
    if "CO_UF_IES" in frame:
        return frame["CO_UF_IES"].eq("51").fillna(False)
    return pd.Series(False, index=frame.index)
