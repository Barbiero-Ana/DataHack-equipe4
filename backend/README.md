# Backend — API e persistência

Backend modular em Python, FastAPI, Pydantic v2 e Pydantic Settings, com persistência síncrona SQLAlchemy 2.x + psycopg 3 e Alembic. As quatro camadas control, raw, staging e analytics possuem migrations e carga auditável em `../pipelines/`. A API publica os dois produtos diagnósticos de MT disponíveis na versão ativa.

A arquitetura atual prevê frontend React + Vite + TypeScript, consumindo esta API por REST/JSON, e processamento Python + pandas + SQL. Veja [o plano das quatro camadas](../docs/migracao_banco.md) para a stack completa e a evolução do monorepo.

## Execução no macOS

Após clonar o repositório e entrar na sua pasta:

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
# Somente em instalação nova; preserve um .env já configurado.
cp -n .env.example .env
uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

Python 3.12 é a versão recomendada; o projeto aceita versões posteriores. O ambiente desta implementação possui Python 3.13; os resultados locais de validação referem-se a essa versão, não a uma execução em 3.12.

Abra http://127.0.0.1:8000/docs para Swagger e `/openapi.json` para o contrato OpenAPI.

```sh
curl -i http://127.0.0.1:8000/health/live
curl -i http://127.0.0.1:8000/health/ready
python -m pytest
ruff check .
ruff format --check .
```

`/health/live` retorna 200 e `{"status":"alive"}`, sem depender do banco. `/health/ready` executa `SELECT 1` e retorna 200 com `{"status":"ready"}` quando o PostgreSQL responde. Se a consulta ou conexão falhar, retorna 503 com `detail.code=database_unavailable`, sem detalhes internos. Sem DATABASE_URL no desenvolvimento, retorna 503 com `detail.code=persistence_not_configured`.

## Configuração

As variáveis do processo têm precedência sobre `backend/.env`, localizado independentemente do diretório atual. `.env` é ignorado pelo Git; use `.env.example` como referência. A aplicação falha na criação se receber valores inválidos. DATABASE_URL é obrigatória em produção; em desenvolvimento/testes é opcional para preservar a execução sem banco da Entrega 1. O segredo é mantido em SecretStr e as mensagens de validação omitem os valores recebidos.

| Variável | Padrão | Uso |
| --- | --- | --- |
| APP_NAME | Rota do Diploma | Nome na documentação |
| ENVIRONMENT | development | development, test ou production |
| API_V1_PREFIX | /api/v1 | Prefixo dos endpoints analíticos |
| CORS_ORIGINS | [] | Lista JSON de origens HTTP/HTTPS explícitas |
| DATABASE_URL | ausente | URL PostgreSQL; obrigatória em produção |
| DB_POOL_SIZE | 3 | Conexões persistentes por processo |
| DB_MAX_OVERFLOW | 2 | Conexões extras por processo |
| DB_POOL_TIMEOUT | 5 | Espera máxima pelo pool, em segundos |
| DB_POOL_RECYCLE | 1800 | Reciclagem das conexões, em segundos |
| DB_CONNECT_TIMEOUT | 5 | Timeout de conexão psycopg, em segundos |
| DB_STATEMENT_TIMEOUT_MS | 3000 | Timeout PostgreSQL de cada comando |

Exemplo: `CORS_ORIGINS=["http://localhost:3000"]`. Origens não podem conter credenciais ou caminhos. Não são permitidos cookies CORS nesta etapa.

## Organização e decisões

`app/main.py` cria a aplicação via factory, registra middleware e routers e gerencia a engine pelo lifespan. `app/core/config.py` valida as configurações. `app/core/database.py` isola a engine, session factory e dependência FastAPI. `app/db/health.py` contém a consulta de disponibilidade; não há SQL nos routers. `app/db/base.py` fornece os metadados vazios para modelos futuros. `app/api/router.py` centraliza o registro HTTP. `app/api/v1/endpoints/health.py` define os contratos dos health checks.

