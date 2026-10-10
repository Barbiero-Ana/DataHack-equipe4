# Migração organizada para PostgreSQL

## Estado atual

Implementados o carregador `pipelines/load.py`, as consultas `pipelines/query.py`, a migration
`0002_ingestion` e SQL versionado em `sql/`. FastAPI/SQLAlchemy continuam responsáveis pelo
backend HTTP; a ingestão usa psycopg com conexão dedicada e timeout próprio.

A versão inicial carrega as seis famílias selecionadas pela limpeza: cursos, IES, trajetória,
CPC, Enade e população. Raw recebe os valores extraídos novamente dos originais, antes da
limpeza, no recorte MT; IES são nacionais. Os originais completos e seus hashes são a
referência física, inclusive notas, cabeçalhos e linhas nacionais fora do recorte.

O staging inicial usa **`staging.record`**, um contrato técnico versionado, com códigos,
anos e contagens centrais tipados e payload normalizado completo. As tabelas definitivas
por família abaixo continuam propostas, dependentes dos dicionários oficiais.
`Base.metadata` não modela esse staging provisório; não use autogenerate para removê-lo.

Analytics já tem dois produtos diagnósticos: `annual_mt` (pergunta 3) e
`population_census_mt` (junção estadual de 2022). Os outros produtos analíticos ainda precisam
de implementação e contratos próprios. O backend HTTP oferece health checks e os endpoints `/api/v1/analytics/catalog`, `/annual` e `/population`; o protótipo React integra os produtos publicados, com os limites dos recortes indicados na tela.

O destino é um PostgreSQL com quatro schemas, e a publicação é uma troca transacional do
ponteiro `control.active_release` após validar SQL × pandas. Veja
[o roteiro de terminal](validacao_terminal.md) para executar carga, filtros e validação.

## Papel de cada camada

| Camada | Responsabilidade | Conteúdo proposto |
| --- | --- | --- |
| `control` | Orquestrar e auditar todas as etapas | Arquivos, hashes, lotes, versões do código/regras, contagens, problemas e publicações |
| `raw` | Preservar registros antes da limpeza | Valores extraídos com nomes originais, arquivo/aba/linha e identificação do recorte |
| `staging` | Aplicar tipos, padronização e validações | Censo de cursos/IES, trajetória, CPC, Enade e população com granularidade explícita |
| `analytics` | Servir dados analíticos aprovados | Dimensões, indicadores, numeradores/denominadores, cobertura e versão da publicação |

O fluxo dos registros é **fonte → raw → staging → analytics**. `control` acompanha esse fluxo; não é uma cópia anterior dos dados. Nenhuma etapa deve transformar dados limpos em “raw” apenas mudando o schema.

A carga reaproveita pandas para leitura/limpeza verificável, confere o Parquet contra os valores relidos dos originais e persiste raw antes de staging. SQL calcula os dois produtos analíticos. A publicação valida resultados e filtros contra pandas.

## Escopo de armazenamento

Proposta inicial coerente com o recorte do projeto: registros de oferta/indicadores de MT e IES necessárias às relações; arquivos nacionais originais arquivados integralmente fora do Git. O recorte de ingestão fica registrado em `control`, junto das contagens nacionais lidas e das linhas selecionadas. Não apresentar uma carga de MT como uma carga nacional completa.

Quando a oferta é em MT, a IES pode ser de outro estado. A seleção das IES deve partir dos códigos dos cursos selecionados, não apenas da UF da sede. Idades estaduais não viram população municipal. Dados 2020, quando incorporados, servem como base da estimativa de 2021; a janela de apresentação continua 2021–2024.

O tamanho da carga deve ser medido em banco de teste antes de escolher carregar todas as linhas nacionais. Não pressupor que JSONB, índices e cópias intermediárias ocuparão o mesmo espaço do CSV. Arquivo completo e metadados de localização/hash precisam de backup e armazenamento persistente antes de depender da reprodução no ambiente publicado; uma pasta local ignorada pelo Git não é, sozinha, esse backup.

## Modelagem incremental

As tabelas técnicas implementadas estão definidas em `sql/0002_ingestion.sql`. As tabelas de domínio por família na seção Staging ainda são proposta.

### Control

| Tabela | Campos/garantias essenciais |
| --- | --- |
| `control.source_file` | Identificador, família da base, edição, nome, SHA-256, tamanho, localização do original, formato, metadados/abas e recorte |
| `control.ingestion_run` | Identificador da tentativa conjunta, fingerprint de fontes/Parquet/código, regras, início/fim, estado e tipo seguro de falha |
| `control.release_source` | Associação da versão com cada arquivo e contagem de registros retidos |
| `control.quality_issue` | Lote, registro de origem, regra, campo, severidade, motivo e estado de revisão; referência ao valor original em raw |
| `control.dataset_release` | Publicação analítica, contratos, lotes/fontes associados, estado, validações e datas; histórico preservado |
| `control.active_release` | Ponteiro para a publicação aprovada que a API deve usar; troca transacional |

