import { AppError } from "../../lib/errors";
import { appsApi, assertNamespaceAllowed, coreApi, customObjectsApi } from "../../lib/k8s";
import { getDeploymentSelector, labelsMatchSelector } from "../shared/selectors";
import { parseCpuQuantityToNanoCores, parseMemoryQuantityToBytes } from "../utils/k8sQuantity";

interface PodMetricContainerUsage {
  cpu?: string;
  memory?: string;
}

interface PodMetricContainer {
  name: string;
  usage: PodMetricContainerUsage;
}

interface PodMetricItem {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  timestamp?: string;
  window?: string;
  containers?: PodMetricContainer[];
}

interface PodMetricsList {
  items?: PodMetricItem[];
}

export interface PodMetricSummary {
  pod: string;
  cpuNanoCores: number;
  memoryBytes: number;
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}

export interface AppMetricsResponse {
  namespace: string;
  app: string;
  available: boolean;
  source: "metrics.k8s.io";
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
  pods: PodMetricSummary[];
  warnings?: string[];
}

function getAppLabel(labels: Record<string, string> | undefined): string | undefined {
  if (!labels) {
    return undefined;
  }
  return labels.app ?? labels["app.kubernetes.io/name"] ?? labels["k8s-app"];
}

export async function getMetricsByApp(
  namespace: string,
  app: string,
): Promise<AppMetricsResponse> {
  assertNamespaceAllowed(namespace);
  try {
    const raw = await customObjectsApi.listNamespacedCustomObject({
      group: "metrics.k8s.io",
      version: "v1beta1",
      namespace,
      plural: "pods",
    });
    const body = (raw as { body?: { items?: unknown[] }; items?: unknown[] })?.body ?? raw;
    const items = (Array.isArray(body?.items) ? body.items : []) as PodMetricItem[];

    const matched = items.filter((item: PodMetricItem) => getAppLabel(item.metadata?.labels) === app);
    const podNames = matched.map((item: PodMetricItem) => item.metadata?.name).filter((n: string | undefined): n is string => Boolean(n));

    const deployment = await appsApi.readNamespacedDeployment({ namespace, name: app }).catch(() => null);
    const deploymentSelector = deployment ? getDeploymentSelector(deployment) : null;

    const podList = podNames.length > 0
      ? await coreApi.listNamespacedPod({ namespace })
      : { items: [] };
    const podSpecs = new Map(
      (podList.items ?? [])
        .filter((p) => !deploymentSelector || labelsMatchSelector(p.metadata?.labels ?? {}, deploymentSelector))
        .map((p) => [p.metadata?.name, p] as const)
        .filter(([name]) => Boolean(name)),
    );

    const pods: PodMetricSummary[] = matched.map((item: PodMetricItem) => {
      const podName = item.metadata?.name ?? "unknown-pod";
      let cpuNanoCores = 0;
      let memoryBytes = 0;

      for (const container of item.containers ?? []) {
        const parsedCpu = container.usage?.cpu ? parseCpuQuantityToNanoCores(container.usage.cpu) : null;
        const parsedMemory = container.usage?.memory ? parseMemoryQuantityToBytes(container.usage.memory) : null;
        cpuNanoCores += parsedCpu ?? 0;
        memoryBytes += parsedMemory ?? 0;
      }

      const podSpec = podSpecs.get(podName);
      const firstContainer = podSpec?.spec?.containers?.[0];
      const requests = firstContainer?.resources?.requests
        ? { cpu: firstContainer.resources.requests.cpu, memory: firstContainer.resources.requests.memory }
        : undefined;
      const limits = firstContainer?.resources?.limits
        ? { cpu: firstContainer.resources.limits.cpu, memory: firstContainer.resources.limits.memory }
        : undefined;

      return {
        pod: podName,
        cpuNanoCores,
        memoryBytes,
        requests: (requests?.cpu || requests?.memory) ? requests : undefined,
        limits: (limits?.cpu || limits?.memory) ? limits : undefined,
      };
    });

    const depContainer = deployment?.spec?.template?.spec?.containers?.[0];
    const resourceSpec = depContainer?.resources
      ? {
          requests: depContainer.resources.requests ?? {},
          limits: depContainer.resources.limits ?? {},
        }
      : undefined;

    return {
      namespace,
      app,
      available: true,
      source: "metrics.k8s.io",
      cpuUsage: `${Math.round(pods.reduce((acc, pod) => acc + pod.cpuNanoCores, 0) / 1_000_000)}m`,
      memoryUsage: `${Math.round(pods.reduce((acc, pod) => acc + pod.memoryBytes, 0) / 1024 / 1024)}Mi`,
      timestamp: new Date().toISOString(),
      totals: {
        cpuNanoCores: pods.reduce((acc, pod) => acc + pod.cpuNanoCores, 0),
        memoryBytes: pods.reduce((acc, pod) => acc + pod.memoryBytes, 0),
        podCount: pods.length,
      },
      resourceSpec,
      pods,
    };
  } catch (error) {
    const statusCode = Number((error as any)?.response?.statusCode ?? (error as any)?.statusCode ?? 0);
    if (statusCode === 404 || statusCode === 503 || statusCode === 0) {
      return {
        namespace,
        app,
        available: false,
        source: "metrics.k8s.io",
        cpuUsage: "0m",
        memoryUsage: "0Mi",
        timestamp: new Date().toISOString(),
        totals: {
          cpuNanoCores: 0,
          memoryBytes: 0,
          podCount: 0,
        },
        pods: [],
        warnings: ["metrics.k8s.io API is unavailable for this cluster/namespace"],
      };
    }

    throw new AppError(502, "UPSTREAM_UNAVAILABLE", "Unable to collect app metrics from Kubernetes", {
      namespace,
      app,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