O pool usa pre-ping, limites e timeouts. A criação da engine não abre conexão nem cria tabelas; o shutdown libera o pool. As sessões são fechadas ao fim da requisição e transações pendentes são desfeitas. A camada de aplicação deverá fazer commit explícito quando o caso de uso concluir. A dependência não faz commit automático. Falhas SQLAlchemy recebem 503 e geram somente um evento de log fixo, sem URLs, parâmetros ou traceback.

Health checks ficam em `/health`, fora do prefixo versionado. O router `/api/v1/analytics` publica catálogo, indicadores anuais e o cruzamento de população/Censo. Schemas Pydantic definem os contratos; services verificam disponibilidade e procedência; repositories fazem consultas parametrizadas à versão ativa. Os testes e Ruff aqui são verificações mínimas para tornar a Entrega 1 revisável, sem antecipar a infraestrutura de qualidade/publicação completa da Entrega 3.

As dependências resolvidas estão fixadas em `requirements.txt` e `requirements-dev.txt`. `pyproject.toml` declara os intervalos compatíveis e configura as ferramentas. Para executar sem ferramentas de desenvolvimento, instale apenas `requirements.txt`.

Referências: [configurações FastAPI](https://fastapi.tiangolo.com/advanced/settings/), [CORS](https://fastapi.tiangolo.com/tutorial/cors/), [SQLAlchemy/psycopg](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg) e [Alembic](https://alembic.sqlalchemy.org/en/latest/tutorial.html).

## Conexão local e migrations

Abra o túnel em outro Terminal e mantenha-o aberto:

```sh
railway connect Postgres --tunnel-only --port 51911
```

Preencha DATABASE_URL apenas em `.env`, no formato `postgresql+psycopg://USUARIO:SENHA@127.0.0.1:51911/BANCO`. Caracteres especiais no usuário/senha devem ser codificados para URL. Também aceitamos `postgresql://`, normalizado para psycopg 3 internamente. Não compartilhe o output do túnel: ele contém credenciais.

Na API no Railway, use DATABASE_URL como referência ao serviço Postgres (`${{Postgres.DATABASE_URL}}`), com endereço privado; não use localhost, porta do túnel ou URL pública nesse ambiente. Defina ENVIRONMENT=production. Nenhum deploy ou mudança de variáveis remotas é realizado nesta entrega.

Antes de qualquer migration, inspecione o banco e revise o SQL:

```sh
python -m scripts.check_database
alembic heads
alembic upgrade head --sql
```

Somente após autorização para o banco principal, execute manualmente `alembic upgrade head`. Nada roda migrations no startup ou no deploy. A primeira migration cria os quatro schemas com IF NOT EXISTS; a segunda cria o controle de carga, raw, staging técnico e os dois produtos analíticos diagnósticos. Alembic mantém public.alembic_version. O downgrade está bloqueado para preservar schemas preexistentes e possíveis dados. Veja [o plano de migração do banco](../docs/migracao_banco.md).

## Testes PostgreSQL opcionais

A suíte padrão usa mocks e SQLite somente para verificar transações SQLAlchemy; não conecta ao Railway. Os testes PostgreSQL exigem TEST_DATABASE_URL explícita, apontando para localhost e um banco com nome iniciado em test_. Use uma instância descartável e um banco dedicado, previamente criado:

```sh
TEST_DATABASE_URL='postgresql+psycopg://USUARIO@127.0.0.1:55432/test_rota_delivery2' python -m pytest -m postgres -q
```

Esses testes criam os schemas, a tabela técnica Alembic e uma tabela sentinela de teste somente no banco descartável, verificando reaplicação, preservação de dados, readiness e timeout. Não removem estruturas; descarte a instância após os testes.

## Validação local

Em Python 3.13.7: os 13 testes anteriores foram preservados; a suíte ampliada tem 27 testes sem PostgreSQL e 2 testes de integração opcionais. Todos os 29 passaram usando a instância local descartável PostgreSQL 14.20 disponível nesta máquina. `ruff check .`, `ruff format --check .` e `pip check` passaram. O Starlette emite um aviso de depreciação do uso de HTTPX no TestClient; a suíte continua funcionando com HTTPX, conforme a stack solicitada. Revisar essa integração na Entrega 3.

O resolvedor pip verificou as versões fixadas e baixou wheels compatíveis com Python 3.12/macOS ARM64; a execução da suíte em Python 3.12 ainda não foi realizada. A situação atual do código e a sequência de persistência estão em `docs/migracao_banco.md`; consulte `docs/execucao_persistencia.md` para a conexão e a carga verificadas nesta execução.

## Próximas entregas

Persistência, migrations e carga auditável implementadas. Os comandos de validação e filtros estão em [validacao_terminal.md](../docs/validacao_terminal.md). Modelos definitivos de domínio dependem dos dicionários oficiais; o staging técnico inicial preserva o payload completo.

Entrega 3: expandir testes, padronizar erros e logs sem segredos, revisar segurança e preparar publicação Railway com porta PORT, rede privada e backend/ como raiz do serviço. A configuração local de deploy está preparada em Railpack, start.sh e railway.toml. Nenhum deploy remoto foi realizado nesta etapa; veja [deploy.md](../docs/deploy.md).

A ingestão é executada da raiz com `backend/.venv/bin/python -m pipelines.load`, depois das migrations. Consultas usam `python -m pipelines.query` no mesmo ambiente. Não há carga automática no startup.


## API analítica e frontend

O frontend oficial está em [prototipo/](../prototipo/README.md), com React + Vite + TypeScript e reaproveitamento dos gráficos originais. Em desenvolvimento, o proxy do Vite aponta para esta API na porta 8000.

| Endpoint GET | Filtros | Produto |
| --- | --- | --- |
| `/api/v1/analytics/catalog` | nenhum | Anos, redes, modalidades e versão ativa |
| `/api/v1/analytics/annual` | year, network, modality | Comparativo anual MT (P3) |
| `/api/v1/analytics/population` | year | Censo/população estadual (2022) |

Rede: `1` pública, `2` privada. Modalidade: `1` presencial, `2` EAD. Os resultados incluem `release_id`, versão do contrato, recorte geográfico e pendências. A estimativa anual e suas bases podem ser nulas; quantidade de desvinculações é uma medida separada. Filtros de curso, município ou outros parâmetros não suportados retornam 422, evitando recortes falsamente apresentados como filtrados. Falta de dataset ativo retorna 503 seguro. Nenhum endpoint publica caminhos locais, credenciais ou payloads raw.

```sh
curl --fail http://127.0.0.1:8000/api/v1/analytics/catalog
curl --fail 'http://127.0.0.1:8000/api/v1/analytics/annual?year=2022&network=1&modality=1'
```

Validação desta extensão: 41 testes passaram e 2 testes PostgreSQL opcionais foram ignorados na suíte padrão; Ruff passou. A comparação HTTP com CLI sobre os dados carregados confere 45 combinações de filtros e a população (`python -m pipelines.check_api`, na raiz e com o ambiente do backend). O bloco anterior de validação de 29 testes documenta a entrega de persistência, antes destes endpoints.


## Gráficos reais e página Respostas

GET `/api/v1/analytics/dashboard` publica os produtos calculados por `pipelines/dashboard.py` na tabela `analytics.dashboard_mt` (migration 0003). Filtros: network, modality, degree, area e municipality. Rede 1 pública/2 privada. Grau 1 bacharelado/2 licenciatura/3 tecnológico. O mapa municipal usa somente rede/município; o Censo anual continua com filtros próprios. O payload não inclui dados raw, caminhos ou registros pequenos suprimidos.

A reconstrução/validação completa é reproduzível com `python -m pipelines.check_dashboard` na raiz, usando o ambiente do backend com os requirements das pipelines. O build inicial é explícito (`python -m pipelines.dashboard`), não acontece no startup. A API utiliza Python/SQLAlchemy; pandas roda na pipeline. O deploy foi simplificado para o build automático Railpack, sem Docker.
