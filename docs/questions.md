# Perguntas e contratos de análise

Recorte: Mato Grosso. Fonte: `DataHack_Abertura_Rota_do_Diploma.pptx`, slide 8. A preparação está implementada; as respostas finais dependem das decisões abaixo.

| Pergunta | Bases | Próximo cálculo | Limite atual |
| --- | --- | --- | --- |
| Central: perdas na trajetória e condições associadas | Todas | Comparar curso, área, rede e modalidade, declarando população/ano | Associações agregadas não identificam causas individuais |
| 1 — coorte presencial 2015 até 2024 | Trajetória | Uma referência final por curso/coorte; agregar permanência e fluxos acumulados com denominador ajustado; maior perda anual por `QT_DESISTENCIA` e taxa anual | Conferir limite de acompanhamento por curso |
| 2 — cursos/áreas e desistência | Trajetória | Ano de acompanhamento = referência − ingresso + 1; agrupar códigos CINE e ponderar pelo denominador | Só existe coorte 2015; comparação entre coortes precisa de novas bases |
| 3 — matrículas/evasão por rede/modalidade 2021–2024 | Censo | Rede padronizada, modalidade e dimensão explícita; conservar ano e conferir mudanças de esquema | Balanço anual escolhido e implementado; estimativa de 2021 requer Censo 2020; validar dimensões/totais oficiais |
| 4 — CPC e trajetória | CPC + Trajetória | Selecionar edição, tratar SC, medir cobertura e cruzar com cardinalidade validada; controlar área/rede/modalidade | CPC avalia áreas em ciclos; associação não implica explicação causal |
| 5 — licenciaturas e proficiência | Enade 2025 + Trajetória | Filtrar grau/modalidade; medir cobertura entre licenciaturas; manter participantes e proporção | Populações distintas; não multiplicar taxas como se fossem as mesmas pessoas |
| Bônus 1 — vagas presenciais por 100 jovens | Censo + idades | Começar pelo universo municipal completo; left join da oferta; vagas/população × 100; identificar ausência de oferta | Faltam população e universo municipais; ausência não é zero |
| Bônus 2 — financiamento e desistência | Censo + Trajetória | Na rede privada, `QT_MAT_FIES`, `QT_MAT_PROUNII` e `QT_MAT_PROUNIP` sobre `QT_MAT`, separadamente e por ano; associar por curso | Confirmar sobreposição, dimensão e janela temporal; não inferir causalidade |

Não excluir oferta em MT pela UF da sede da IES. A localização dos indicadores CPC/Enade pode representar a sede do curso EAD, não a oferta municipal. A cobertura geral do diagnóstico não substitui a cobertura do recorte específico de cada pergunta.

Cada análise deve registrar fonte/edição, chave, filtros, denominador, perdas nos cruzamentos, tratamento de SC/ausências, células pequenas e limitações. Código em `pipelines/`; dados e gráficos fora do Git.

O complemento **estadual** de idades já foi ligado ao Censo 2022, por UF/ano, em `population_census_2022_MT.parquet`. A pendência do bônus 1 é o detalhamento municipal, que não pode ser reconstruído a partir das matrículas por faixa etária. Veja `validacao_dados.md` e `formulas_indicadores.md`.

As fórmulas e os critérios para homologação estão em [formulas_indicadores.md](formulas_indicadores.md).
