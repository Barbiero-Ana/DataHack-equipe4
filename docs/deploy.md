# Publicação — Vercel + Railway

Monorepo: `prototipo/` é o frontend React/Vite; `backend/` é a API FastAPI; `pipelines/` e `sql/` contêm o processamento e as migrations das quatro camadas. Os arquivos de deploy estão preparados. Ainda não foi feita publicação remota nesta etapa.

## 1. Backend Railway

Configure o serviço da API com **Root Directory `/backend`** e **Config File Path `/backend/railway.toml`**, porque a localização do arquivo de configuração não acompanha automaticamente a raiz do serviço. O Dockerfile usa esse diretório como contexto, instala os requirements de produção e copia somente a aplicação e o script de inicialização. Dados, saídas, ambientes virtuais e segredos não entram na imagem.

O processo executa Uvicorn em `0.0.0.0` usando `PORT`, recebido do Railway; fora da plataforma o padrão é 8000. O healthcheck `/health/ready` verifica a conexão PostgreSQL. Ele não verifica a publicação de um dataset: após o deploy, consulte também o catálogo analítico.

Variáveis do serviço:

| Variável | Valor |
| --- | --- |
| ENVIRONMENT | `production` |
| DATABASE_URL | Referência `${{Postgres.DATABASE_URL}}` ao Postgres do mesmo projeto/ambiente |
| CORS_ORIGINS | Lista JSON com a origem exata do frontend: `["https://DOMINIO-DO-FRONT"]` |
| API_V1_PREFIX | `/api/v1` |

Use o nome real do serviço de banco se ele não for `Postgres`. No Railway, DATABASE_URL deve usar o endereço da rede privada. O túnel `127.0.0.1:51911` é apenas para desenvolvimento local.

Migrations e carga continuam como operação explícita a partir do repositório completo. O container da API não inclui as pipelines nem roda Alembic automaticamente; a migration 0002 precisa de `sql/` na raiz do checkout. Antes de publicar a API sobre um banco novo, siga [a persistência](execucao_persistencia.md) e [a validação pelo terminal](validacao_terminal.md). Em banco já carregado, preserve a versão ativa. Nunca recrie/copie o banco apenas para subir o frontend.

## 2. Frontend Vercel

Importe o mesmo repositório e configure **Root Directory `prototipo`**, framework **Vite**, instalação `npm ci`, build `npm run build` e saída `dist`. `prototipo/vercel.json` registra framework, build e saída. A navegação usa hash (`/#p3`), portanto não depende de rewrites de rotas de servidor.

Defina `VITE_API_BASE_URL=https://DOMINIO-DA-API/api/v1` nos ambientes que publicar. Essa variável é incorporada durante o build: após mudar o domínio da API, gere novo deploy do frontend. Sem essa variável, `/api/v1` funciona pelo proxy local do Vite, mas não encontra o Railway em um site estático na Vercel.

Depois de obter o domínio do frontend, inclua essa origem em CORS_ORIGINS no backend. Para previews, inclua somente as origens de preview que deseja testar; não há wildcard CORS. A API e o frontend devem ser acessados por HTTPS na produção.

## 3. Validar a publicação

```sh
curl --fail https://DOMINIO-DA-API/health/live
curl --fail https://DOMINIO-DA-API/health/ready
curl --fail https://DOMINIO-DA-API/api/v1/analytics/catalog
curl --fail 'https://DOMINIO-DA-API/api/v1/analytics/annual?year=2022&network=1&modality=1'
```

Na Vercel, abra **Dados da API → P3**, confira todas as redes/modalidades, filtre 2021 e confirme que a estimativa ausente não vira zero. Abra B1 e confira o recorte estadual fixo de 2022. Confira as dez páginas em Demonstração, com a identificação permanente de dados simulados. Para reproduzir a comparação dos filtros HTTP com o banco local configurado, execute da raiz:

```sh
backend/.venv/bin/python -m pipelines.check_api --base-url http://127.0.0.1:8000
```

O comando faz consultas somente de leitura e compara as 45 combinações de filtros anuais e o cruzamento de população com a CLI SQL. Para apontá-lo à API publicada, use seu endereço HTTPS e conecte o ambiente local ao mesmo banco/versão, sem compartilhar credenciais.

Referências consultadas: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite) e [configuração em código no Railway](https://docs.railway.com/config-as-code/reference).
