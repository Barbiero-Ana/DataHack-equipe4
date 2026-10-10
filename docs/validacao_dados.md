# Validação, cuidados metodológicos e próximos passos

Revisão de 10/10/2026. Recorte de análise: Mato Grosso. Evidências: `outputs/quality/manifest.json`, `diagnostics.json`, `trajectory_diagnostics_MT.parquet` e `docs/data_inventory.md`. Código reproduzível em `pipelines/`.

Foram lidas integralmente 14 tabelas, totalizando **2.734.185 linhas de dados nacionais**. O ODS da trajetória foi catalogado como alternativa, sem uma segunda carga. As linhas não correspondem a pessoas distintas: existem anos, dimensões e instituições repetidos legitimamente.

## A tabela de idades complementa o Censo 2022

O vínculo solicitado está implementado em `pipelines/integrate.py`. Usamos o **Censo da Educação Superior 2022** disponível no projeto e a população de 2022 identificada na aba contextual de `Idades_tratadas.xlsx`. A população é agregada por UF; não foi inventada uma distribuição municipal.

Contrato: selecionar MT (`CO_UF = 51`), referência 2022, cursos presenciais (`TP_MODALIDADE_ENSINO = 1`) e dimensão 1; validar uma linha por curso; agregar a oferta por UF/ano; só então juntar a população com `validate="one_to_one"`. A escolha de dimensão fica explícita e deve ser confirmada no dicionário antes da publicação de indicadores.

| Campo do resultado estadual | Valor |
| --- | ---: |
| Ano | 2022 |
| Cursos presenciais | 785 |
| Matrículas presenciais, de todas as idades | 95.355 |
| Vagas presenciais | 84.508 |
| População 18–19 anos | 108.126 |
| População 20–24 anos | 289.545 |
| População 18–24 anos | 397.671 |

Saída: `outputs/quality/population_census_2022_MT.parquet`. A junção gera **uma linha estadual**, sem multiplicar o denominador pelos cursos. Os testes rejeitam ano incorreto, população duplicada, cursos repetidos e medidas ausentes.

A planilha existente não está faltando: ela está disponível, processada e ligada ao mesmo ano. **Falta somente a granularidade municipal para o bônus 1.** Seus 33 registros são Brasil, cinco regiões e 27 UFs; não existem linhas/códigos de municípios. O Censo educacional possui oferta municipal, mas `QT_MAT_18_24` conta matrículas de estudantes nessa faixa, não a população residente. Matrículas podem incluir pessoas mais velhas, estudantes de outros municípios e vínculos distintos. Não usar essa coluna como população, nem repetir os 397.671 moradores de MT como denominador de cada município.

## Erros e riscos encontrados

