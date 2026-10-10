"""Gera os "Dados fixos" do protótipo a partir das bases oficiais em /dados.

Saída: prototipo/src/demo/fixed-data.json (estático, versionado).
Fórmulas: docs/formulas_indicadores.md. Recorte: Mato Grosso (CO_UF 51), salvo a
página Brasil. Nada aqui é simulado; ausências permanecem nulas.

Uso (a partir da raiz do repositório):
    python prototipo/scripts/build_fixed_data.py
A leitura do Excel da trajetória (281 mil linhas) é feita uma vez e guardada em
outputs/fixed_data_cache/ (ignorado pelo Git); as próximas execuções são rápidas.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DADOS = ROOT / "dados"
CACHE = ROOT / "outputs" / "fixed_data_cache"
FONTES = Path(__file__).resolve().parent / "fontes"
OUT = ROOT / "prototipo" / "src" / "demo" / "fixed-data.json"
UF_MT = 51
MIN_INGRESSANTES = 10   # pipelines/dashboard.py: published = QT_INGRESSANTE >= 10
MIN_PARTICIPANTES = 10  # CPC/Enade: QT_PARTICIPANTES >= 10
ANOS = list(range(2015, 2025))
CENSO_ANOS = [2021, 2022, 2023, 2024]
PUBLICA = {1, 2, 3}          # federal, estadual, municipal
PRIVADA = {4, 5}             # com e sem fins lucrativos; categoria 7 (especial) fica fora
UFS = {11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE",
       24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP",
       41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF"}


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()[:16]


def rede(cat: pd.Series) -> pd.Series:
    c = pd.to_numeric(cat, errors="coerce")
    return np.where(c.isin(PUBLICA), "publica", np.where(c.isin(PRIVADA), "privada", None))


def as_int(s: pd.Series) -> pd.Series:
    """Normaliza enums como 1 e 1.0 (inconsistência 2 do InconsistencciasDados.md)."""
    return pd.to_numeric(s, errors="coerce").astype("Int64")


# ---------------------------------------------------------------- trajetória
def load_trajetoria() -> pd.DataFrame:
    src = DADOS / "indicadores_trajetoria_educacao_superior_2015_2024.xlsx"
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / f"trajetoria_{sha(src)}.parquet"
    if not cache.exists():
        df = pd.read_excel(src, header=8, engine="openpyxl", dtype={"CO_CINE_ROTULO": str, "CO_CINE_AREA_GERAL": str})
        df = df[df["CO_IES"].notna() & pd.to_numeric(df["CO_IES"], errors="coerce").notna()]
        df.to_parquet(cache, index=False)
    df = pd.read_parquet(cache)
    for c in ["CO_IES", "CO_CURSO", "CO_UF", "CO_MUNICIPIO", "TP_GRAU_ACADEMICO", "TP_MODALIDADE_ENSINO",
              "TP_CATEGORIA_ADMINISTRATIVA", "NU_ANO_INGRESSO", "NU_ANO_REFERENCIA", "NU_ANO_MAXIMO_ACOMPANHAMENTO"]:
        df[c] = as_int(df[c])
    for c in ["QT_INGRESSANTE", "QT_PERMANENCIA", "QT_CONCLUINTE", "QT_DESISTENCIA", "QT_FALECIDO"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    df["REDE"] = rede(df["TP_CATEGORIA_ADMINISTRATIVA"])
    df["NO_CINE_AREA_GERAL"] = df["NO_CINE_AREA_GERAL"].astype(str).str.strip()
    df["NO_CINE_ROTULO"] = df["NO_CINE_ROTULO"].astype(str).str.strip()
    return df[df["NU_ANO_INGRESSO"] == 2015]


def curso_series(t: pd.DataFrame) -> list[dict]:
    """Uma entrada por curso: séries anuais de permanência, concluintes, desistentes e falecidos."""
    out = []
    t = t.sort_values(["CO_CURSO", "NU_ANO_REFERENCIA"])
    for cid, g in t.groupby("CO_CURSO", sort=False):
        g = g.set_index("NU_ANO_REFERENCIA").reindex(ANOS)
        if g["QT_INGRESSANTE"].isna().any():
            continue  # série incompleta: não entra (não há caso em MT, auditado abaixo)
        if g["QT_INGRESSANTE"].iloc[0] < MIN_INGRESSANTES:
            continue  # célula pequena: mesma regra de publicação do banco
        first = g.iloc[0]
        out.append({
            "id": int(cid), "co_ies": int(first["CO_IES"]), "ies": str(first["NO_IES"]).strip(), "nome": str(first["NO_CURSO"]).strip().title(),
            "rotulo": first["NO_CINE_ROTULO"], "area": first["NO_CINE_AREA_GERAL"],
            "grau": int(first["TP_GRAU_ACADEMICO"]), "mod": int(first["TP_MODALIDADE_ENSINO"]),
            "rede": first["REDE"], "mun": int(first["CO_MUNICIPIO"]) if pd.notna(first["CO_MUNICIPIO"]) else None,
            "ing": int(first["QT_INGRESSANTE"]),
            "p": g["QT_PERMANENCIA"].astype(int).tolist(), "c": g["QT_CONCLUINTE"].astype(int).tolist(),
            "s": g["QT_DESISTENCIA"].astype(int).tolist(), "f": g["QT_FALECIDO"].astype(int).tolist(),
        })
    return out


def uf_aggregates(t: pd.DataFrame) -> dict:
    """Brasil, presencial: somas por UF e rede de N, falecidos, concluintes, desistentes e permanência por ano."""
    p = t[(t["TP_MODALIDADE_ENSINO"] == 1) & t["REDE"].notna() & (t["QT_INGRESSANTE"] >= MIN_INGRESSANTES)].copy()
    out: dict = {}
    keys = ["CO_UF", "REDE", "NU_ANO_REFERENCIA"]
    agg = p.groupby(keys)[["QT_INGRESSANTE", "QT_PERMANENCIA", "QT_CONCLUINTE", "QT_DESISTENCIA", "QT_FALECIDO"]].sum()
    for (uf, rd), g in agg.groupby(level=[0, 1]):
        g = g.droplevel([0, 1]).reindex(ANOS).fillna(0).astype(int)
        out.setdefault(UFS[int(uf)], {})[rd] = {
            "n": int(g["QT_INGRESSANTE"].iloc[0]), "p": g["QT_PERMANENCIA"].tolist(), "c": g["QT_CONCLUINTE"].tolist(),
            "s": g["QT_DESISTENCIA"].tolist(), "f": g["QT_FALECIDO"].tolist()}
    return out


# ---------------------------------------------------------------- Censo
CENSO_COLS = ["NU_ANO_CENSO", "CO_UF", "CO_MUNICIPIO", "TP_DIMENSAO", "TP_REDE", "TP_CATEGORIA_ADMINISTRATIVA",
              "CO_IES", "CO_CURSO", "TP_GRAU_ACADEMICO", "TP_MODALIDADE_ENSINO", "TP_NIVEL_ACADEMICO", "NO_CINE_AREA_GERAL",
              "QT_VG_TOTAL", "QT_ING", "QT_MAT", "QT_CONC", "QT_SIT_TRANCADA", "QT_SIT_DESVINCULADO", "QT_SIT_TRANSFERIDO", "QT_SIT_FALECIDO",
              "QT_MAT_FIES", "QT_MAT_PROUNII", "QT_MAT_PROUNIP"]


def load_censo(ano: int) -> pd.DataFrame:
    src = DADOS / f"MICRODADOS_CADASTRO_CURSOS_{ano}.CSV"
    cache = CACHE / f"censo_{ano}_{sha(src)}.parquet"
    if not cache.exists():
        df = pd.read_csv(src, sep=";", encoding="latin1", usecols=lambda c: c in CENSO_COLS, low_memory=False)
        df = df[df["CO_UF"] == UF_MT]
        df.to_parquet(cache, index=False)
    df = pd.read_parquet(cache)
    num = [c for c in CENSO_COLS if c.startswith("QT_")]
    df[num] = df[num].apply(pd.to_numeric, errors="coerce").fillna(0).astype(int)
    df["NO_CINE_AREA_GERAL"] = df["NO_CINE_AREA_GERAL"].astype(str).str.strip()
    df["REDE"] = np.where(df["TP_REDE"] == 1, "publica", np.where(df["TP_REDE"] == 2, "privada", None))
    # Dimensão fixa por modalidade (mesma regra de pipelines/annual.py): presencial = 1, EAD = 2.
    keep = ((df["TP_MODALIDADE_ENSINO"] == 1) & (df["TP_DIMENSAO"] == 1)) | ((df["TP_MODALIDADE_ENSINO"] == 2) & (df["TP_DIMENSAO"] == 2))
    return df[keep]  # mesma regra do banco: sem filtro de nível acadêmico


# ---------------------------------------------------------------- CPC / Enade

def norm_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Cabeçalhos das planilhas INEP variam entre edições (acentos, asteriscos, espaços)."""
    import re
    import unicodedata
    def n(c):
        c = unicodedata.normalize("NFKD", str(c)).encode("ascii", "ignore").decode()
        return re.sub(r"_+", "_", re.sub(r"[^A-Z0-9]+", "_", c.upper())).strip("_")
    return df.rename(columns={c: n(c) for c in df.columns})


