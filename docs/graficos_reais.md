# Gráficos reais — Rota do Diploma

Implementado em 10/10/2026. **Respostas** apresenta 22 gráficos reais, selecionáveis nos cartões das cinco perguntas e duas perguntas bônus. O frontend em `prototipo/` consulta a API; demonstrações não alimentam essa página.

| Pergunta | Gráficos |
| --- | --- |
| P1 | Trajetória anual, desistências anuais, situação final, ingressantes por rede |
| P2 | Cursos por área, divergência por área em pontos percentuais e evolução da coorte 2015 |
| P3 | Matrículas e estimativa anual; desvinculações na tabela da página P3 |
| P4 | CPC × desistência, faixas oficiais de CPC; tabela adicional de correlações dos componentes |
| P5 | Resultados da coorte, proficiência dos avaliados, associação entre cursos, proficiência por curso |
| B1 | Mapa de oferta por 100 jovens, população municipal 2022 e comparação municipal |
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

P3 mantém a estimativa de 2021 indisponível sem Censo 2020. B1 relaciona oferta municipal presencial de 2022 à população **municipal** de 18–24 anos do Censo 2022, validada contra a tabela SIDRA 9514. Município sem registro não recebe valor zero.

FIES, ProUni integral e parcial são exibidos separadamente; não se somam como pessoas distintas. Qualidade, financiamento e trajetória usam populações e períodos identificados na interface. Associações não demonstram causalidade.

Docker foi retirado. Backend Python/Railpack para Railway e frontend Vite para Vercel. A validação foi local, conectada ao banco existente; nenhum novo deploy remoto foi realizado.

## Controles do B1

Restaurados filtro local de rede (pública = 1, privada = 2), consulta municipal, indicadores de vagas/matrículas/menor oferta absoluta e legenda numérica. Rede atualiza mapa, totais e ranking conjuntamente; combina-se com o recorte dos filtros gerais. Os indicadores populacionais estão habilitados com a carga dos 141 municípios; a população não é filtrada por rede. A menor oferta destaca até 15 municípios com oferta relativa positiva; empates são ordenados pelo nome.

Validação na interface: rede pública = 38 municípios, 17.223 vagas e 45.706 matrículas; Cuiabá pública = 4.409 vagas e 11.943 matrículas. Valores conferidos com a API. Alternância para matrículas atualizou a legenda; menor oferta destacou 15 municípios. Build TypeScript/Vite passou e não foram observados erros de JavaScript. Evidências: `outputs/dashboard/b1_controles.png` e `b1_legenda.png`.

Roteiro oral: [roteiro_apresentacao.md](roteiro_apresentacao.md).

## P2 — divergência e linha da coorte

O gráfico divergente calcula taxa ponderada da área menos taxa ponderada do recorte, em pontos percentuais. O zero representa a taxa do recorte selecionado; não representa ausência de desistência. No recorte completo, Computação/TIC fica cerca de 9,6 p.p. acima da referência de 59,9%.

O gráfico de linhas acompanha a coorte 2015 entre 2015 e 2024: total do recorte e as áreas com maior/menor taxa final. A carga contém somente a coorte 2015, portanto os anos de observação não são tratados como novas coortes. Os filtros recalculam a referência, as áreas extremas e suas séries; valores ausentes permanecem indisponíveis.

## P1 — layout do protótipo restaurado

O modo API reutiliza as primitivas SVG originais: linhas, colunas agrupadas por grau/rede, áreas empilhadas (conclusão, permanência e desistência) e pirulitos de perda anual. Os quatro gráficos respeitam os filtros. A composição usa o recorte selecionado, em vez de ignorar rede e grau. As taxas são razões dos totais, nunca médias simples de taxas.
