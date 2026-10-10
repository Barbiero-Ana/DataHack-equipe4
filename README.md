<p align="center">
  <img src="prototipo/public/PandaLogoFull.png" alt="Logo da equipe Pandas em Pânico" width="600">
</p>

<h1 align="center">Rota do Diploma</h1>

<p align="center">
  <strong>Equipe Pandas em Pânico · DataHack UNIVAG 2026</strong><br>
  Da entrada na graduação à conclusão: os caminhos do ensino superior em Mato Grosso.
</p>

<p align="center">
  <a href="https://datahack-equipe4.vercel.app">Acessar o painel</a> ·
  <a href="https://github.com/Barbiero-Ana/DataHack-equipe4">Repositório</a> ·
  <a href="docs/roteiro_apresentacao.md">Apresentação dos resultados</a>
</p>

---

## Sobre o projeto

O **Rota do Diploma** transforma dados educacionais em visualizações que ajudam a compreender a trajetória dos estudantes no ensino superior de Mato Grosso. Desenvolvido pela equipe **Pandas em Pânico**, o projeto reúne informações do INEP e do IBGE para investigar desistência, conclusão, qualidade dos cursos, financiamento e distribuição da oferta presencial.

Nossa pergunta central é: **onde a trajetória até o diploma se interrompe e quais condições estão associadas a essa perda?**

O painel permite explorar os resultados por curso, área, rede, modalidade e município, conforme as dimensões disponíveis em cada análise. O objetivo é apoiar a leitura crítica dos dados e identificar onde aprofundar a investigação sobre acesso e permanência.

## As perguntas que orientam a análise

| Página | O que buscamos compreender | Dados utilizados |
| --- | --- | --- |
| **P1 · Trajetória** | Quanto da turma desistiu, concluiu ou continuava estudando? | Trajetória |
| **P2 · Cursos e áreas** | Onde a desistência é maior? | Trajetória |
| **P3 · Rede e modalidade** | Como matrículas e evasão anual variam entre pública/privada e presencial/EAD? | Censo da Educação Superior |
| **P4 · Qualidade** | Existe associação entre qualidade do curso e desistência? | CPC + Trajetória |
| **P5 · Licenciaturas** | Como se apresentam a trajetória e a proficiência dos avaliados? | Enade + Trajetória |
| **B1 · Oferta municipal** | Como as vagas presenciais se distribuem em relação à população jovem? | Censo da Educação Superior + população municipal |
| **B2 · Financiamento** | Como financiamento estudantil e resultados dos cursos se relacionam? | Censo da Educação Superior + Trajetória |

## Os dados do projeto

O acompanhamento principal considera a **coorte de ingressantes de 2015 em cursos presenciais de Mato Grosso**, observada até **2024**. Uma coorte é o grupo que ingressou em um mesmo ano e é acompanhado ao longo do tempo.

As demais análises utilizam períodos próprios: Censo da Educação Superior de 2021–2024, CPC de 2021–2023, arquivo Enade de licenciaturas de 2025 e população municipal do Censo Demográfico de 2022. Esses universos são identificados nas visualizações para evitar comparações entre grupos incompatíveis.

### Retrato da trajetória

No recorte completo publicado em **10/10/2026**, antes dos filtros:

| Situação em 2024 | Vínculos | Percentual |
| --- | ---: | ---: |
| Desistiram do curso | 25.039 | **59,9%** |
| Concluíram | 16.220 | **38,8%** |
| Permaneciam | 544 | **1,3%** |

A análise publicada reúne **41.832 ingressantes em 500 cursos**. Os percentuais utilizam o denominador de **41.803**, ajustado por 29 falecimentos. Desistência do curso inclui transferências e não significa necessariamente abandono do ensino superior.

### Oferta e população jovem

Para 2022, o recorte possui **84.508 vagas presenciais em 42 municípios com registros de oferta**. O cruzamento populacional abrange os **141 municípios de Mato Grosso**, que somam **397.671 jovens de 18–24 anos**.

O indicador **vagas por 100 jovens** relaciona a oferta presencial à população municipal do mesmo ano. Ele mede oferta relativa, não a proporção de moradores efetivamente matriculados. Ausência de registro de oferta não é tratada automaticamente como oferta zero.

## Como trabalhamos os dados

Os códigos de leitura, limpeza, filtro, integração e validação estão disponíveis em [pipelines/](pipelines/). Utilizamos **Python e pandas** para padronizar campos e códigos, conferir duplicidades, validar chaves e construir os indicadores.