Separar identidade de conteúdo do arquivo de tentativas de processamento. O mesmo hash não impede reprocessar com novas regras, mas não deve gerar uma segunda cópia de cada registro raw. Registrar formatos alternativos como não carregados; não assumir equivalência XLSX/ODS sem comparação.

### Raw

A tabela inicial `raw.source_row` guarda `source_file_id`, aba, linha de origem, classificação da linha e payload JSONB com os nomes/valores originais. A chave única é arquivo + aba + linha. Não normalizar enum, texto, SC ou erro Excel nesta etapa. Não criar índices sobre todos os campos do payload; projetar índices conforme as consultas reais.

O JSONB preserva os valores extraídos, não todos os detalhes físicos/visuais do CSV/XLSX; o arquivo completo é a referência exata. Cabeçalhos, notas e linhas retiradas da tabela de dados permanecem no original e no registro de metadados/rejeições. Uma falha de parsing do arquivo deve ser registrada sem desaparecer silenciosamente.

O leitor separa notas/linhas vazias da tabela de dados e preserva seu contexto nos metadados registrados em `control.source_file`. Raw guarda as linhas de dados retidas, com nomes e valores anteriores à limpeza, linha e aba originais. O arquivo completo preserva o conteúdo físico das demais linhas.

### Staging

| Tabela proposta | Granularidade |
| --- | --- |
| `staging.censo_curso` | curso + IES + ano + dimensão + localização |
| `staging.censo_ies` | IES + ano |
| `staging.trajetoria` | curso + IES + coorte + referência |
| `staging.cpc` | curso + edição |
| `staging.enade` | curso + edição |
| `staging.populacao` | unidade geográfica + ano + faixa etária, com nível geográfico declarado |

Todas recebem lote/registro raw de origem. Chaves e índices precisam considerar a versão da carga; chaves com localização nula exigem tratamento explícito para que duplicatas não passem pela constraint. Não usar zeros artificiais para completar geografia.

Tipos: códigos em texto; contagens em inteiros de capacidade adequada; anos em inteiros; medidas decimais com precisão definida; ausências em NULL; SC/categoria especial em campos de estado. Manter rede e categoria administrativa como conceitos distintos. Selecionar inicialmente os campos necessários às perguntas; as demais variáveis continuam recuperáveis no raw e no arquivo original.

Categorias da IES/curso podem mudar entre fontes/anos. Preservar os atributos de cada edição; não substituir o passado pela classificação mais recente. Não fechar os modelos definitivos antes de confirmar dicionários e significado de dimensões, vagas, financiamento e acompanhamento.

Falhas técnicas ficam rastreáveis em `control.quality_issue` e não entram nas tabelas analíticas aprovadas. Pendências metodológicas não são automaticamente erros de registro: identificar separadamente categoria não resolvida, limite de acompanhamento e indicador não disponível. Não eliminar todas essas linhas indiscriminadamente.

### Analytics

Começar pelos produtos concretos: dimensões de rede/modalidade/ano e identificadores de curso/IES; fatos de trajetória; tabela da pergunta 3 por UF/ano/rede/modalidade. Acrescentar município quando seu universo estiver disponível, e avaliações/financiamento conforme os contratos forem fechados.

A pergunta 3 deve guardar matrículas, ingressantes, concluintes, desvinculações, medidas do ano anterior, numerador, denominador, estimativa, estado/motivo de ausência, versão da fórmula e publicação. Estimativa de 2021 sem 2020 permanece NULL com motivo; as quantidades de 2021 continuam disponíveis. Não converter pendência em taxa zero.

Não é necessário multiplicar tabelas por cada gráfico. Criar fatos reutilizáveis e agregações correspondentes a perguntas reais. O resultado precisa dizer qual universo representa e quais registros não participaram da junção/cálculo.

## Sequência de desenvolvimento e carga

A sequência abaixo é o plano de evolução; migrations, carga técnica e os dois produtos diagnósticos já estão implementados. A API e os demais modelos permanecem próximos passos.

