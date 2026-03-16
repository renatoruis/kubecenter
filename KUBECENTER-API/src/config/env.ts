export interface AppConfig {
  port: number;
  apiToken?: string;
  logLevel: string;
  watchNamespaces: string[];
  /**
   * Modo de autenticação Kubernetes.
   *
   * - "cluster"   → usa in-cluster (ServiceAccount montado pelo K8s).
   *                 Padrão quando o serviço roda dentro do cluster.
   * - "kubeconfig" → usa arquivo kubeconfig (local ou CI).
   *                  Selecione com K8S_AUTH=kubeconfig.
   * - "auto"      → tenta in-cluster; se falhar usa kubeconfig. Padrão.
   */
  k8sAuth: "cluster" | "kubeconfig" | "auto";
  /** Caminho para o arquivo kubeconfig. Default: ~/.kube/config (via KUBECONFIG env ou padrão do SDK). */
  kubeconfigPath?: string;
  /** Contexto a usar do kubeconfig. Se omitido usa o contexto corrente do arquivo. */
  kubeContext?: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_NAMESPACE = "default";

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(rawPort, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }
  return parsed;
}

function parseWatchNamespaces(rawNamespaces: string | undefined): string[] {
  if (!rawNamespaces) {
    return [DEFAULT_NAMESPACE];
  }
  const namespaces = rawNamespaces
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return namespaces.length > 0 ? namespaces : [DEFAULT_NAMESPACE];
}

function parseK8sAuth(raw: string | undefined): AppConfig["k8sAuth"] {
  if (raw === "cluster" || raw === "kubeconfig") return raw;
  return "auto";
}

export function loadEnv(): AppConfig {
  return {
    port: parsePort(process.env.PORT),
    apiToken: process.env.API_TOKEN,
    logLevel: process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
    watchNamespaces: parseWatchNamespaces(process.env.WATCH_NAMESPACES),
    k8sAuth: parseK8sAuth(process.env.K8S_AUTH),
    kubeconfigPath: process.env.KUBECONFIG_PATH ?? process.env.KUBECONFIG,
    kubeContext: process.env.KUBE_CONTEXT,
  };
}
