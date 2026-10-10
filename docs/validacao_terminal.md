# Consulta e validação pelo terminal

Execute os comandos na raiz do projeto `DataHack`, usando o Python do backend.
Esse ambiente precisa conter `backend/requirements.txt` e `pipelines/requirements.txt`.
A conexão vem de `DATABASE_URL` no ambiente ou de `backend/.env`; não coloque senhas no Git.
As consultas usam uma conexão PostgreSQL somente leitura, separada do pool HTTP.

## Preparação

As migrations alteram somente estruturas. A carga é explícita e não roda ao iniciar a API.
Mantenha o checkout completo do monorepo: a segunda migration lê o SQL de `sql/`, na raiz.

```bash
cd backend
.venv/bin/alembic upgrade head
cd ..
backend/.venv/bin/python -m pipelines.load
```

Para a configuração atual via túnel Railway, mantenha o túnel aberto na porta configurada
em `backend/.env`. Se precisar reabri-lo, use:

```bash
railway connect Postgres --tunnel-only --port 51911 --project fddb34ae-dee9-46e2-ab69-ad8d5030a57c --environment production
```

O comando Railway mostra credenciais somente no seu terminal; não copie essa saída para Git ou relatórios.
Se o original mudou, rode primeiro `backend/.venv/bin/python -m pipelines.run` na raiz.
O carregador verifica os hashes e recusa fontes divergentes do manifest.

## Conferir todas as camadas

```bash
backend/.venv/bin/python -m pipelines.query status
backend/.venv/bin/python -m pipelines.query validate
backend/.venv/bin/python -m pipelines.check_filters
```

`status` mostra contagens, famílias, ocorrências, versão ativa e tentativas com falha.
`validate` verifica a identidade de fontes, Parquet e código, contagens/linhagem no banco,
componentes e resultados da pergunta 3, a junção população/Censo 2022 e **45 combinações**
dos filtros de ano, rede e modalidade. Uma divergência termina com código de saída 1.
Ausências são comparadas como ausências; as taxas usam tolerância de `1e-10`.
`check_filters` compara cinco casos reais de staging com pandas: município, curso,
rede/modalidade nas famílias Censo, trajetória, CPC e Enade. O código está no repositório.

## Pergunta 3

```bash
backend/.venv/bin/python -m pipelines.query annual
backend/.venv/bin/python -m pipelines.query annual --year 2024 --network 2 --modality 1
backend/.venv/bin/python -m pipelines.query annual --year 2021 --network 1
```

Rede: `1 = pública`, `2 = privada`. Modalidade: `1 = presencial`, `2 = EAD`.
Os resultados incluem numerador, denominador, matrículas, ingressantes, concluintes,
desvinculações, medidas do ano anterior, taxa e motivo de indisponibilidade.
2021 conserva as desvinculações, mas a taxa é `null` enquanto faltar o Censo 2020.
As quantidades são vínculos, não pessoas distintas. A estimativa anual não é TADA.

Essa tabela é estadual: filtros de curso/município são recusados, pois aplicar esses filtros
a uma taxa já agregada produziria uma interpretação incorreta.

## Conferir registros e filtros das seis famílias

```bash
backend/.venv/bin/python -m pipelines.query records --family censo_cursos --year 2024 --network 2 --modality 1 --limit 5
backend/.venv/bin/python -m pipelines.query records --family censo_cursos --municipality 5103403 --year 2022 --limit 5
backend/.venv/bin/python -m pipelines.query records --family trajetoria --year 2024 --network 1 --limit 5
backend/.venv/bin/python -m pipelines.query records --family cpc --year 2023 --modality 2 --limit 5
backend/.venv/bin/python -m pipelines.query records --family enade --limit 5
backend/.venv/bin/python -m pipelines.query records --family censo_ies --year 2024 --limit 5
backend/.venv/bin/python -m pipelines.query records --family populacao --year 2022 --limit 1
```

Cada resposta contém o total filtrado e uma amostra de até 100 registros, os códigos
normalizados, o payload completo, flags de revisão, arquivo/hash, aba e linha de origem.
`--course` filtra pelo código do curso. Não existe paginação de API nesta entrega.
A consulta de staging preserva pendências: não representa um indicador publicado.
Nos cursos do Censo, a consulta sem dimensão inclui os registros de dimensões distintas;
não some seus payloads como se fossem ofertas equivalentes. A pergunta 3 aplica o recorte
presencial/dimensão 1 e EAD/dimensão 2 antes de agregar.
Nos CPC/Enade, a localização é a informada pela avaliação, não automaticamente a oferta EAD.

## População e Censo 2022

```bash
backend/.venv/bin/python -m pipelines.query population --year 2022
```

O resultado é uma linha de Mato Grosso, no mesmo ano e nível geográfico:
população de 18–24 anos, quantidade de cursos presenciais, matrículas e vagas.
Não existe população municipal nesta fonte; a CLI recusa esse filtro.
Matrículas da oferta não são necessariamente matrículas dos residentes de MT ou da faixa 18–24.
Essa junção, isoladamente, não fornece uma taxa de atendimento da população jovem.

## Segurança e repetição

A mesma identidade de fontes/Parquet/código retorna `already_loaded`, sem duplicar dados
nem trocar a versão ativa por uma versão antiga. Uma mudança gera outra tentativa/versão.
O raw é reaproveitado por arquivo/hash/aba/linha. Falhas revertem toda a carga candidata,
registram o tipo de erro em transação separada e preservam a versão anterior.
A ativação só ocorre depois das comparações SQL × pandas, na mesma transação da carga.
Essa estratégia reexecuta o lote inteiro após falha; ainda não há retomada por chunk.

## Testes automatizados

Sem banco, os testes de integração são pulados:

```bash
backend/.venv/bin/pytest -q -c pipelines/pyproject.toml pipelines/tests
cd backend
.venv/bin/pytest -q
```

Com `TEST_DATABASE_URL` apontando para PostgreSQL local descartável, nome `test_*`,
aplique previamente as migrations nesse banco e execute os mesmos testes.
Os testes cobrem idempotência, parâmetros dos filtros, taxa ausente, alterações indevidas
no staging, rollback, nova tentativa após falha e preservação das versões anteriores.
Jamais use o banco Railway como `TEST_DATABASE_URL`.

## Próxima etapa

Construir a API para consultar as tabelas analíticas da versão ativa, com contratos de entrada
Pydantic, repository, service e router. Os testes HTTP poderão comparar a mesma consulta com a CLI.
Depois, ligar o frontend a esses contratos. Os demais produtos analíticos das perguntas 1/2/4/5
e bônus exigem suas regras de associação e universos; carregar staging não os calcula automaticamente.
