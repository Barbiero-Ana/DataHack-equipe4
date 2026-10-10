# Gráficos reais — Rota do Diploma

Implementado em 10/10/2026. **Respostas** apresenta 22 gráficos reais, selecionáveis nos cartões das cinco perguntas e duas perguntas bônus. O frontend em `prototipo/` consulta a API; demonstrações não alimentam essa página.

| Pergunta | Gráficos |
| --- | --- |
| P1 | Trajetória anual, desistências anuais, situação final, ingressantes por rede |
| P2 | Cursos por área, desistência ponderada por área, ranking de cursos |
| P3 | Estimativa anual e quantidade de desvinculações |
| P4 | CPC × desistência, faixas oficiais de CPC; tabela adicional de correlações dos componentes |
| P5 | Resultados da coorte, proficiência dos avaliados, associação entre cursos, proficiência por curso |
| B1 | Mapa de vagas, comparação municipal, população estadual por idade |
| B2 | Contagens dos programas, participação nas matrículas, FIES × desistência, comparação por faixas de participação |

## Banco e reprodução

As camadas control, raw, staging e analytics permanecem separadas. A migration `0003_dashboard` acrescenta `analytics.dashboard_mt`. O pipeline pandas `pipelines/dashboard.py` lê staging, valida os cruzamentos e publica sete conjuntos versionados. `/api/v1/analytics/dashboard` aplica filtros ao produto da versão ativa.

```sh
backend/.venv/bin/python -m pipelines.dashboard
backend/.venv/bin/python -m pipelines.check_dashboard
backend/.venv/bin/python -m pytest backend/tests pipelines/tests --import-mode=importlib -q
npm --prefix prototipo run build
```

O primeiro comando publica; o segundo verifica sem alterar os dados. Relatório: `outputs/dashboard/validation.json`, ignorado pelo Git. Credenciais permanecem no ambiente.

## Validação

Versão `a1e9a162-edb5-4d75-91ff-c6d07f7a96ac`, produto `dashboard-1.0.0`. Sete conjuntos pandas × PostgreSQL idênticos; seis combinações HTTP de filtros passaram; quatro filtros inválidos retornaram 422. Testes: 72 passaram e quatro opcionais PostgreSQL foram ignorados. Build TypeScript/Vite passou. As sete perguntas foram abertas na página Respostas e seus gráficos renderizaram.

Na coorte publicada: 41.832 ingressantes; denominador ajustado de 41.803; 25.039 desistentes, 16.220 concluintes e 544 permanecentes. Proporções: 59,9%, 38,8% e 1,3%. As cinco taxas da fonte foram reconciliadas com as contagens, sem divergências além da tolerância de arredondamento. Cruzamentos usam instituição e curso com cardinalidade validada.

## Cobertura e limites

Trajetória: coorte 2015, presencial, Mato Grosso, referências 2015–2024. Publicados 500 cursos; excluídos 15 com coorte menor que dez. CPC: 277 cursos válidos ligados, de universo de 500. Enade: 38 licenciaturas válidas ligadas, de universo de 94. Cobertura e exclusões aparecem na interface.

P3 mantém a estimativa de 2021 indisponível sem Censo 2020. B1 relaciona oferta municipal presencial de 2022 à população **estadual** de 2022. Ainda falta população municipal de 18–24 anos para vagas por cem jovens em cada município. Município sem registro não recebe valor zero.

FIES, ProUni integral e parcial são exibidos separadamente; não se somam como pessoas distintas. Qualidade, financiamento e trajetória usam populações e períodos identificados na interface. Associações não demonstram causalidade.

Docker foi retirado. Backend Python/Railpack para Railway e frontend Vite para Vercel. A validação foi local, conectada ao banco existente; nenhum novo deploy remoto foi realizado.
