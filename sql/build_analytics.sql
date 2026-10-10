INSERT INTO analytics.annual_mt
WITH totals AS (
 SELECT year, network, modality, sum(qt_mat)::bigint m, sum(qt_ing)::bigint i,
 sum(qt_conc)::bigint c, sum(qt_desvinculado)::bigint d, count(*) offers
 FROM staging.record WHERE release_id=%(release)s AND family='censo_cursos'
 AND uf='51' AND NOT requires_review
 AND ((modality='1' AND dimension='1') OR (modality='2' AND dimension='2'))
 GROUP BY year,network,modality
), grid AS (
 SELECT year,network,modality FROM generate_series(2021,2024) year
 CROSS JOIN (VALUES ('1'),('2')) n(network) CROSS JOIN (VALUES ('1'),('2')) t(modality)
), components AS (
 SELECT g.*, t.m,t.i,t.c,t.d,t.offers,p.m pm,p.c pc,t.m-t.i num,p.m-p.c den
 FROM grid g LEFT JOIN totals t USING(year,network,modality)
 LEFT JOIN totals p ON p.year=g.year-1 AND p.network=g.network AND p.modality=g.modality
), computed AS (
 SELECT *, CASE WHEN m IS NOT NULL AND pm IS NOT NULL AND den>0
 THEN 100.0*(1.0-num::double precision/den) END rate FROM components
)
SELECT %(release)s,year,'51',network,modality,m,i,c,d,offers,pm,pc,num,den,rate,
 CASE WHEN m IS NULL THEN 'sem_base_ano_atual'
 WHEN pm IS NULL THEN 'sem_base_ano_anterior'
 WHEN den<=0 THEN 'denominador_nao_positivo'
 WHEN rate<0 OR rate>100 THEN 'revisar_estimativa_fora_0_100'
 ELSE 'calculada' END FROM computed;

INSERT INTO analytics.population_census_mt
SELECT %(release)s,2022,'51',count(DISTINCT course),sum(qt_mat),sum(qt_vg_total),
 p.a,p.b,p.a+p.b FROM staging.record c CROSS JOIN (
 SELECT (payload->>'QT_POP_18_19')::numeric::bigint a,(payload->>'QT_POP_20_24')::numeric::bigint b
 FROM staging.record WHERE release_id=%(release)s AND family='populacao' AND uf='51'
) p WHERE c.release_id=%(release)s AND c.family='censo_cursos'
 AND c.year=2022 AND c.uf='51' AND c.modality='1' AND c.dimension='1'
 AND NOT c.requires_review GROUP BY p.a,p.b;
