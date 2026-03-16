# KubeCenter

Plataforma de observabilidade Kubernetes read-only. Visualize deployments, pods, logs em tempo real, métricas de CPU/memória, secrets, configmaps, ingress/services e databases — tudo em um painel unificado.

## Visão Geral

| Componente | Tecnologia | Porta |
|------------|-----------|-------|
| **API** | Fastify + TypeScript | 8080 |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS | 3000 |

### Funcionalidades

- **Cluster Overview** — KPIs de deployments, pods, namespaces e status geral
- **Applications** — Lista de deployments com filtro por namespace e status
- **Application Detail** — Overview com resource map (Deployment → Services → Ingress → Pods → ConfigMaps → Secrets), consumo de recursos (usage vs requests vs limits), eventos Kubernetes
- **Pods** — Lista de pods com describe detalhado (conditions, containers, volumes, events)
- **Logs** — Live tail em tempo real com filtro de texto, por deployment completo ou por pod/container
- **Métricas** — CPU e memória por pod com barras visuais e thresholds
- **Network** — Services e Ingress/IngressRoutes (NGINX e Traefik)
- **ConfigMaps & Secrets** — Visualização de configurações (secrets exibe apenas keys por padrão)
- **Database Discovery** — Detecção automática de conexões PostgreSQL/MySQL, navegação de tabelas e dados (read-only)

## Desenvolvimento Local

### Pré-requisitos

- Node.js 20+
- pnpm 10+ (`npm i -g pnpm`)
- Acesso a um cluster Kubernetes via kubeconfig
- Metrics Server instalado no cluster (veja [Requisitos do Cluster](#requisitos-do-cluster))

### 1. API

```bash
cd KUBECENTER-API
cp .env.example .env    # ajuste WATCH_NAMESPACES e K8S_AUTH
pnpm install
pnpm dev                # http://localhost:3000
```

### 2. Frontend

```bash
cd KUBECENTER-FRONT
pnpm install
pnpm dev                # http://localhost:3001
```

O frontend se conecta à API via `NEXT_PUBLIC_API_URL` (padrão: `http://localhost:3000`).

## Requisitos do Cluster

### Metrics Server (obrigatório)

O KubeCenter utiliza a API `metrics.k8s.io` para exibir consumo de CPU e memória dos pods. Sem o Metrics Server, a seção de métricas exibirá "API de métricas não disponível".

**Verificar se já está instalado:**

```bash
kubectl top nodes
```

Se o comando retornar métricas, o Metrics Server já está ativo. Caso contrário, instale:

**Instalação:**

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

> **Clusters com certificados auto-assinados** (ex: Minikube, Kind, K3s, OKE): adicione o flag `--kubelet-insecure-tls` ao Deployment do Metrics Server:
>
> ```bash
> kubectl patch deployment metrics-server -n kube-system \
>   --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
> ```

> **Clusters gerenciados** (EKS, GKE, AKS): o Metrics Server geralmente já vem habilitado ou pode ser ativado pelo painel do provedor.

**Verificar instalação:**

```bash
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
kubectl top pods -n default
```

### Ingress Controller (opcional)

Para acesso externo ao KubeCenter via domínio, é necessário um Ingress Controller. Manifests prontos para NGINX e Traefik estão em `k8s/`.

## Instalação Rápida

Instale direto no seu cluster com um único comando:

```bash
curl -fsSL https://raw.githubusercontent.com/renatoruis/kubecenter/main/install.sh | bash
```

O script interativo vai perguntar:
- Tipo de ingress (NGINX / Traefik / nenhum)
- Hostname para acesso externo
- Namespaces a monitorar

Para desinstalar:

```bash
kubectl delete namespace kubecenter
kubectl delete clusterrole kubecenter-readonly
kubectl delete clusterrolebinding kubecenter-readonly
```

## Deploy Manual em Kubernetes

### Imagens Docker

As imagens são publicadas automaticamente no GitHub Container Registry via GitHub Actions:

- `ghcr.io/renatoruis/kubecenter-api:latest`
- `ghcr.io/renatoruis/kubecenter-front:latest`

Para build manual:

```bash
# API
docker build -t ghcr.io/renatoruis/kubecenter-api:latest ./KUBECENTER-API

# Frontend
docker build -t ghcr.io/renatoruis/kubecenter-front:latest ./KUBECENTER-FRONT
```

### Manifests Kubernetes

Todos os manifests estão em `k8s/`. Aplique na ordem:

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. ServiceAccount + RBAC (read-only)
kubectl apply -f k8s/rbac.yaml

# 3. API (Deployment + Service)
kubectl apply -f k8s/api.yaml

# 4. Frontend (Deployment + Service)
kubectl apply -f k8s/front.yaml

# 5. Ingress (escolha um):
kubectl apply -f k8s/ingress-nginx.yaml     # NGINX Ingress Controller
# ou
kubectl apply -f k8s/ingress-traefik.yaml    # Traefik IngressRoute
```

Ou tudo de uma vez:

```bash
kubectl apply -f k8s/namespace.yaml -f k8s/rbac.yaml -f k8s/api.yaml -f k8s/front.yaml -f k8s/ingress-nginx.yaml
```

### Configuração

Edite os manifests conforme necessário antes de aplicar:

| Arquivo | O que ajustar |
|---------|--------------|
| `k8s/api.yaml` | `WATCH_NAMESPACES` — namespaces que a API monitora |
| `k8s/front.yaml` | `NEXT_PUBLIC_API_URL` — URL da API (padrão: service interno) |
| `k8s/ingress-nginx.yaml` | `host` — domínio para acesso externo |
| `k8s/ingress-traefik.yaml` | `Host()` — domínio para acesso externo |

### RBAC

O KubeCenter opera em modo **read-only**. O `ClusterRole` concede apenas `get`, `list` e `watch` nos seguintes recursos:

- `pods`, `pods/log`, `services`, `configmaps`, `secrets`, `namespaces`, `events`, `nodes`
- `deployments`, `statefulsets`, `replicasets` (apps)
- `ingresses` (networking.k8s.io)
- `horizontalpodautoscalers` (autoscaling)
- `pods`, `nodes` (metrics.k8s.io)
- `ingressroutes` (traefik.io, traefik.containo.us)

### Verificação

```bash
kubectl get pods -n kubecenter
kubectl logs -n kubecenter deploy/kubecenter-api --tail=50
kubectl logs -n kubecenter deploy/kubecenter-front --tail=50
```

## Estrutura do Repositório

```
├── install.sh               # Instalador interativo (curl | bash)
├── KUBECENTER-API/          # Backend Fastify
│   ├── src/
│   │   ├── modules/         # applications, pods, logs, metrics, events, databases, etc.
│   │   ├── plugins/         # cors, swagger
│   │   └── index.ts         # entrypoint
│   ├── Dockerfile
│   └── package.json
├── KUBECENTER-FRONT/        # Frontend Next.js
│   ├── src/
│   │   ├── app/             # pages (App Router)
│   │   ├── components/      # UI components, features, layout
│   │   └── lib/             # hooks, types, utils
│   ├── Dockerfile
│   └── package.json
├── k8s/                     # Kubernetes manifests
│   ├── namespace.yaml
│   ├── rbac.yaml
│   ├── api.yaml
│   ├── front.yaml
│   ├── ingress-nginx.yaml
│   └── ingress-traefik.yaml
└── .github/workflows/
    └── build.yml            # CI/CD — build & push images
```

## Licença

Uso interno.
