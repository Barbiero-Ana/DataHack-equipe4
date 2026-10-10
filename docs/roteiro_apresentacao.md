# Roteiro de apresentação — 5 minutos

Use a página **Respostas**, limpe os filtros gerais e selecione cada cartão. No B1, mantenha inicialmente todas as redes. Os números abaixo são do recorte completo publicado em 10/10/2026; filtros mudam os resultados.

## 1. Abertura — 20 segundos

“O Rota do Diploma investiga onde a trajetória no ensino superior de Mato Grosso se interrompe. Cruzamos dados do INEP e do IBGE para analisar permanência, conclusão, qualidade e oferta. Nosso principal acompanhamento é dos ingressantes de 2015 em cursos presenciais, observados até 2024.”

## 2. As respostas — cerca de 3 minutos

| Abra | O que dizer | O que mostrar |
| --- | --- | --- |
| P1 | “No recorte publicado, 59,9% dos vínculos desistiram do curso, 38,8% concluíram e 1,3% permaneciam. Desistir do curso não significa necessariamente abandonar todo o ensino superior.” | Linhas da trajetória e distribuição final. |
| P2 | “Computação e TIC tiveram a maior taxa agregada entre as áreas: 69,5%. Engenharia, produção e construção veio a seguir, com 68,3%. Usamos o total de desistentes dividido pelo denominador da área, respeitando o tamanho dos cursos.” | Comparação por área. Taxa alta e maior quantidade de desistentes são perguntas diferentes. |
| P3 | “Em 2024, a estimativa anual foi 23,6% no presencial público e 29,1% no presencial privado. No EAD, foi 30,8% no público e 66,3% no privado. É uma estimativa por balanço de matrículas, diferente da desistência acumulada de uma turma.” | Série anual por rede/modalidade. Desvinculações estão na tabela da página P3. |
| P4 | “Nos 277 cursos comparáveis, a associação entre CPC e desistência foi próxima de zero: −0,036. Portanto, neste recorte, não encontramos uma relação monotônica forte entre as duas medidas.” | Dispersão CPC × desistência. Cada ponto representa um curso. |
| P5 | “Nas licenciaturas acompanhadas, a desistência foi 57,2%. Separadamente, entre 848 avaliados nos 38 cursos correspondentes do Enade 2025, 521 foram proficientes: 61,4%. São grupos diferentes; não podemos multiplicar essas taxas.” | Os dois gráficos de distribuição, explicando os denominadores. |
| B1 | “Em 2022, temos registros de oferta presencial em 42 municípios, somando 84.508 vagas. Cuiabá registra 24.949 vagas. O mapa permite comparar redes e consultar municípios. Ainda não podemos medir vagas por cem jovens em cada município porque a população disponível é estadual.” | Filtro de rede, legenda e seleção de Cuiabá. Cinza significa sem registro no recorte. |
| B2 | “Ligamos financiamento e trajetória em 181 cursos privados. Podemos comparar participação do FIES e resultados dos cursos. Não conseguimos afirmar que o financiamento reduziu a desistência: não acompanhamos os mesmos beneficiários desde 2015. FIES e ProUni são apresentados separadamente.” | Séries dos programas e dispersão FIES × desistência. |

## 3. Por que e como validamos — 50 segundos

“Validamos porque um código de rede interpretado errado, um curso duplicado ou uma população incompatível pode produzir um gráfico convincente com conclusão errada.

Padronizamos códigos e campos com Python e pandas, verificamos duplicidades e cruzamos instituição mais curso. Conferimos os numeradores e denominadores, sem somar repetidamente os ingressantes da mesma turma. Também reconciliamos cinco taxas da fonte com as contagens.

Depois comparamos os sete conjuntos calculados em pandas com os publicados no PostgreSQL e verificamos seis combinações de filtros da API. Os resultados coincidiram. A suíte passou em 72 testes, com quatro testes opcionais de banco não executados, e conferimos os gráficos no navegador. Isso verifica a consistência do processamento; não comprova causalidade nem elimina limitações das fontes.”

## 4. Fechamento — 20 segundos

“O principal achado é a perda de vínculos ao longo da trajetória, com diferenças entre áreas e modalidades. Os dados ajudam a escolher onde investigar e priorizar ações. A próxima etapa é completar a população municipal e aprofundar os fatores associados à permanência.”

## Se a banca perguntar

- **O que é coorte?** O grupo de ingressantes de um mesmo ano, acompanhado ao longo do tempo.
- **Por que o denominador mudou?** Dos 41.832 ingressantes publicados, o denominador final é 41.803, ajustado por 29 falecimentos.
- **Por que não aparece uma estimativa em 2021?** A fórmula anual precisa do Censo 2020, ausente na carga atual. Indisponível não é zero.
- **Todos os cursos entram nos cruzamentos?** Não. Há exigências de correspondência e dados válidos; células com menos de dez alunos são excluídas. A cobertura está indicada na tela.
- **O mapa cinza indica um deserto educacional?** Não. Indica ausência de registro no recorte; falta evidência para concluir ausência de oferta.
- **Correlação prova causa?** Não. Mostra associação entre medidas; outros fatores podem explicar os resultados.

Evidências técnicas: [gráficos e validação](graficos_reais.md) e `outputs/dashboard/validation.json`. Código reproduzível: `pipelines/dashboard.py` e `pipelines/check_dashboard.py`.
