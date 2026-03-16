#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
#  KubeCenter — Interactive Installer
#  curl -fsSL https://raw.githubusercontent.com/renatoruis/kubecenter/main/install.sh | bash
# ─────────────────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

API_IMAGE="ghcr.io/renatoruis/kubecenter-api:latest"
FRONT_IMAGE="ghcr.io/renatoruis/kubecenter-front:latest"
NAMESPACE="kubecenter"

print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}  ╔═══════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}  ║          ⬡  KubeCenter  Installer        ║${RESET}"
  echo -e "${CYAN}${BOLD}  ║     Kubernetes Observability Platform     ║${RESET}"
  echo -e "${CYAN}${BOLD}  ╚═══════════════════════════════════════════╝${RESET}"
  echo ""
}

info()    { echo -e "  ${CYAN}▸${RESET} $1"; }
success() { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}!${RESET} $1"; }
error()   { echo -e "  ${RED}✗${RESET} $1"; }
step()    { echo -e "\n  ${BOLD}[$1/$TOTAL_STEPS]${RESET} $2\n"; }

prompt() {
  local var_name="$1" prompt_text="$2" default="$3"
  local input
  if [ -n "$default" ]; then
    echo -ne "  ${CYAN}?${RESET} ${prompt_text} ${DIM}(${default})${RESET}: " >/dev/tty
  else
    echo -ne "  ${CYAN}?${RESET} ${prompt_text}: " >/dev/tty
  fi
  read -r input </dev/tty
  eval "$var_name=\"${input:-$default}\""
}

prompt_choice() {
  local var_name="$1" prompt_text="$2"
  shift 2
  local options=("$@")
  echo -e "  ${CYAN}?${RESET} ${prompt_text}" >/dev/tty
  for i in "${!options[@]}"; do
    echo -e "    ${BOLD}$((i+1)))${RESET} ${options[$i]}" >/dev/tty
  done
  local choice
  echo -ne "    ${DIM}Escolha [1-${#options[@]}]:${RESET} " >/dev/tty
  read -r choice </dev/tty
  choice=${choice:-1}
  if [[ "$choice" -ge 1 && "$choice" -le "${#options[@]}" ]]; then
    eval "$var_name=\"${options[$((choice-1))]}\""
  else
    eval "$var_name=\"${options[0]}\""
  fi
}

# ── Pre-flight ───────────────────────────────────────────

print_banner

if ! command -v kubectl &>/dev/null; then
  error "kubectl não encontrado. Instale antes de continuar."
  echo -e "    ${DIM}https://kubernetes.io/docs/tasks/tools/${RESET}"
  exit 1
fi

KUBE_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
if [ -z "$KUBE_CONTEXT" ]; then
  error "Nenhum contexto Kubernetes ativo. Configure o kubeconfig primeiro."
  exit 1
fi

info "Cluster atual: ${BOLD}${KUBE_CONTEXT}${RESET}"
echo ""

# ── Perguntas ────────────────────────────────────────────

TOTAL_STEPS=5

prompt_choice INGRESS_TYPE "Qual ingress controller você usa?" "nginx" "traefik" "nenhum (só ClusterIP)"

HOSTNAME=""
if [[ "$INGRESS_TYPE" != "nenhum (só ClusterIP)" ]]; then
  prompt HOSTNAME "Hostname para acessar o KubeCenter" "kubecenter.example.com"
fi

prompt WATCH_NS "Namespaces para monitorar (separados por vírgula, ou 'all' para todos)" "default"

echo ""
echo -e "  ${BOLD}─── Resumo da instalação ───${RESET}"
info "Namespace:      ${BOLD}${NAMESPACE}${RESET}"
info "Ingress:        ${BOLD}${INGRESS_TYPE}${RESET}"
if [ -n "$HOSTNAME" ]; then
  info "Hostname:       ${BOLD}${HOSTNAME}${RESET}"
fi
info "Watch NS:       ${BOLD}${WATCH_NS}${RESET}"
info "API Image:      ${DIM}${API_IMAGE}${RESET}"
info "Frontend Image: ${DIM}${FRONT_IMAGE}${RESET}"
echo ""

prompt CONFIRM "Continuar com a instalação? (y/n)" "y"
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  warn "Instalação cancelada."
  exit 0
fi

# ── Step 1: Namespace ────────────────────────────────────

step 1 "Criando namespace ${BOLD}${NAMESPACE}${RESET}"

kubectl apply -f - <<'YAML'
apiVersion: v1
kind: Namespace
metadata:
  name: kubecenter
  labels:
    app.kubernetes.io/part-of: kubecenter
YAML
success "Namespace criado"

# ── Step 2: RBAC ─────────────────────────────────────────

step 2 "Configurando RBAC (read-only)"