def num(s: pd.Series) -> pd.Series:
    """Converte números com vírgula decimal; "SC", "-" e "#NÚM!" viram ausência, nunca zero."""
    return pd.to_numeric(s.astype(str).str.strip().str.replace(",", ".", regex=False), errors="coerce")


CPC_SRC = {"enade": "CONCEITO_ENADE_CONTINUO", "idd": "NOTA_PADRONIZADA_IDD", "mestres": "NOTA_PADRONIZADA_MESTRES",
           "doutores": "NOTA_PADRONIZADA_DOUTORES", "regime": "NOTA_PADRONIZADA_REGIME_DE_TRABALHO",
           "odp": "NOTA_PADRONIZADA_ORGANIZACAO_DIDATICO_PEDAGOGICA",
           "infra": "NOTA_PADRONIZADA_INFRAESTRUTURA_E_INSTALACOES_FISICAS"}


def load_cpc() -> pd.DataFrame:
    frames = []
    for ano, nome in [(2021, "CPC_2021.xlsx"), (2022, "cpc_2022.xlsx"), (2023, "CPC_2023.xlsx")]:
        df = norm_cols(pd.read_excel(DADOS / nome, engine="openpyxl", dtype=str))
        part = next(c for c in df.columns if c.endswith("DE_CONCLUINTES_PARTICIPANTES"))
        d = pd.DataFrame({"CO_IES": as_int(num(df["CODIGO_DA_IES"])), "CO_CURSO": as_int(num(df["CODIGO_DO_CURSO"])),
                          "CPC_CONTINUO": num(df["CPC_CONTINUO"]), "CPC_FAIXA": num(df["CPC_FAIXA"]),
                          "PART": num(df[part]), "EDICAO": ano})
        for k, col in CPC_SRC.items():
            d[k] = num(df[col])
        frames.append(d)
    cpc = pd.concat(frames)
    cpc = cpc[cpc["CO_CURSO"].notna() & cpc["CO_IES"].notna()]
    # Regra do banco: última edição por curso + IES, e só então a validade (CPC entre 0 e 5, >= 10 participantes).
    cpc = cpc.sort_values("EDICAO").drop_duplicates(["CO_IES", "CO_CURSO"], keep="last")
    return cpc[cpc["CPC_CONTINUO"].between(0, 5) & cpc["PART"].ge(MIN_PARTICIPANTES)]


