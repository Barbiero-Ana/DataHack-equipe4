"""Valida tabelaMUNICIPIO com pandas e publica o complemento municipal de 2022."""

import argparse
import hashlib
import json
import unicodedata
from pathlib import Path
from uuid import uuid4

import pandas as pd
from psycopg.types.json import Jsonb

from pipelines.database import ROOT, active, connect, records

SOURCE = ROOT / "dados/tabelaMUNICIPIO.xlsx"
REFERENCE = ROOT / "prototipo/scripts/fontes/ibge_censo2022_tabela9514_mt_18a24.json"
AGES = {"18 anos": "population_18", "19 anos": "population_19", "20 a 24 anos": "population_20_24"}


def name_key(value):
    return " ".join(unicodedata.normalize("NFKC", str(value)).casefold().split())


def read_source(source=SOURCE, reference=REFERENCE):
    source, reference = Path(source), Path(reference)
    raw = pd.read_excel(source, sheet_name="Tabela", header=None, dtype=object)
    if list(raw.iloc[0, 2:5]) != list(AGES):
        raise ValueError("Faixas etárias inesperadas; não somar totais sobrepostos.")
    mt = raw.loc[raw[0].astype(str).str.endswith(" (MT)")].copy()
    if len(mt) != 141 or not mt[1].eq("Total").all():
        raise ValueError("Esperados 141 municípios de MT, sexo Total.")
    original = [
        {
            "source_row": int(i + 1),
            "payload": {"name": r[0], "sex": r[1], **{age: r[j + 2] for j, age in enumerate(AGES)}},
        }
        for i, r in mt.iterrows()
    ]
    mt.columns = ["name", "sex", *AGES.values()]
    mt["name"] = mt["name"].str.removesuffix(" (MT)")
    mt["key"] = mt["name"].map(name_key)
    if mt["key"].duplicated().any():
        raise ValueError("Município duplicado após normalização de nome.")
    for col in AGES.values():
        # A legenda do IBGE define '-' como zero; X/../... permanecem inválidos.
        mt[col] = pd.to_numeric(mt[col].replace("-", 0), errors="coerce")
        if mt[col].isna().any() or mt[col].lt(0).any() or mt[col].mod(1).ne(0).any():
            raise ValueError("População ausente, suprimida, negativa ou fracionária.")
        mt[col] = mt[col].astype(int)
    mapping = {}
    for group in json.loads(reference.read_text()):
        for result in group["resultados"]:
            classes = {c["nome"]: list(c["categoria"].values()) for c in result["classificacoes"]}
            if classes["Sexo"] != ["Total"] or classes["Forma de declaração da idade"] != ["Total"]:
                raise ValueError("Referência IBGE com população incompatível.")
            age = AGES[classes["Idade"][0]]
            for item in result["series"]:
                loc = item["localidade"]
                if loc["nivel"]["id"] != "N6" or not loc["id"].startswith("51"):
                    raise ValueError("Referência fora do nível municipal de MT.")
                key = name_key(loc["nome"].removesuffix(" - MT"))
                row = mapping.setdefault(key, {"key": key, "municipality": loc["id"]})
                if age in row:
                    raise ValueError("Idade/município duplicado na referência IBGE.")
                row[age] = int(item["serie"]["2022"])
    ref = pd.DataFrame(mapping.values())
    merged = mt.merge(
        ref, on="key", how="outer", suffixes=("", "_ibge"), validate="one_to_one", indicator=True
    )
    if len(merged) != 141 or not merged["_merge"].eq("both").all():
        raise ValueError("Municípios da planilha não correspondem integralmente ao IBGE 2022.")
    for col in AGES.values():
        if not merged[col].eq(merged[col + "_ibge"]).all():
            raise ValueError("População da planilha diverge da referência IBGE 2022.")
    uf = raw.loc[raw[0].eq("Mato Grosso") & raw[1].eq("Total")]
    if len(uf) != 1 or any(
        int(mt[col].sum()) != int(uf.iloc[0, i + 2]) for i, col in enumerate(AGES.values())
    ):
        raise ValueError("Soma municipal não fecha o total estadual por idade.")
    merged["population"] = merged[list(AGES.values())].sum(axis=1)
    merged["year"] = 2022
    result = merged[["municipality", "name", "year", *AGES.values(), "population"]].sort_values(
        "municipality"
    )
    if result["municipality"].duplicated().any():
        raise ValueError("Código IBGE duplicado.")
    audit = {
        "source": source.name,
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "reference_sha256": hashlib.sha256(reference.read_bytes()).hexdigest(),
        "reference": "IBGE SIDRA tabela 9514, 2022, sexo e declaração Total",
        "year": 2022,
        "municipalities": len(result),
        "population": int(result.population.sum()),
        "age_values_compared": len(result) * 3,
        "age_mismatches": 0,
        "state_reconciled": True,
    }
    return original, records(result), audit