kubectl apply -f - <<'YAML'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kubecenter
  namespace: kubecenter
  labels:
    app.kubernetes.io/part-of: kubecenter
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubecenter-readonly
  labels:
    app.kubernetes.io/part-of: kubecenter
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "services", "configmaps", "secrets", "namespaces", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list"]
  - apiGroups: ["traefik.io", "traefik.containo.us"]
    resources: ["ingressroutes"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubecenter-readonly
  labels:
    app.kubernetes.io/part-of: kubecenter
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kubecenter-readonly
subjects:
  - kind: ServiceAccount
    name: kubecenter
    namespace: kubecenter
YAML
success "ServiceAccount + ClusterRole + ClusterRoleBinding aplicados"

# ── Step 3: API ──────────────────────────────────────────

step 3 "Fazendo deploy do ${BOLD}kubecenter-api${RESET}"

kubectl apply -f - <<YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubecenter-api
  namespace: kubecenter
  labels:
    app: kubecenter-api
    app.kubernetes.io/part-of: kubecenter
    app.kubernetes.io/component: api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubecenter-api
  template:
    metadata:
      labels:
        app: kubecenter-api
        app.kubernetes.io/part-of: kubecenter
        app.kubernetes.io/component: api
    spec:
      serviceAccountName: kubecenter
      containers:
        - name: api
          image: ${API_IMAGE}
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: PORT
              value: "8080"
            - name: K8S_AUTH
              value: "cluster"
            - name: WATCH_NAMESPACES
              value: "${WATCH_NS}"
            - name: LOG_LEVEL
              value: "info"
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 10
            periodSeconds: 30
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: kubecenter-api
  namespace: kubecenter
  labels:
    app: kubecenter-api
    app.kubernetes.io/part-of: kubecenter
spec:
  type: ClusterIP
  selector:
    app: kubecenter-api
  ports:
    - name: http
      port: 8080
      targetPort: http
YAML
success "API Deployment + Service aplicados"

# ── Step 4: Frontend ─────────────────────────────────────

step 4 "Fazendo deploy do ${BOLD}kubecenter-front${RESET}"

kubectl apply -f - <<YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubecenter-front
  namespace: kubecenter
  labels:
    app: kubecenter-front
    app.kubernetes.io/part-of: kubecenter
    app.kubernetes.io/component: frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubecenter-front
  template:
    metadata:
      labels:
        app: kubecenter-front
        app.kubernetes.io/part-of: kubecenter
        app.kubernetes.io/component: frontend
    spec:
      containers:
        - name: frontend
          image: ${FRONT_IMAGE}
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NEXT_PUBLIC_API_URL
              value: "http://kubecenter-api:8080"
          readinessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 10
            periodSeconds: 30
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 300m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: kubecenter-front
  namespace: kubecenter
  labels:
    app: kubecenter-front
    app.kubernetes.io/part-of: kubecenter
spec:
  type: ClusterIP
  selector:
    app: kubecenter-front
  ports:
    - name: http
      port: 3000
      targetPort: http
YAML
success "Frontend Deployment + Service aplicados"

# ── Step 5: Ingress ──────────────────────────────────────

step 5 "Configurando ingress"

if [[ "$INGRESS_TYPE" == "nginx" ]]; then
  kubectl apply -f - <<YAML
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kubecenter
  namespace: kubecenter
  labels:
    app.kubernetes.io/part-of: kubecenter
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
spec:
  ingressClassName: nginx
  rules:
    - host: ${HOSTNAME}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kubecenter-front
                port:
                  number: 3000
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: kubecenter-api
                port:
                  number: 8080
YAML
  success "Ingress NGINX criado → ${BOLD}http://${HOSTNAME}${RESET}"

elif [[ "$INGRESS_TYPE" == "traefik" ]]; then
  kubectl apply -f - <<YAML
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: kubecenter
  namespace: kubecenter
  labels:
    app.kubernetes.io/part-of: kubecenter
spec:
  entryPoints:
    - web
    - websecure
  routes:
    - match: Host(\`${HOSTNAME}\`)
      kind: Rule
      services:
        - name: kubecenter-front
          port: 3000
    - match: Host(\`${HOSTNAME}\`) && PathPrefix(\`/api\`)
      kind: Rule
      services:
        - name: kubecenter-api
          port: 8080
YAML
  success "IngressRoute Traefik criado → ${BOLD}http://${HOSTNAME}${RESET}"

else
  warn "Sem ingress configurado. Use port-forward para acessar:"
  echo ""
  echo -e "    ${DIM}kubectl port-forward -n kubecenter svc/kubecenter-front 3000:3000${RESET}"
  echo -e "    ${DIM}kubectl port-forward -n kubecenter svc/kubecenter-api 8080:8080${RESET}"
fi

# ── Resultado ────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}─── Aguardando pods ficarem prontos ───${RESET}"
echo ""

kubectl rollout status deployment/kubecenter-api  -n kubecenter --timeout=120s 2>/dev/null && \
  success "kubecenter-api está rodando" || warn "kubecenter-api ainda não está pronto (verifique os logs)"

kubectl rollout status deployment/kubecenter-front -n kubecenter --timeout=120s 2>/dev/null && \
  success "kubecenter-front está rodando" || warn "kubecenter-front ainda não está pronto (verifique os logs)"

echo ""
echo -e "${GREEN}${BOLD}  ╔═══════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}  ║       KubeCenter instalado com sucesso!   ║${RESET}"
echo -e "${GREEN}${BOLD}  ╚═══════════════════════════════════════════╝${RESET}"
echo ""

if [ -n "$HOSTNAME" ]; then
  info "Acesse: ${BOLD}http://${HOSTNAME}${RESET}"
fi
info "Namespace: ${BOLD}kubectl get all -n kubecenter${RESET}"
info "Logs API:  ${BOLD}kubectl logs -n kubecenter deploy/kubecenter-api -f${RESET}"
info "Logs Front: ${BOLD}kubectl logs -n kubecenter deploy/kubecenter-front -f${RESET}"
echo ""

# ── Uninstall hint ───────────────────────────────────────

echo -e "  ${DIM}Para desinstalar:${RESET}"
echo -e "  ${DIM}  kubectl delete namespace kubecenter${RESET}"
echo -e "  ${DIM}  kubectl delete clusterrole kubecenter-readonly${RESET}"
echo -e "  ${DIM}  kubectl delete clusterrolebinding kubecenter-readonly${RESET}"
echo ""