def load_enade() -> pd.DataFrame:
    df = norm_cols(pd.read_excel(DADOS / "conceito_enade_licenciaturas.xlsx", engine="openpyxl", dtype=str))
    d = pd.DataFrame({
        "UF": df["SIGLA_DA_UF"].astype(str).str.strip(),
        "CO_CURSO": as_int(num(df["CODIGO_DO_CURSO"])),
        "CO_IES": as_int(num(df["CODIGO_DA_IES"])),
        "AREA": df["AREA_DE_AVALIACAO"].astype(str).str.replace("\u200b", "", regex=False).str.strip(),
        "MOD": df["MODALIDADE_DE_ENSINO"].astype(str).str.strip(),
        "PART": num(df[next(c for c in df.columns if c.endswith("DE_CONCLUINTES_PARTICIPANTES"))]),
        "PROF": num(df["TOTAL_DE_CONCLUINTE_IGUAL_OU_ACIMA_DO_PADRAO_1_DE_PROFICIENCIA"]),
        "CAT": df[next(c for c in df.columns if c.startswith("CATEGORIA_ADMINISTRATIVA"))].astype(str)
                 .str.replace("\u200b", "", regex=False).str.strip(),
        "MUN": as_int(num(df["CODIGO_DO_MUNICIPIO"])),
    })
    d["REDE"] = np.where(d["CAT"].str.startswith("Púb"), "publica", np.where(d["CAT"].str.startswith("Priv"), "privada", None))
    return d[d["PART"].gt(0) & d["PROF"].between(0, d["PART"])]


