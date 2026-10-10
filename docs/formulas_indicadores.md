# Contratos das fórmulas

Uma fórmula está fechada quando define medida, população, ano, unidade geográfica, filtros, numerador, denominador, agregação, tratamento das ausências e verificações. Fórmula matemática definida não significa que todas as bases necessárias já estão disponíveis.

## Regras comuns

- Unidade da trajetória: curso + IES + coorte + referência. Unidade do Censo: curso + local + dimensão + ano. Preservar códigos como texto.
- Recorte territorial pela oferta em MT; rede 1 pública/2 privada; modalidade explicitada por indicador. Não trocar oferta pela sede da IES.
- Divisão por denominador zero, negativo ou ausente retorna ausência acompanhada de motivo; nunca zero automático.
- Medida ausente não vira zero. SC permanece status e fica fora da análise numérica, com exclusões contabilizadas.
- Agregar numeradores e denominadores antes de dividir. Não somar taxas e não fazer média simples quando a intenção é representar estudantes.
- Cruzamentos devem declarar edição e cardinalidade, guardar não encontrados e impedir correspondência entre chaves nulas.
- Resultados são vínculos/contagens do universo de cada fonte, não necessariamente pessoas únicas entre bases.

## 1. Trajetória: permanência, conclusão e desistência

Para curso `j`, coorte de ingresso `T` e referência `t`:

```text
N[j]    = QT_INGRESSANTE da coorte, contado uma única vez
F[j,t]  = soma QT_FALECIDO de T até t
B[j,t]  = N[j] - F[j,t]
C[j,t]  = soma QT_CONCLUINTE de T até t
S[j,t]  = soma QT_DESISTENCIA de T até t
P[j,t]  = QT_PERMANENCIA na referência t

TAP[j,t]  = 100 * P[j,t] / B[j,t]
TCA[j,t]  = 100 * C[j,t] / B[j,t]
TDA[j,t]  = 100 * S[j,t] / B[j,t]
TCAN[j,t] = 100 * QT_CONCLUINTE[j,t] / B[j,t]
TADA[j,t] = 100 * QT_DESISTENCIA[j,t] / B[j,t]
```