def enrich(payload, audit, population, provenance):
    codes = {r["municipality"] for r in population}
    if any(r["municipality"] not in codes for r in payload["municipal"]):
        raise ValueError("Oferta municipal sem correspondência populacional.")
    payload["municipal_population"] = population
    audit["municipal_population"] = provenance
    audit["census"]["municipal_population_available"] = True
    audit["notes"] = [n for n in audit["notes"] if not n.startswith("População municipal ausente")]
    note = (
        "População municipal IBGE 2022: 18 + 19 + 20–24 anos; oferta Censo 2022. Sem "
        "registro de oferta não é zero confirmado."
    )
    if note not in audit["notes"]:
        audit["notes"].append(note)


def attach_published(connection, release, payload, audit):
    exists = connection.execute(
        "SELECT to_regclass('control.municipal_population_import') name"
    ).fetchone()["name"]
    if exists is None:
        return False
    item = connection.execute(
        "SELECT id,audit FROM control.municipal_population_import WHERE "
        "release_id=%s ORDER BY created_at DESC LIMIT 1",
        (release,),
    ).fetchone()
    if item is None:
        return False
    rows = connection.execute(
        "SELECT "
        "municipality,name,year,population_18,population_19,population_20_24,population "
        "FROM staging.municipal_population WHERE import_id=%s ORDER BY municipality",
        (item["id"],),
    ).fetchall()
    enrich(payload, audit, rows, item["audit"])
    return True


def publish(source=SOURCE, reference=REFERENCE):
    original, population, provenance = read_source(source, reference)
    with connect() as connection:
        release = active(connection)
        product = connection.execute(
            "SELECT payload,audit FROM analytics.dashboard_mt WHERE release_id=%s FOR UPDATE",
            (release,),
        ).fetchone()
        if product is None:
            raise ValueError("Publique o dashboard antes do complemento municipal.")
        enrich(product["payload"], product["audit"], population, provenance)
        item = connection.execute(
            "INSERT INTO "
            "control.municipal_population_import(id,release_id,source_name,sha256,"
            "reference_sha256,year,audit) "
            "VALUES(%s,%s,%s,%s,%s,2022,%s) ON CONFLICT(release_id,sha256) DO UPDATE SET "
            "audit=EXCLUDED.audit RETURNING id",
            (
                uuid4(),
                release,
                provenance["source"],
                provenance["source_sha256"],
                provenance["reference_sha256"],
                Jsonb(provenance),
            ),
        ).fetchone()["id"]
        with connection.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO raw.municipal_population VALUES(%s,%s,%s) ON CONFLICT DO NOTHING",
                [(item, r["source_row"], Jsonb(r["payload"])) for r in original],
            )
            cursor.executemany(
                "INSERT INTO staging.municipal_population VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON "
                "CONFLICT DO NOTHING",
                [
                    (
                        item,
                        *[
                            r[k]
                            for k in (
                                "municipality",
                                "name",
                                "year",
                                "population_18",
                                "population_19",
                                "population_20_24",
                                "population",
                            )
                        ],
                    )
                    for r in population
                ],
            )
        connection.execute(
            "UPDATE analytics.dashboard_mt SET "
            "payload=%s,audit=%s,contract_version='dashboard-1.1.0',created_at=now() "
            "WHERE release_id=%s",
            (Jsonb(product["payload"]), Jsonb(product["audit"]), release),
        )
    out = ROOT / "outputs/municipal_population"
    out.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(population).to_csv(out / "population_2022.csv", index=False)
    (out / "validation.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2))
    print(json.dumps(provenance, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    if args.check_only:
        print(json.dumps(read_source()[2], ensure_ascii=False, indent=2))
    else:
        publish()
