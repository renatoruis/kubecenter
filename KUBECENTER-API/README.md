# KubeCenter API

Backend de observabilidade Kubernetes: agrega aplicações, pods, logs, métricas, databases e configurações em uma API REST unificada.

## Arquitetura

- Roda como `Deployment` no cluster (`kubecenter-api`) com `ServiceAccount` de leitura.
- Autenticação Kubernetes via in-cluster (padrão) ou kubeconfig (local/CI).
- API exposta internamente por `Service ClusterIP` na porta `8080`.
- Package manager: **pnpm**.

## Desenvolvimento local

### Pré-requisitos

- Node.js 20+
- pnpm 10+ (`npm i -g pnpm`)
- Acesso a um cluster Kubernetes via kubeconfig

### Instalação

```bash
pnpm install
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz (não é comitado):

```dotenv
PORT=3000
WATCH_NAMESPACES=default,production,staging
K8S_AUTH=kubeconfig
# KUBECONFIG_PATH=/Users/you/.kube/config
# KUBE_CONTEXT=my-cluster-context
# API_TOKEN=secret-token
# LOG_LEVEL=info
```

### Executar em modo de desenvolvimento

```bash
pnpm dev
```

### Build

```bash
pnpm build
node dist/index.js
```

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/healthz` | Health check (probe K8s) |
| GET | `/applications` | Lista todas as aplicações (deployments) |
| GET | `/applications/:namespace/:app` | Detalhe de uma aplicação |
| GET | `/pods/:namespace/:app` | Pods de uma aplicação |
| GET | `/pods/:namespace/describe/:pod` | Describe detalhado de um pod |
| GET | `/logs/:namespace/:pod/:container` | Logs de um container |
| GET | `/events/:namespace/:app` | Eventos do deployment |
| GET | `/configmaps/:namespace/:app` | ConfigMaps da aplicação |
| GET | `/secrets/:namespace/:app` | Secrets referenciados (só keys) |
| GET | `/secrets/:namespace/:secretName/values` | Valores decodificados de um secret |
| GET | `/databases/:namespace/:app` | Discovery e metadata de DBs |
| GET | `/databases/:namespace/:app/tables/:schema/:table/data` | Dados de uma tabela |
| GET | `/metrics/:namespace/:app` | CPU e memória por app e pod |
| GET | `/network/:namespace/:app` | Services e Ingress da aplicação |

## Segurança

- RBAC read-only: `get`, `list`, `watch` — sem permissão de escrita.
- Secrets retornam apenas **keys** por padrão; o endpoint `/values` retorna dados decodificados.
- Passwords de banco são mascarados nas respostas de discovery.
- Auth opcional por header `Authorization: Bearer <token>` quando `API_TOKEN` estiver definido.