O INEP utiliza a coorte descontada dos falecimentos. Permanência inclui vínculos cursando/trancados; desistência do curso inclui saídas por desvinculação/transferência, e não prova abandono definitivo da educação superior. [Metodologia INEP](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2017/metodologia_indicadores_trajetoria_curso.pdf), [painel INEP 2023](https://download.inep.gov.br/educacao_superior/censo_superior/documentos/2023/painel-de-bi-do-censo-da-educacao-superior-deed-inep.pdf), [resumo técnico INEP 2021 — TADA](https://download.inep.gov.br/publicacoes/institucionais/estatisticas_e_indicadores/resumo_tecnico_censo_da_educacao_superior_2021.pdf).

**Pergunta 1:** coorte 2015, presencial, MT, referência final 2024. No conjunto de cursos, calcular `100 * soma(C) / soma(B)`, `100 * soma(S) / soma(B)` e `100 * soma(P) / soma(B)`. Exibir também numeradores e ingressantes originais, distinguindo estes do denominador ajustado. Maior perda em volume: ano com maior `soma(QT_DESISTENCIA anual)`; maior perda proporcional: ano com maior TADA agregada. Informar empates e qual critério foi utilizado.

**Pergunta 2:** comparar TDA por curso/área em igual ano de acompanhamento: `k = t - T + 1`. Não comparar curso no segundo ano com outro no décimo. Para ranking, exibir tamanho da coorte e aplicar a regra do desafio para células pequenas. A álgebra está definida; comparação entre coortes depende de outras coortes. A regra para observações depois do limite de acompanhamento exige confirmação metodológica; manter a flag e não interpretar esses registros como novos eventos.

**Aceite:** cinco taxas reconciliadas com tolerância de 0,05 ponto percentual; TAP + TCA + TDA aproximadamente 100%; contagens/denominadores coerentes; ingressantes não multiplicados entre referências. O código de reconciliação já existe em `pipelines/review.py`.

## 2. Pergunta 3: matrículas e evasão anual

**Matrículas:** `M[g,t] = soma(QT_MAT)` no grupo `g = rede × modalidade`, com território e dimensão fixados. A dimensão deve evitar repetição do mesmo vínculo em recortes sobrepostos. Para EAD, não usar vagas nacionais como vagas municipais.

**Medida escolhida pelo usuário em 10/10/2026:** estimativa anual por balanço de matrículas, acompanhada da quantidade de desvinculações:

```text
E[g,t] = 100 * (1 - (M[g,t] - I[g,t]) / (M[g,t-1] - C[g,t-1]))
I = soma QT_ING; C = soma QT_CONC; M = soma QT_MAT
```

Essa é a estimativa por permanência descrita por Lobo; não é a TADA de uma coorte. A origem dos ingressantes e movimentos entre cursos afetam sua interpretação. [Lobo, Cadernos ABMES 25, seção de cálculo da evasão, pp. 29–31](https://abmes.org.br/arquivos/publicacoes/Cadernos25.pdf).

Calcular sobre os totais de cada grupo, não pela média das taxas dos cursos. Reconciliar o universo e a classificação dos grupos entre anos. Não substituir silenciosamente `QT_ING` por outra categoria de ingresso. Valores negativos ou acima de 100% são sinalizados para revisão, sem truncamento automático. Agregados não identificam os mesmos indivíduos nem eliminam efeitos de transferências/reclassificações.

Para calcular **2021**, é necessário também **2020**. Com os arquivos atuais, 2022–2024 têm anos anteriores disponíveis. A segunda medida escolhida é `soma(QT_SIT_DESVINCULADO)`, quantidade de desvinculações anuais, sem inventar um denominador de evasão. O método foi escolhido; a implementação em `pipelines/annual.py` calcula 2022–2024 e sinaliza a estimativa de 2021 como pendente de 2020. Dimensões e totais oficiais ainda precisam ser conferidos antes da homologação dos resultados. Veja `pergunta3.md`.

## 3. Pergunta 4: CPC e desistência

Proposta: uma edição CPC por curso, entre 2021–2023; relacioná-la à TDA da coorte 2015 em 2024. Informar a edição em cada registro. A escolha precisa ser explícita e mantida em todas as comparações; não empilhar edições do mesmo curso como observações independentes.

Medida exploratória inicial: `rho = correlação(rank(CPC_CONTINUO), rank(TDA))` entre cursos com ambas as medidas válidas (Spearman). Publicar tamanho do conjunto, cobertura e distribuição por área/rede/modalidade. Esse indicador representa associação entre cursos. Não fazer uma média das notas como substituto da associação.

“O que mais explica” requer uma etapa separada: modelo com CPC, rede, modalidade e área, definição de ponderação pelo tamanho da coorte e avaliação da estabilidade. Nenhuma correlação isolada demonstra causa. Especificação do modelo permanece pendente; não inventar um único “índice explicativo”.

## 4. Pergunta 5: licenciaturas e proficiência

Filtrar licenciaturas na trajetória, com modalidade explícita, e ligar por código aos resultados Enade 2025. Desistência: TDA definida acima. Proficiência:

```text
PROFICIENCIA[g] = 100 * soma(QT_PROFICIENTE[g]) / soma(QT_PARTICIPANTES[g])
```

Usar registros com contagens válidas e população de avaliados definida; tratar SC/contagens indisponíveis como ausência e registrar exclusões. Não calcular a proficiência agregada pela média simples das proporções dos cursos. A razão pode ser conferida com a proporção 0–1 fornecida no arquivo; a tolerância do diagnóstico é 0,0011 nessa escala.

Não multiplicar permanência/conclusão de 2015 pela proficiência de 2025 para estimar “quantos ingressantes se tornaram proficientes”: as bases não identificam as mesmas pessoas. A álgebra da proficiência está definida; o contrato do cruzamento entre populações deve constar no resultado.

## 5. Bônus 1: vagas por 100 jovens

```text
POP18_24[m,2022] = POP18_19[m,2022] + POP20_24[m,2022]
VAGAS100[m,2022] = 100 * VAGAS_PRESENCIAIS[m,2022] / POP18_24[m,2022]
```

Definir se “vagas” significa `QT_VG_TOTAL` ou uma categoria específica, e manter a definição no mapa/legenda. Proposta: vagas totais ofertadas, presença/dimensão explícitas. A fórmula não é taxa de ocupação nem proporção dos moradores que ingressaram.

O vínculo estadual de 2022 já existe em `pipelines/integrate.py`. Para o indicador municipal, começar pelo universo completo de municípios e usar população municipal de 2022. Ausência de população não vira zero. Oferta sem correspondência só vira zero depois de confirmar cobertura completa da fonte. Fórmula definida; detalhamento municipal ainda pendente.

## 6. Bônus 2: participação do financiamento

No grupo privado, por curso/ano/local, com dimensão fixa:

```text
FIES_pct    = 100 * soma(QT_MAT_FIES)    / soma(QT_MAT)
PROUNI_Ipct = 100 * soma(QT_MAT_PROUNII) / soma(QT_MAT)
PROUNI_Ppct = 100 * soma(QT_MAT_PROUNIP) / soma(QT_MAT)
```

Manter percentuais separados até confirmar exclusividade. Não chamar sua soma de “percentual único de beneficiários” sem deduplicação ou uma variável oficial de união. A relação com TDA deve declarar o ano do financiamento e da trajetória; os matriculados de 2021–2024 não identificam o financiamento dos ingressantes de 2015. Fórmulas de participação propostas; interpretação e alinhamento ainda dependem do dicionário/contrato.

## Como homologar e implementar

1. O indicador da pergunta 3 foi escolhido: balanço anual com `QT_ING` e volume de desvinculações. Obter o Censo 2020 para calcular 2021; verificar compatibilidade dos grupos entre anos.
2. Incorporar os dicionários e confirmar dimensões, vagas e limite de acompanhamento; definir edição dos cruzamentos.
3. Registrar uma ficha por indicador com todos os itens de contrato; distinguir fórmula definida, fonte disponível e indicador homologado.
4. Implementar funções Python que retornem valor, numerador, denominador, universo/exclusões e motivo de ausência. Preservar esses campos na API.
5. Testar exemplo manual, divisão inválida, ponderação e cardinalidade; reconciliar com as medidas já fornecidas e com agregados oficiais do mesmo recorte. Só então produzir os resultados das perguntas.

Cuidados, lacunas e validação estão em `validacao_dados.md`; apenas inconsistências confirmadas ficam em `../InconsistencciasDados.md`.
