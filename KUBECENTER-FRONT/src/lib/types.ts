// Cluster
export interface ClusterOverview {
  watchedNamespaces: string[];
  nodes: {
    total: number;
    ready: number;
    notReady: number;
    items: NodeSummary[];
  };
  namespaces: NamespaceSummary[];
  totals: {
    deployments: number;
    pods: number;
    runningPods: number;
    services: number;
  };
  collectedAt: string;
}

export interface NodeSummary {
  name: string;
  status: "Ready" | "NotReady" | "Unknown";
  roles: string[];
  kubeletVersion: string;
  os: string;
  arch: string;
  cpu: string;
  memory: string;
}

export interface NamespaceSummary {
  name: string;
  status: string;
  deployments: number;
  pods: number;
  runningPods: number;
}

// Namespace Overview
export interface NamespaceOverview {
  name: string;
  status: string;
  deployments: {
    name: string;
    replicas: number;
    availableReplicas: number;
    image: string | null;
    status: "healthy" | "degraded" | "scaled-down";
  }[];
  pods: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    succeeded: number;
  };
  services: number;
  ingresses: number;
  events: {
    type: string;
    reason: string;
    message: string;
    timestamp: string | null;
    involvedObject: { kind: string; name: string };
  }[];
  resourceUsage: {
    available: boolean;
    cpuUsage: string;
    memoryUsage: string;
    cpuNanoCores: number;
    memoryBytes: number;
  };
}

// Applications
export interface ApplicationListItem {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  image: string | null;
  services: string[];
  status: "healthy" | "degraded" | "scaled-down";
}

export interface HpaMetric {
  type: string;
  name: string;
  currentAverageUtilization: number | null;
  currentAverageValue: string | null;
  targetAverageUtilization: number | null;
  targetAverageValue: string | null;
}

export interface HpaInfo {
  name: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  desiredReplicas: number;
  metrics: HpaMetric[];
}

export interface ApplicationDetail {
  name: string;
  namespace: string;
  deployment: {
    replicas: number;
    availableReplicas: number;
    strategy: string;
    selector: Record<string, string>;
    updatedAt: string | null;
  };
  containers: ContainerSummary[];
  services: string[];
  ingress: Array<{ name?: string; hosts: string[] }>;
  configmaps: string[];
  secrets: string[];
  hpa?: HpaInfo | null;
}

export interface ContainerSummary {
  name: string;
  image?: string;
  ports?: Array<{ name?: string; containerPort?: number; protocol?: string }>;
  env?: Array<{
    name: string;
    value?: string;
    valueFrom?: { configMapKeyRef?: { name: string; key: string }; secretKeyRef?: { name: string; key: string } };
  }>;
  envFrom?: Array<{ configMapRef?: string | null; secretRef?: string | null }>;
  resources?: { requests: Record<string, string>; limits: Record<string, string> };
}

// Pods
export interface PodListItem {
  name: string;
  namespace: string;
  node: string | null;
  status: string;
  restartCount: number;
  startTime: string | null;
  images: string[];
  resources?: Array<{
    container: string;
    requests: Record<string, string>;
    limits: Record<string, string>;
  }>;
}

// Logs
export interface LogsResponse {
  namespace: string;
  pod: string;
  container: string;
  options: {
    tailLines?: number | null;
    sinceSeconds?: number | null;
    timestamps?: boolean;
    follow?: boolean;
  };
  content: string;
}

// ConfigMaps
export interface ConfigMapsResponse {
  app: string;
  namespace: string;
  count: number;
  configMaps: Array<{
    name: string;
    found: boolean;
    usage: string[];
    data: Record<string, string>;
    binaryDataKeys: string[];
  }>;
}

// Secrets
export interface SecretsResponse {
  app: string;
  namespace: string;
  count: number;
  secrets: Array<{
    name: string;
    found: boolean;
    type: string | null;
    usage: string[];
    keys: string[];
    entries?: Array<{ key: string; value: string }>;
  }>;
}

export interface SecretValuesResponse {
  name: string;
  namespace: string;
  type: string | null;
  values: Record<string, string>;
}

// Databases - Table Data
export interface TableDataResponse {
  namespace: string;
  app: string;
  schema: string;
  table: string;
  rows: Record<string, unknown>[];
  limit: number;
  offset: number;
}

// Databases
export interface DatabasesResponse {
  namespace: string;
  app: string;
  discoveredCount: number;
  inspectedAt: string;
  databases: Array<{
    source: { workloadKind: string; workloadName: string; containerName: string };
    inferredEngine: "postgres" | "mysql" | "unknown";
    connected: boolean;
    config: {
      host?: string | null;
      port?: number | null;
      user?: string | null;
      password?: string | null;
      database?: string | null;
      url?: string | null;
      dbString?: string | null;
    };
    metadata?: {
      engine: string;
      version?: string | null;
      schemas: string[];
      tables: Array<{ schema: string; table: string; rowEstimate?: number | null; sizeBytes?: number | null }>;
    } | null;
    warning?: string | null;
  }>;
}

// Metrics
export interface MetricsResponse {
  namespace: string;
  app: string;
  available: boolean;
  source: string;
  cpuUsage: string;
  memoryUsage: string;
  timestamp: string;
  totals: {
    cpuNanoCores: number;
    memoryBytes: number;
    podCount: number;
  };
  resourceSpec?: {
    requests: { cpu?: string; memory?: string };
    limits: { cpu?: string; memory?: string };
  };
  pods: Array<{
    pod: string;
    cpuNanoCores: number;
    memoryBytes: number;
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  }>;
  warnings?: string[] | null;
}

// Deployment Logs (aggregated)
export interface DeploymentLogsResponse {
  namespace: string;
  app: string;
  options: { tailLines?: number; sinceSeconds?: number; timestamps: boolean };
  entries: Array<{ pod: string; container: string; content: string }>;
}

// Network
export interface NetworkResponse {
  app: string;
  namespace: string;
  selector: Record<string, string>;
  services: Array<{
    name?: string | null;
    type?: string | null;
    clusterIP?: string | null;
    selector?: Record<string, string>;
    ports?: Array<{
      name?: string | null;
      port: number;
      targetPort?: string | number;
      protocol?: string;
    }>;
  }>;
  ingress: Array<{
    name?: string | null;
    className?: string | null;
    hosts: string[];
  }>;
}

// Events
export interface EventsResponse {
  namespace: string;
  app: string;
  events: Array<{
    type: string;
    reason: string;
    message: string;
    count: number;
    firstTimestamp: string | null;
    lastTimestamp: string | null;
    source: string;
    involvedObject: { kind: string; name: string };
  }>;
}

// Pod Describe
export interface PodDescribeResponse {
  name: string;
  namespace: string;
  node: string | null;
  status: string;
  startTime: string | null;
  ip: string | null;
  qosClass: string | null;
  conditions: Array<{
    type: string;
    status: string;
    lastTransitionTime: string | null;
    reason: string | null;
    message: string | null;
  }>;
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
    stateDetail: string | null;
    ports: Array<{ containerPort: number; protocol: string }>;
    resources: {
      requests: Record<string, string>;
      limits: Record<string, string>;
    };
  }>;
  volumes: Array<{ name: string; type: string }>;
  events: Array<{
    type: string;
    reason: string;
    message: string;
    count: number;
    lastTimestamp: string | null;
    source: string;
  }>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// Revisions
export interface RevisionItem {
  revision: number;
  image: string;
  createdAt: string;
  replicas: number;
  isActive: boolean;
}

// API Error
export interface ApiError {
  error: string;
  message: string;
}
