# Regras de preparação e revisão

Originais em `dados/`, preservados; código em `pipelines/`; evidências leves em `docs/`; tabelas e gráficos locais em `outputs/quality/`, fora do Git. Não houve carga no PostgreSQL ou alteração de endpoints.

## Limpeza conservadora

CSV: separador `;`, CP1252, leitura em lotes inicialmente como texto. XLSX: leitura contínua e cabeçalho técnico da trajetória. Notas, vazios e contagem isolada no rodapé do CPC 2022 são separados com registro no manifest. Abas contextuais e atualizações ficam catalogadas, com prévia de até 100 linhas e indicação de truncamento.

Cabeçalhos usam aliases explícitos; colisões interrompem o arquivo. Removemos espaços externos, BOM e caracteres de largura zero. Códigos ficam como strings, mantendo zeros iniciais do CINE. Removemos apenas `.0` de identificadores/enums provenientes do Excel. Código geográfico `0` vira ausência; nunca recebe a localização da sede.

Vírgulas decimais são convertidas. Medidas usam números anuláveis; contagens inteiras viram `Int64`. Marcadores `SC`, `-` e similares ficam preservados em campos `_ORIGINAL_*` das medidas numéricas. Valores não interpretáveis são sinalizados, sem virar zero. Notas brutas não recebem indiscriminadamente o limite 0–5.

## Rede pública e privada

`TP_REDE`: **1 = pública; 2 = privada**, conforme a orientação do projeto. Preservamos o campo original e acrescentamos `TP_REDE_PADRONIZADA`, `DS_REDE` (`publica`/`privada`), `REDE_ORIGEM` e `REDE_PENDENTE`.

`TP_CATEGORIA_ADMINISTRATIVA` usa outro enum: 1 federal, 2 estadual e 3 municipal são públicas; 4 e 5 são privadas. Conferimos a correspondência cruzando todas as IES do Censo 2022 com os nomes administrativos do CPC 2022. Algumas subcategorias privadas mudam entre edições, sem mudar a classificação binária.

Quando presente, `TP_REDE` é a referência principal. Contradições com categorias conhecidas acionam `_NETWORK_CONFLICT` e revisão. Sem rede, usamos a categoria ou seu texto. Categoria 7 aparece como “Especial” no CPC: sem rede original, permanece pendente. Não converter ausência ou categoria desconhecida em privada. Dicionários completos ainda precisam ser incorporados.

## Chaves e geografia

| Base | Chave técnica |
| --- | --- |
| Cursos do Censo | ano + dimensão + IES + curso + região + UF + município |
| IES | ano + IES |
| Trajetória | IES + curso + coorte + referência |
| CPC/Enade | curso + edição |

Duplicatas são contadas entre lotes e preservadas com flags. Curso–IES usa ano e `many_to_one`. A cobertura CPC/Enade por código é diagnóstica: a junção final deve selecionar edição, população e chaves não nulas.

O Censo apresenta `TP_DIMENSAO` 1–4. Na inspeção, dimensão 3 concentra vagas sem localização em MT, enquanto dimensão 2 tem matrículas distribuídas geograficamente e vagas zero. Não interpretar esses zeros como falta de vagas EAD, nem atribuir vagas nacionais à sede da IES. Esses padrões observados não substituem o dicionário. Há oferta em MT vinculada a IES de outros estados.

## Trajetória e indicadores

A trajetória acompanha **somente a coorte 2015**, em referências 2015–2024. O nome do arquivo não implica várias coortes. Ingressantes repetem a mesma coorte em cada referência; concluídos, desistentes e falecidos são fluxos anuais, permanência é estoque e TCA/TDA são acumuladas.

Conferimos as cinco taxas com numeradores e denominador descontado dos falecimentos acumulados, com tolerância de arredondamento. Agregar por numeradores/denominadores, sem média simples de taxas ou soma de ingressantes entre anos. O cabeçalho técnico usa `TADA`, embora a descrição visual diga TDAN. Observações após `NU_ANO_MAXIMO_ACOMPANHAMENTO` ficam contadas para revisão. [Resumo técnico INEP 2024](https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_superior/resumo_tecnico_do_censo_da_educacao_superior_2024.pdf).

Enade 2025 traz proficiência em **proporção 0–1**, apesar do título “percentual”. Conferimos proficientes ≤ participantes e coerência com a proporção. SC não recebe zero. Avaliados de 2025 e ingressantes de 2015 não são as mesmas pessoas.

A tabela de idades tem Brasil, regiões e UFs; o ano 2022 consta numa aba contextual. Somamos 18–19 e 20–24 propagando ausências. Não há códigos municipais. O XLSX da trajetória foi selecionado e o ODS catalogado como alternativa, sem assumir igualdade entre os formatos. O XML do ODS supera 1 GB descompactado.

O vínculo com o Censo da Educação Superior 2022 está implementado em `pipelines/integrate.py`, por `CO_UF + NU_ANO_CENSO`, após agregar os cursos presenciais da dimensão 1. O resultado estadual tem uma linha de MT e população 18–24 de 397.671. A tabela recebida é válida como complemento estadual: a pendência é somente o detalhamento municipal exigido pelo bônus 1. `QT_MAT_18_24` do Censo educacional conta matrículas, não moradores de 18–24 anos, e não substitui o denominador populacional. Consulte `validacao_dados.md` para evidências e plano de validação, e `formulas_indicadores.md` para os contratos das medidas.

## Pendências e publicação

Obter outras coortes para a pergunta 2 e população municipal 18–24 com ano e códigos IBGE para o bônus 1. Confirmar dicionários, dimensões e categoria especial. Definir evasão anual da pergunta 3 e janela dos cruzamentos. Modalidades FIES/ProUni podem se sobrepor; mantê-las separadas até confirmar exclusividade. Associação agregada não demonstra causalidade.

Antes de carregar o banco, separar staging de tabelas aprovadas, resolver flags e definir chaves idempotentes. Antes de publicar, suprimir células com menos de dez alunos conforme o material do desafio. Dados staging e gráficos de diagnóstico não são respostas finais do desafio.