| ID | Evidência | Efeito sobre filtros/análise | Tratamento / estado |
| --- | --- | --- | --- |
| E01 — erro numérico de origem | CPC 2022, linha 250, curso `1517`, IES `18`, município `4314407`: `#NÚM!` na proporção de participantes com nota no Enem | Conversão silenciosa para zero geraria medida falsa | Valor original preservado, medida nula e erro registrado. Fora de MT; não impede o recorte atual, mas exige tratamento numa carga nacional |
| E02 — enum com significado diferente | `TP_REDE`: 1 pública/2 privada; categoria administrativa 2 corresponde a pública estadual | Aplicar o mesmo mapa às duas colunas classificaria instituições públicas como privadas | Corrigido no código; original preservado; rede padronizada com origem. Zero conflitos detectados no staging atual |
| E03 — números e texto misturados | Trajetória contém enums `1` e `1.0`; CPC 2022 tem vírgulas decimais; textos têm caracteres invisíveis | Filtros exatos deixam cursos de fora, notas podem virar texto e categorias se fragmentam | Normalização aplicada e coberta por testes. As 515 linhas finais presenciais de MT são encontradas após normalizar o enum |
| E04 — rodapés tratados como dados | Notas sobrescritas `¹`/`²` no Enade e contagem isolada ao fim do CPC 2022 | Geravam falsas chaves ausentes, falsos erros de ano e duplicatas | Separados e registrados no manifest; não foram apagados dos originais |
| E05 — categorias especiais | 49 linhas de IES nacionais de 2021/2022 sem rede binária disponível, classificadas administrativamente como especial | Preencher ausência como privada distorce os grupos | `REDE_PENDENTE = true`; sem imputação. São registros instituição/ano, não 49 estudantes ou necessariamente 49 IES distintas |
| E06 — geografia e dimensão | Censo contém dimensões 1–4; dimensão 2 tem matrículas e vagas zero, dimensão 3 concentra vagas sem localização em MT | Somar dimensões ou interpretar todo zero como ausência de oferta distorce totais, sobretudo EAD | Dimensão integra a chave e fica explícita nos filtros. Sem atribuição artificial de vagas nacionais à UF da sede. Significado oficial ainda requer confirmação |
| E07 — sede diferente da oferta | 57.947 linhas de cursos ofertados em MT, entre 2021–2024, vinculadas a IES sediadas fora de MT | Filtrar pela sede excluiria grande parte da oferta EAD em MT | Curso–IES ligado por IES/ano; geografia de oferta preservada. Contagem é de linhas por município/ano, não de alunos |
| E08 — coorte única | Trajetória só contém ingressantes de 2015, com referências até 2024 | Nome do arquivo pode induzir a interpretar 2015–2024 como dez coortes | Lacuna real para comparar coortes na pergunta 2. Comparações entre cursos/áreas da coorte 2015 continuam possíveis |
| E09 — limite de acompanhamento | 877 observações de MT, em 331 cursos, posteriores a `NU_ANO_MAXIMO_ACOMPANHAMENTO` | Valores mantidos após o limite podem parecer acompanhamento novo | Flag `_AFTER_MAXIMUM_FOLLOWUP` nos diagnósticos. Não é prova de erro de origem; regra de uso ainda precisa da metodologia |
| E10 — fluxo anual versus acumulado | Ingressantes repetem a coorte; concluídos/desistentes/falecidos são anuais; TCA/TDA são acumuladas | Somar ingressantes entre anos ou misturar fluxos e taxas gera denominadores e perdas falsos | Reconciliação das cinco taxas com contagens/denominador ajustado passou no recorte MT. Agregar por numerador/denominador, sem média simples |
| E11 — SC e ausências | No recorte: 6 CPC SC em 2021, 24 em 2022 e 11 em 2023; 6 Enade SC em 2025 | SC convertido em zero entra falsamente como nota baixa ou proficiência nula | Status preservado e medida nula; declarar exclusões e denominador na análise. Os totais de SC referem-se a registros das edições |
| E12 — proficiência em outra escala | Enade usa proporção 0–1 apesar do título “percentual” | Confundir 0,727 com 0,727% ou 72,7 na escala de proporção altera resultados em cem vezes | Faixa 0–1 e razão proficientes/participantes verificadas; percentual só na apresentação |
| E13 — cobertura parcial dos cruzamentos | CPC alcança 398/515 cursos da trajetória (77,28%); Enade alcança 68/99 licenciaturas elegíveis (68,69%) | Inner join silencioso elimina cursos e pode enviesar conclusões | Medir cobertura e guardar os não encontrados; esclarecer ciclo/ano, encerramentos e diferenças de população. Não atribuir automaticamente ausência a falha no arquivo |
| E14 — denominador de cobertura errado | Enade alcança 68/515 cursos gerais (13,20%), mas a fonte é de licenciaturas | Apresentar 13,20% como cobertura das licenciaturas sugeriria uma lacuna maior que a observada | Diagnóstico específico das 99 licenciaturas adicionado. Cobertura por código não garante alinhamento temporal |
| E15 — esquema muda entre anos | Cursos: 200 colunas em 2021/2022, 202 em 2023 e 223 em 2024; em 2024 três campos RVETNICO desaparecem e surgem categorias específicas | Coluna ausente pode virar zero ou ser somada a categorias incompatíveis | Diferenças catalogadas. Não agregar categorias novas/antigas sem correspondência metodológica validada |
| E16 — fontes de anos diferentes | CPC 2021–2023, Enade 2025, trajetória da coorte 2015 até 2024 | Junções sem edição podem multiplicar registros ou criar um funil fictício de pessoas | Exigir contrato temporal. No conjunto CPC atual não foram detectadas duplicatas por curso/edição; o risco de multiplicação continua relevante para novas edições |
| E17 — financiamento e causalidade | Contagens FIES/ProUni são agregadas por curso; exclusividade dos benefícios ainda não confirmada | Somar benefícios pode contar alunos mais de uma vez; associação não prova efeito sobre desistência | Manter medidas separadas; confirmar dicionário e ano de comparação antes do bônus 2 |
| E18 — geografia nula e junções pandas | Dimensões agregadas têm município/UF ausente; pandas pode casar chaves nulas entre si | Preencher pela sede ou aceitar NULL = NULL cria correspondências falsas | Zeros geográficos viram ausência; auditoria de cobertura exclui chaves nulas e informa sua contagem |
| E19 — formatos alternativos | Trajetória XLSX e ODS; XML do ODS supera 1 GB descompactado | Carregar ambos pode duplicar a base e sobrecarregar a memória | Apenas XLSX carregado; ODS catalogado. Igualdade entre formatos não foi comprovada |

