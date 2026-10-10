# Validação — API e migração do protótipo

Execução em 10/10/2026. Frontend oficial em `prototipo/`; o frontend separado criado durante a integração foi retirado. Cópia local do protótipo original em `outputs/migration/prototipo_original/`, ignorada pelo Git.

| Verificação | Resultado |
| --- | --- |
| TypeScript estrito + build Vite | Passou (`npm run build`) |
| Testes backend | 41 passaram; 2 PostgreSQL opcionais ignorados |
| Testes pipelines | 22 passaram; 2 PostgreSQL opcionais ignorados |
| Ruff backend | Lint e formatação passaram |
| API HTTP × CLI SQL no banco carregado | 45 combinações anuais e população passaram |
| Módulos demonstrativos | Dez páginas renderizadas, 31 gráficos SVG no total, sem erros de JavaScript observados |
| Desktop 1440 × 900 | Layout, navegação e tabelas conferidos; sem overflow horizontal da página |
| Celular 390 × 844 | P3 conferida; largura/scrollWidth = 390; tabela usa scroll interno |
| Rede privada/presencial em 2021 | 52.014 matrículas, 14.950 desvinculações, estimativa indisponível por falta do ano anterior |
| B1 após filtro P3 de 2021/privada/presencial | Permaneceu UF 51/2022, todas as redes e presencial, conforme contrato |
| B1 Censo + população | 397.671 pessoas de 18–24 anos; 84.508 vagas e 95.355 matrículas presenciais |
| Configurações Vercel/Railway | JSON, TOML e script shell com sintaxe válida |
| Inicialização da API com PORT | `start.sh` usando o ambiente Python instalado: PORT=8002, `/health/live` 200; processo de teste encerrado |

Versão conferida: `a1e9a162-edb5-4d75-91ff-c6d07f7a96ac`, contrato `1.0.1`. O comando reproduzível de comparação está em `pipelines/check_api.py`; os comandos de consulta/validação existentes continuam disponíveis.

O build separa a demonstração em um chunk carregado sob demanda. Os renderizadores originais continuam em JavaScript ES modules, isolados do React e das respostas da API; a conversão completa desses renderizadores para componentes TypeScript não foi feita nesta etapa. As telas que recebem dados reais e a navegação usam React/TypeScript. O modo inicial usa API; a demonstração tem identificação permanente de simulação.

A imagem Docker não foi construída nesta máquina, onde Docker não estava disponível. A inicialização, os requirements existentes e a sintaxe da configuração foram verificados; build da imagem e funcionamento na plataforma ainda precisam ser conferidos na primeira publicação. Não houve deploy remoto ou alteração de variáveis de serviços nesta etapa.

Evidências visuais locais em `outputs/migration/prototipo_api_desktop.png`, `prototipo_api_mobile.png` e `prototipo_demo_desktop.png`. Esses arquivos não entram no Git. Orientações de publicação em [deploy.md](deploy.md) e organização em [prototipo/README.md](../prototipo/README.md).
