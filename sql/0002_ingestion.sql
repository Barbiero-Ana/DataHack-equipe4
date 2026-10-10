CREATE TABLE control.source_file (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name TEXT NOT NULL, family TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 bytes BIGINT NOT NULL CHECK(bytes>=0), original_uri TEXT NOT NULL,
 metadata JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(name, sha256)
);
CREATE TABLE control.ingestion_run (
 id UUID PRIMARY KEY, fingerprint TEXT NOT NULL, rules_version TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','validated','failed')),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
 summary JSONB NOT NULL DEFAULT '{}', error_type TEXT
);
CREATE TABLE control.dataset_release (
 id UUID PRIMARY KEY REFERENCES control.ingestion_run(id),
 fingerprint TEXT NOT NULL UNIQUE, contract_version TEXT NOT NULL,
 validation JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE control.release_source (
 release_id UUID NOT NULL REFERENCES control.dataset_release(id),
 source_file_id BIGINT NOT NULL REFERENCES control.source_file(id),
 retained_rows BIGINT NOT NULL, PRIMARY KEY(release_id, source_file_id)
);
CREATE TABLE control.active_release (
 product TEXT PRIMARY KEY CHECK(product='diagnostico_mt'),
 release_id UUID NOT NULL REFERENCES control.dataset_release(id),
 activated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE raw.source_row (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_file_id BIGINT NOT NULL REFERENCES control.source_file(id),
 sheet TEXT NOT NULL, source_row BIGINT NOT NULL CHECK(source_row>0),
 payload JSONB NOT NULL, UNIQUE(source_file_id, sheet, source_row)
);
CREATE TABLE staging.record (
 release_id UUID NOT NULL REFERENCES control.dataset_release(id),
 raw_id BIGINT NOT NULL REFERENCES raw.source_row(id), family TEXT NOT NULL,
 year INTEGER, uf TEXT, municipality TEXT, ies TEXT, course TEXT,
 network TEXT CHECK(network IN ('1','2')), modality TEXT CHECK(modality IN ('1','2')),
 dimension TEXT, requires_review BOOLEAN NOT NULL,
 qt_mat BIGINT CHECK(qt_mat>=0), qt_ing BIGINT CHECK(qt_ing>=0),
 qt_conc BIGINT CHECK(qt_conc>=0), qt_desvinculado BIGINT CHECK(qt_desvinculado>=0),
 qt_vg_total BIGINT CHECK(qt_vg_total>=0), payload JSONB NOT NULL,
 PRIMARY KEY(release_id, raw_id)
);
CREATE INDEX staging_filters ON staging.record(release_id,family,year,network,modality);
CREATE INDEX staging_course ON staging.record(release_id,family,course,year);
CREATE TABLE control.quality_issue (
 release_id UUID NOT NULL, raw_id BIGINT NOT NULL, rule TEXT NOT NULL,
 severity TEXT NOT NULL CHECK(severity IN ('error','warning')), detail TEXT NOT NULL,
 PRIMARY KEY(release_id,raw_id,rule),
 FOREIGN KEY(release_id,raw_id) REFERENCES staging.record(release_id,raw_id)
);
CREATE TABLE analytics.annual_mt (
 release_id UUID NOT NULL REFERENCES control.dataset_release(id),
 year INTEGER NOT NULL, uf TEXT NOT NULL CHECK(uf='51'),
 network TEXT NOT NULL CHECK(network IN ('1','2')),
 modality TEXT NOT NULL CHECK(modality IN ('1','2')),
 qt_mat BIGINT, qt_ing BIGINT, qt_conc BIGINT, qt_desvinculado BIGINT,
 qt_registros_oferta BIGINT, qt_mat_anterior BIGINT, qt_conc_anterior BIGINT,
 numerador_permanencia BIGINT, denominador_permanencia BIGINT,
 evasao_estimada_pct DOUBLE PRECISION, status_estimativa TEXT NOT NULL,
 PRIMARY KEY(release_id,year,network,modality)
);
CREATE TABLE analytics.population_census_mt (
 release_id UUID NOT NULL REFERENCES control.dataset_release(id),
 year INTEGER NOT NULL CHECK(year=2022), uf TEXT NOT NULL CHECK(uf='51'),
 qt_cursos_presenciais BIGINT NOT NULL, qt_mat_presencial BIGINT NOT NULL,
 qt_vg_presencial BIGINT NOT NULL, qt_pop_18_19 BIGINT NOT NULL,
 qt_pop_20_24 BIGINT NOT NULL, qt_pop_18_24 BIGINT NOT NULL CHECK(qt_pop_18_24>0),
 PRIMARY KEY(release_id,year,uf)
);