1. **Inventário somente leitura do banco.** Usar `scripts/check_database.py`, conferir schemas, tabelas e revisão Alembic. O código de conexão já existe. Não assumir que a migration preparada foi aplicada.
2. **Migration de controle e raw.** Desenvolver os modelos técnicos, constraints/índices e a próxima revisão Alembic. Usar SQLAlchemy com schema explícito. Rever o SQL offline e executar em PostgreSQL descartável antes de aplicar no principal.
3. **Carregador de um lote real pequeno.** Começar pela tabela estadual de idades 2022: registrar origem/hash, persistir raw, transformar, validar e carregar staging. Usar esse lote para testar falha, retomada e reprocessamento. Depois ligar ao Censo 2022 no mesmo nível geográfico.
4. **Carga dos Censos por arquivo/ano.** Fazer lotes com tamanho controlado, registrar contagens e carregar com psycopg `COPY FROM STDIN` quando adequado. Não usar uma conexão do pool HTTP para um trabalho longo. Definir timeout próprio do processo de ingestão; o timeout curto atual é da API. [COPY PostgreSQL 18](https://www.postgresql.org/docs/18/sql-copy.html).
5. **Staging tipado e validação no banco.** Confirmar dicionários, criar migrations das famílias necessárias e reaproveitar as funções pandas. Checar contagens/valores/chaves contra os Parquet existentes; comparar sem arredondar previamente os indicadores.
6. **Publicação analítica da pergunta 3.** Gerar uma versão candidata com os mesmos contratos de `pipelines/annual.py`. Conferir SQL × pandas, cobertura, numeradores/denominadores e motivos de ausência. Investigar o pico de desvinculações públicas presenciais de 2023 antes de interpretá-lo.
7. **API de filtros/indicadores.** Implementar repository para consultar analytics, service para regras/contrato e router/Pydantic para entrada/saída. Filtros iniciais: ano, rede e modalidade; curso/município conforme o fato permita. Retornar versão, disponibilidade e motivos; não omitir 2021 silenciosamente.
8. **Expandir os outros produtos.** Trajetória/pergunta 1, associações CPC/Enade e financiamento, com contratos próprios. Comparação entre coortes e bônus municipal seguem suas lacunas, sem bloquear as medidas disponíveis.

Migrations alteram estrutura; loaders carregam dados; transformações calculam tabelas analíticas. Não colocar os datasets inteiros numa revisão Alembic nem rodar cargas ou migrations no startup da API. [Tutorial Alembic](https://alembic.sqlalchemy.org/en/latest/tutorial.html).

## Reexecução, falhas e publicação

- Arquivo inalterado, parser/regra/recorte iguais e lote concluído: retornar a carga existente. Novas regras geram nova execução vinculada ao mesmo raw.
- Inserções raw têm unicidade por origem. Usar área temporária e resolução explícita de conflitos; `COPY` sozinho não é um upsert. [INSERT/ON CONFLICT PostgreSQL 18](https://www.postgresql.org/docs/18/sql-insert.html).
- Na versão implementada, uma falha reverte todo o lote candidato, inclusive inserções raw novas. A tentativa com falha fica registrada em transação separada; a repetição recarrega o lote inteiro. Retomada por chunks é evolução futura.
- Staging/analytics candidatos ficam associados ao lote/publicação. A API só vê a versão aprovada. Trocar o ponteiro ativo numa transação depois de conferir todos os produtos dependentes; a API deve usar o mesmo release em consultas relacionadas.
- Uma versão com valores indisponíveis pode ser publicada se o contrato admite essa ausência e a API informa o motivo. Não publicar um conjunto tecnicamente incompleto como concluído.
- Não usar `TRUNCATE` global nem `to_sql(if_exists="replace")` nas tabelas principais. Conservar a publicação anterior para reversão do ponteiro; definir retenção depois de validar volume/backup.
- Credenciais de loader e API são separadas: a API recebe leitura dos objetos analíticos aprovados, não escrita em raw/staging. Logs mostram lote/regra/contagens, nunca DATABASE_URL ou credenciais.

## Critérios de aceite da próxima entrega

- SQL e modelos revisáveis, migrations verificadas em banco descartável e plano de aplicação explícito.
- Um lote real percorre raw e staging, com arquivo/hash/linha recuperáveis.
- Executar duas vezes não duplica registros; simular falha não altera a publicação ativa; nova regra pode ser reprocessada.
- Contagens de linhas extraídas, selecionadas, carregadas e rejeitadas são reconciliadas, sem perdas silenciosas.
- Campos técnicos/enums/NULL/SC mantêm o significado e as medidas conferem com a preparação local.
- A instrução atual do usuário autoriza aplicar a carga e viabilizar consultas pelo terminal, após os testes locais. O resultado efetivo da execução está no registro `execucao_persistencia.md`; não confundir implementação preparada com carga efetivamente concluída.

Essa entrega é **persistência da ingestão e rastreabilidade**. Em seguida vêm staging das famílias, analytics e endpoints. Não é necessário concluir todos os indicadores para começar control/raw, nem carregar todos os arquivos de uma vez.