## O que já foi validado

- Leitura completa dos arquivos selecionados, rastreabilidade por arquivo/linha e hashes dos originais antes/depois.
- Cabeçalhos/aliases sem colisões; chaves obrigatórias; duplicatas entre lotes; contagens não negativas e inteiras; faixas das taxas e das medidas com escala conhecida.
- Nenhuma duplicata nas chaves técnicas verificadas; nenhuma falha técnica detectada nos quatro Censos pelas regras implementadas. Isso **não certifica todas as relações possíveis entre as 223 colunas**.
- Trajetória MT: tamanho da coorte constante, referências sem lacunas, denominadores ajustados positivos, taxas acumuladas sem quedas e cinco fórmulas reconciliadas, com tolerância de arredondamento.
- Curso–IES: 660/660 pares IES/ano do recorte encontraram correspondência, sem multiplicação por chave.
- Enade: proficientes não superiores aos participantes, escala de proporção válida e coerência da razão com as contagens, dentro da tolerância.
- População + oferta: mesma UF/ano, soma das faixas 18–19 e 20–24, uma linha de população, agregação antes da junção e cardinalidade 1:1.
- Testes automatizados de casos perigosos e Ruff. O gráfico Seaborn de ausências diferencia coluna inexistente de valor ausente; ausências não são automaticamente erros.

Não foram encontrados erros que impeçam o processamento local atual. Há um erro numérico real fora de MT e pendências que impedem aprovar **todos os indicadores finais**. O backend HTTP e uma futura carga no banco ainda não devem apresentar essas bases como integralmente homologadas.

## Validação e próximos passos

1. **Fechar os contratos das perguntas.** Confirmar dicionários por edição, dimensões, categoria especial, significado de desistência/transferência, limite de acompanhamento, fórmula de evasão anual e janela CPC/Enade. Registrar chave, filtros, numerador e denominador por indicador. A população estadual de 2022 já está integrada.
2. **Construir tabelas analíticas aprovadas, separadas do staging.** Criar dimensões de curso, IES, município, rede, modalidade e edição; fatos de Censo por curso/local/ano, trajetória por curso/coorte/referência e avaliações por curso/edição. Não usar a sede como localização da oferta. Preservar proveniência e regras de revisão.
3. **Priorizar perguntas 1 e 3.** Implementar os cálculos em Python versionado e comparar totais antes/depois de cada filtro e junção. Conferir a trajetória com numeradores e denominadores; a pergunta 3 depende da definição de evasão anual. Depois, avançar CPC/Enade e financiamento com relatórios de cobertura e sensibilidade.
4. **Completar somente as lacunas necessárias.** Outras coortes para a comparação entre coortes; população municipal 18–24 de 2022 e universo completo de municípios para o bônus 1. Começar o bônus por esse universo e fazer left join da oferta, para incluir municípios sem cursos; só preencher oferta zero quando a fonte e a cobertura confirmarem ausência.
5. **Validar em três níveis.** Técnico: tipos, chaves, hashes e cardinalidade. Estatístico: totais, outliers, ausências e diferenças por rede/modalidade/ano. Metodológico: população, dimensão, edição e fórmulas oficiais. Reconciliar totais com agregados oficiais do mesmo recorte; revisar também cursos sem correspondência, não apenas os que casam.
6. **Só então carregar e servir os dados.** Criar migrations para os modelos aprovados, carga idempotente com lote/hash, registros de rejeição e transação. Testar os filtros da API contra os resultados pandas e assegurar que a paginação não altera totais. Suprimir células com menos de dez alunos na publicação, conforme o desafio.

Comandos de reprodução, da raiz:

```sh
backend/.venv/bin/python -m pipelines.run
backend/.venv/bin/python -m pipelines.catalog
backend/.venv/bin/python -m pytest pipelines/tests -q
backend/.venv/bin/ruff check pipelines --config pipelines/pyproject.toml
```

Não é necessário reler os originais para consultar este diagnóstico. Dados e saídas continuam fora do Git; versionar o código, este documento e os inventários leves. Não houve imputação municipal, remoção silenciosa de cursos ou escrita no banco.
