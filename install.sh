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
  local var_name="$1" prompt_text="$2" default="${3:-}"
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

prompt_yn() {
  local var_name="$1" prompt_text="$2" default="${3:-y}"
  local input
  echo -ne "  ${CYAN}?${RESET} ${prompt_text} ${DIM}(${default})${RESET}: " >/dev/tty
  read -r input </dev/tty
  input="${input:-$default}"
  case "$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]')" in
    y|yes) eval "$var_name=true" ;;
    *)     eval "$var_name=false" ;;
  esac
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

# ── Check existing installation ──────────────────────────

ALREADY_INSTALLED=false
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
  ALREADY_INSTALLED=true
  warn "KubeCenter já está instalado no namespace ${BOLD}${NAMESPACE}${RESET}"
  echo ""

  API_RUNNING=$(kubectl get deploy kubecenter-api -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  FRONT_RUNNING=$(kubectl get deploy kubecenter-front -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  API_IMG=$(kubectl get deploy kubecenter-api -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "?")
  FRONT_IMG=$(kubectl get deploy kubecenter-front -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "?")

  info "API:      ${BOLD}${API_RUNNING:-0}${RESET} replicas prontas  ${DIM}(${API_IMG})${RESET}"
  info "Frontend: ${BOLD}${FRONT_RUNNING:-0}${RESET} replicas prontas  ${DIM}(${FRONT_IMG})${RESET}"
  echo ""

  prompt_choice EXISTING_ACTION "O que deseja fazer?" "Atualizar (reinstalar)" "Desinstalar" "Cancelar"

  if [[ "$EXISTING_ACTION" == "Cancelar" ]]; then
    info "Operação cancelada."
    exit 0
  fi

  if [[ "$EXISTING_ACTION" == "Desinstalar" ]]; then
    warn "Removendo KubeCenter..."
    kubectl delete namespace "$NAMESPACE" --ignore-not-found 2>/dev/null
    kubectl delete clusterrole kubecenter-readonly --ignore-not-found 2>/dev/null
    kubectl delete clusterrolebinding kubecenter-readonly --ignore-not-found 2>/dev/null
    success "KubeCenter desinstalado com sucesso."
    echo ""
    exit 0
  fi

  info "Continuando com a atualização..."
  echo ""
fi

# ── Perguntas ────────────────────────────────────────────

TOTAL_STEPS=5

prompt_choice INGRESS_TYPE "Qual ingress controller você usa?" "nginx" "traefik" "nenhum (só ClusterIP)"

HOSTNAME=""
TLS_SECRET=""
if [[ "$INGRESS_TYPE" != "nenhum (só ClusterIP)" ]]; then
  prompt HOSTNAME "Hostname para acessar o KubeCenter" "kubecenter.example.com"

  prompt_yn USE_TLS "Habilitar TLS/HTTPS?" "y"
  if [[ "$USE_TLS" == "true" ]]; then
    prompt TLS_SECRET "Nome do Secret com o certificado TLS (já existente no cluster)" ""
    if [ -z "$TLS_SECRET" ]; then
      warn "Nenhum secret informado — ingress será criado sem TLS."
      USE_TLS=false
    fi
  fi
fi

prompt WATCH_NS "Namespaces para monitorar (separados por vírgula, ou 'all' para todos)" "default"

echo ""
echo -e "  ${BOLD}─── Resumo da instalação ───${RESET}"
info "Namespace:      ${BOLD}${NAMESPACE}${RESET}"
info "Ingress:        ${BOLD}${INGRESS_TYPE}${RESET}"
if [ -n "$HOSTNAME" ]; then
  info "Hostname:       ${BOLD}${HOSTNAME}${RESET}"
  if [[ "${USE_TLS:-false}" == "true" ]]; then
    info "TLS Secret:     ${BOLD}${TLS_SECRET}${RESET}"
  fi
fi
info "Watch NS:       ${BOLD}${WATCH_NS}${RESET}"
info "API Image:      ${DIM}${API_IMAGE}${RESET}"
info "Frontend Image: ${DIM}${FRONT_IMAGE}${RESET}"
if [[ "$ALREADY_INSTALLED" == "true" ]]; then
  info "Modo:           ${BOLD}Atualização${RESET}"
fi
echo ""

prompt_yn CONFIRM "Continuar com a instalação?" "y"
if [[ "$CONFIRM" != "true" ]]; then
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
            - name: INTERNAL_API_URL
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

  TLS_BLOCK=""
  if [[ "${USE_TLS:-false}" == "true" ]]; then
    TLS_BLOCK="  tls:
    - hosts:
        - ${HOSTNAME}
      secretName: ${TLS_SECRET}"
  fi

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
${TLS_BLOCK}
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
YAML

  if [[ "${USE_TLS:-false}" == "true" ]]; then
    success "Ingress NGINX criado → ${BOLD}https://${HOSTNAME}${RESET}"
  else
    success "Ingress NGINX criado → ${BOLD}http://${HOSTNAME}${RESET}"
  fi

elif [[ "$INGRESS_TYPE" == "traefik" ]]; then

  TLS_BLOCK=""
  ENTRY_POINTS="    - web
    - websecure"
  if [[ "${USE_TLS:-false}" == "true" ]]; then
    TLS_BLOCK="  tls:
    secretName: ${TLS_SECRET}"
  fi

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
${ENTRY_POINTS}
  routes:
    - match: Host(\`${HOSTNAME}\`)
      kind: Rule
      services:
        - name: kubecenter-front
          port: 3000
${TLS_BLOCK}
YAML

  if [[ "${USE_TLS:-false}" == "true" ]]; then
    success "IngressRoute Traefik criado → ${BOLD}https://${HOSTNAME}${RESET}"
  else
    success "IngressRoute Traefik criado → ${BOLD}http://${HOSTNAME}${RESET}"
  fi

else
  warn "Sem ingress configurado. Use port-forward para acessar:"
  echo ""
  echo -e "    ${DIM}kubectl port-forward -n kubecenter svc/kubecenter-front 3000:3000${RESET}"
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
  PROTO="http"
  [[ "${USE_TLS:-false}" == "true" ]] && PROTO="https"
  info "Acesse: ${BOLD}${PROTO}://${HOSTNAME}${RESET}"
fi
info "Namespace: ${BOLD}kubectl get all -n kubecenter${RESET}"
info "Logs API:  ${BOLD}kubectl logs -n kubecenter deploy/kubecenter-api -f${RESET}"
info "Logs Front: ${BOLD}kubectl logs -n kubecenter deploy/kubecenter-front -f${RESET}"
echo ""

# ── Uninstall hint ───────────────────────────────────────

echo -e "  ${DIM}Para desinstalar:${RESET}"
echo -e "  ${DIM}  curl -fsSL https://raw.githubusercontent.com/renatoruis/kubecenter/main/install.sh | bash${RESET}"
echo -e "  ${DIM}  (selecione \"Desinstalar\" quando detectar a instalação existente)${RESET}"
echo ""