As taxas agregadas são calculadas pela divisão dos totais de numeradores e denominadores, respeitando o tamanho dos grupos. Nos cruzamentos, conferimos a correspondência entre cursos e instituições ou entre municípios, registrando a cobertura e as exclusões.

Os produtos publicados no banco são comparados com os cálculos em pandas, e os filtros da API são verificados. Na população municipal, foram reconciliados **423 valores de idade em 141 municípios**, com conferência do total estadual.

A organização em **control, raw, staging e analytics** mantém a rastreabilidade desde o arquivo de origem até o indicador apresentado. O painel oferece consulta pela API e um modo de dados fixos reais, calculados previamente.

## Como interpretar os resultados

- **Taxa e cobertura são medidas diferentes:** a quantidade de cursos analisados informa o universo disponível, não o desempenho desses cursos.
- **Associação não demonstra causa:** CPC e financiamento podem ser comparados com a trajetória, mas os cruzamentos não identificam causas individuais de desistência.
- **Trajetória e Enade são populações distintas:** não multiplicamos suas taxas como se acompanhassem as mesmas pessoas.
- **Indisponível não é zero:** ausências e divisões inválidas são preservadas. A estimativa anual de 2021 depende do Censo 2020, ausente na carga atual.
- **Filtros alteram o recorte:** os números devem ser apresentados com seu período, universo e denominador.

## Fontes e referências

Os períodos abaixo descrevem os arquivos utilizados pelo projeto. Os portais oficiais oferecem os dados e a documentação metodológica; o [inventário](docs/data_inventory.md) registra a execução das bases locais.

| Fonte | Recorte utilizado | Referência |
| --- | --- | --- |
| INEP · Indicadores de Trajetória | Coorte 2015, acompanhamento até 2024 | [Metodologia dos indicadores de fluxo](https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2017/metodologia_indicadores_trajetoria_curso.pdf) |
| INEP · Censo da Educação Superior | 2021–2024; oferta municipal de 2022 | [Microdados do Censo da Educação Superior](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior) |
| INEP · Conceito Preliminar de Curso | Edições 2021–2023 | [Indicadores de Qualidade da Educação Superior](https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior/indicadores-de-qualidade-da-educacao-superior) |
| INEP · Enade | Arquivo de licenciaturas de 2025 fornecido ao projeto | [Indicadores de Qualidade da Educação Superior](https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-de-qualidade-da-educacao-superior/indicadores-de-qualidade-da-educacao-superior) |
| IBGE · Censo Demográfico | População municipal de 18–24 anos, 2022 | [SIDRA · Tabela 9514](https://sidra.ibge.gov.br/tabela/9514) |

A estimativa anual da P3 segue o balanço de matrículas descrito em [Cadernos ABMES 25](https://abmes.org.br/arquivos/publicacoes/Cadernos25.pdf). Fórmulas, denominadores e limites estão detalhados nos [contratos dos indicadores](docs/formulas_indicadores.md).

## Explore o repositório

| Conteúdo | Link |
| --- | --- |
| Código completo do projeto | [DataHack-equipe4 no GitHub](https://github.com/Barbiero-Ana/DataHack-equipe4) |
| Painel e visualizações | [Frontend](prototipo/) |
| API e persistência | [Backend](backend/) |
| Leitura, limpeza e análise em Python | [Pipelines](pipelines/) |
| Fórmulas e critérios dos indicadores | [Metodologia](docs/formulas_indicadores.md) |
| Conferência dos gráficos e produtos | [Gráficos reais](docs/graficos_reais.md) |
| Cruzamento populacional do B1 | [População municipal](docs/populacao_municipal.md) |
| Inconsistências confirmadas nas bases | [Inconsistências dos dados](InconsistencciasDados.md) |
| Roteiro para apresentar os resultados | [Apresentação](docs/roteiro_apresentacao.md) |
| Instruções para executar e validar | [Backend](backend/README.md) · [Frontend](prototipo/README.md) · [Validação pelo terminal](docs/validacao_terminal.md) |

Os arquivos brutos volumosos e as saídas locais de processamento não fazem parte do histórico do repositório. O código, as regras de tratamento, os testes e a documentação permitem inspecionar como os resultados foram construídos.

---

**Pandas em Pânico** · Equipe 4 · DataHack UNIVAG 2026