# ---------------------------------------------------------------- execução
def main() -> None:
    audit: dict = {}
    t_all = load_trajetoria()
    audit["trajetoria_linhas_coorte2015_brasil"] = int(len(t_all))
    mt = t_all[t_all["CO_UF"] == UF_MT]
    cursos = curso_series(mt)
    audit["trajetoria_cursos_mt"] = len(cursos)
    audit["trajetoria_cursos_mt_por_modalidade"] = {str(k): int(v) for k, v in mt.groupby("TP_MODALIDADE_ENSINO")["CO_CURSO"].nunique().items()}
    audit["trajetoria_cursos_mt_rede_indefinida"] = int(sum(c["rede"] is None for c in cursos))
    ufs = uf_aggregates(t_all)

    censo = pd.concat([load_censo(a) for a in CENSO_ANOS])
    keys = ["NU_ANO_CENSO", "REDE", "TP_MODALIDADE_ENSINO", "TP_GRAU_ACADEMICO", "NO_CINE_AREA_GERAL"]
    sums = ["QT_MAT", "QT_ING", "QT_CONC", "QT_SIT_TRANCADA", "QT_SIT_DESVINCULADO", "QT_SIT_TRANSFERIDO", "QT_SIT_FALECIDO", "QT_MAT_FIES", "QT_MAT_PROUNII", "QT_MAT_PROUNIP", "QT_VG_TOTAL"]
    cg = censo[censo["REDE"].notna()].groupby(keys, dropna=False)[sums].sum().reset_index()
    censo_rows = [[int(r.NU_ANO_CENSO), r.REDE, int(r.TP_MODALIDADE_ENSINO), int(r.TP_GRAU_ACADEMICO) if pd.notna(r.TP_GRAU_ACADEMICO) else 0,
                   r.NO_CINE_AREA_GERAL, *[int(getattr(r, s)) for s in sums]] for r in cg.itertuples()]

    # Financiamento por curso, regra do banco: rede privada, Censo 2024, curso + IES + modalidade, >= 10 matrículas.
    priv = censo[(censo["REDE"] == "privada") & (censo["NU_ANO_CENSO"] == 2024)].groupby(["CO_IES", "CO_CURSO", "TP_MODALIDADE_ENSINO"])[["QT_MAT", "QT_MAT_FIES", "QT_MAT_PROUNII", "QT_MAT_PROUNIP"]].sum()
    tr = {(c["co_ies"], c["id"], c["mod"]) for c in cursos if c["rede"] == "privada"}
    fin = {int(k[1]): [int(v.QT_MAT), int(v.QT_MAT_FIES), int(v.QT_MAT_PROUNII), int(v.QT_MAT_PROUNIP)]
           for k, v in priv.iterrows() if (int(k[0]), int(k[1]), int(k[2])) in tr and v.QT_MAT >= 10}
    audit["financiamento_cursos_ligados"] = len(fin)

    # B1: vagas presenciais 2022 por município e rede + população 18–24 (IBGE, Censo 2022, tabela 9514).
    c22 = censo[(censo["NU_ANO_CENSO"] == 2022) & (censo["TP_MODALIDADE_ENSINO"] == 1)]
    vg = c22.groupby(["CO_MUNICIPIO", "REDE"])["QT_VG_TOTAL"].sum().unstack(fill_value=0)
    pop_raw = json.loads((FONTES / "ibge_censo2022_tabela9514_mt_18a24.json").read_text())
    pop: dict[int, int] = {}
    for r in pop_raw[0]["resultados"]:
        for s in r["series"]:
            pop[int(s["localidade"]["id"])] = pop.get(int(s["localidade"]["id"]), 0) + int(s["serie"]["2022"])
    estado = pd.read_excel(DADOS / "Idades_tratadas.xlsx", sheet_name=0)
    mt_row = estado[estado.iloc[:, 0].astype(str).str.strip() == "Mato Grosso"].iloc[0]
    audit["populacao_18_24_soma_municipios"] = sum(pop.values())
    audit["populacao_18_24_arquivo_estadual"] = int(mt_row.iloc[1]) + int(mt_row.iloc[2])
    if audit["populacao_18_24_soma_municipios"] != audit["populacao_18_24_arquivo_estadual"]:
        raise SystemExit("População municipal não reconcilia com Idades_tratadas.xlsx")
    mun = {str(m): [p, int(vg.loc[m, "publica"]) if m in vg.index and "publica" in vg else 0,
                    int(vg.loc[m, "privada"]) if m in vg.index and "privada" in vg else 0] for m, p in pop.items()}
    audit["b1_vagas_presenciais_2022"] = int(c22["QT_VG_TOTAL"].sum())

    cpc = load_cpc()
    ids = {c["id"] for c in cursos}
    ies_of = {c["id"]: c["co_ies"] for c in cursos}
    cpc_mt = cpc[[ies_of.get(int(c)) == int(i) for c, i in zip(cpc["CO_CURSO"], cpc["CO_IES"])]]
    cpc_out = {int(r.CO_CURSO): {"ed": int(r.EDICAO), "cpc": float(r.CPC_CONTINUO), "faixa": int(r.CPC_FAIXA), "part": int(r.PART),
               **{k: (float(getattr(r, k)) if pd.notna(getattr(r, k)) else None) for k in CPC_SRC}}  # valor exato: arredondar cria empates no Spearman
               for r in cpc_mt.itertuples()}
    audit["cpc_cursos_mt_ligados"] = len(cpc_out)

    enade = load_enade()
    lic = {c["id"]: c["co_ies"] for c in cursos if c["grau"] == 2}
    en = enade[np.array([lic.get(int(c)) == int(i) for c, i in zip(enade["CO_CURSO"], enade["CO_IES"])]) & enade["PART"].ge(MIN_PARTICIPANTES).to_numpy()]
    enade_out = [[int(r.CO_CURSO), r.AREA.title(), int(r.PART), int(r.PROF), "ead" if "dist" in r.MOD.lower() else "presencial",
                  r.REDE, int(r.MUN) if pd.notna(r.MUN) else None, True] for r in en.itertuples()]
    audit["enade_licenciaturas_publicadas"] = int(len(en))
    audit["enade_ligados_a_trajetoria"] = int(en["CO_CURSO"].nunique())
    audit["enade_area_publicada"] = {a.title(): [int(g.PART.sum()), int(g.PROF.sum())] for a, g in en.groupby("AREA")}

    data = {
        "meta": {
            "gerado_em": date.today().isoformat(),
            "fontes": {
                "trajetoria": "INEP · Indicadores de Trajetória 2015–2024 (coorte 2015)",
                "censo": "INEP · Microdados do Censo da Educação Superior 2021–2024 (cadastro de cursos)",
                "cpc": "INEP · CPC 2021, 2022 e 2023 (edição mais recente por curso)",
                "enade": "INEP · Conceito Enade 2025 — licenciaturas",
                "populacao": "IBGE · Censo Demográfico 2022, tabela SIDRA 9514 (18 e 19 anos + 20 a 24 anos)",
            },
            "hashes": {p.name: sha(p) for p in sorted(DADOS.glob("*")) if p.is_file()},
            "auditoria": audit,
        },
        "anos": ANOS, "censo_anos": CENSO_ANOS,
        "cursos": cursos, "uf": ufs,
        "censo_cols": ["ano", "rede", "mod", "grau", "area", *sums], "censo": censo_rows,
        "fin": fin, "mun": mun, "cpc": cpc_out, "enade": enade_out,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"OK {OUT.relative_to(ROOT)} {OUT.stat().st_size / 1024:.0f} KB")
    print(json.dumps(audit, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
