import {
  appsApi,
  coreApi,
  networkingApi,
  customObjectsApi,
  assertNamespaceAllowed,
  WATCH_NAMESPACES,
  resolveNamespaces,
} from "../../lib/k8s";
import { parseCpuQuantityToNanoCores, parseMemoryQuantityToBytes } from "../utils/k8sQuantity";

interface NodeSummary {
  name: string;
  status: "Ready" | "NotReady" | "Unknown";
  roles: string[];
  kubeletVersion: string;
  os: string;
  arch: string;
  cpu: string;
  memory: string;
}

interface NamespaceSummary {
  name: string;
  status: string;
  deployments: number;
  pods: number;
  runningPods: number;
}

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

function getNodeRoles(labels: Record<string, string> = {}): string[] {
  return Object.keys(labels)
    .filter((k) => k.startsWith("node-role.kubernetes.io/"))
    .map((k) => k.replace("node-role.kubernetes.io/", ""))
    .filter(Boolean);
}

function getNodeStatus(node: any): NodeSummary["status"] {
  const condition = (node.status?.conditions ?? []).find(
    (c: any) => c.type === "Ready",
  );
  if (!condition) return "Unknown";
  return condition.status === "True" ? "Ready" : "NotReady";
}

export async function getClusterOverview(): Promise<ClusterOverview> {
  const namespaceList = await resolveNamespaces();

  const [nodesResult, ...nsResults] = await Promise.all([
    coreApi.listNode().catch(() => ({ items: [] })),
    ...namespaceList.map((ns) =>
      Promise.all([
        appsApi.listNamespacedDeployment({ namespace: ns }),
        coreApi.listNamespacedPod({ namespace: ns }),
        coreApi.listNamespacedService({ namespace: ns }),
        coreApi.readNamespace({ name: ns }).catch(() => null),
      ]),
    ),
  ]);

  const nodes: NodeSummary[] = (nodesResult.items ?? []).map((node) => ({
    name: node.metadata?.name ?? "unknown",
    status: getNodeStatus(node),
    roles: getNodeRoles(node.metadata?.labels ?? {}),
    kubeletVersion: node.status?.nodeInfo?.kubeletVersion ?? "",
    os: node.status?.nodeInfo?.osImage ?? "",
    arch: node.status?.nodeInfo?.architecture ?? "",
    cpu: node.status?.capacity?.["cpu"] ?? "",
    memory: node.status?.capacity?.["memory"] ?? "",
  }));

  const namespaces: NamespaceSummary[] = namespaceList.map((ns, i) => {
    const [deployResult, podResult, , nsObj] = nsResults[i];
    const pods = podResult.items ?? [];
    return {
      name: ns,
      status: (nsObj as any)?.status?.phase ?? "Active",
      deployments: deployResult.items?.length ?? 0,
      pods: pods.length,
      runningPods: pods.filter((p) => p.status?.phase === "Running").length,
    };
  });

  const totals = namespaces.reduce(
    (acc, ns) => ({
      deployments: acc.deployments + ns.deployments,
      pods: acc.pods + ns.pods,
      runningPods: acc.runningPods + ns.runningPods,
      services:
        acc.services + (nsResults[namespaceList.indexOf(ns.name)]?.[2]?.items?.length ?? 0),
    }),
    { deployments: 0, pods: 0, runningPods: 0, services: 0 },
  );

  return {
    watchedNamespaces: namespaceList,
    nodes: {
      total: nodes.length,
      ready: nodes.filter((n) => n.status === "Ready").length,
      notReady: nodes.filter((n) => n.status !== "Ready").length,
      items: nodes,
    },
    namespaces,
    totals,
    collectedAt: new Date().toISOString(),
  };
}

export interface NamespaceOverviewResult {
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

export async function getNamespaceOverview(namespace: string): Promise<NamespaceOverviewResult> {
  assertNamespaceAllowed(namespace);

  const [nsObj, deployResult, podResult, serviceResult, ingressResult, eventsResult] =
    await Promise.all([
      coreApi.readNamespace({ name: namespace }).catch(() => null),
      appsApi.listNamespacedDeployment({ namespace }),
      coreApi.listNamespacedPod({ namespace }),
      coreApi.listNamespacedService({ namespace }),
      networkingApi.listNamespacedIngress({ namespace }),
      coreApi.listNamespacedEvent({ namespace }),
    ]);

  const deployments = (deployResult.items ?? []).map((d) => {
    const replicas = d.spec?.replicas ?? 0;
    const availableReplicas = d.status?.availableReplicas ?? 0;
    return {
      name: d.metadata?.name ?? "",
      replicas,
      availableReplicas,
      image: d.spec?.template?.spec?.containers?.[0]?.image ?? null,
      status: (replicas === 0
        ? "scaled-down"
        : availableReplicas >= replicas
          ? "healthy"
          : "degraded") as "healthy" | "degraded" | "scaled-down",
    };
  });

  const pods = podResult.items ?? [];
  const podSummary = {
    total: pods.length,
    running: pods.filter((p) => p.status?.phase === "Running").length,
    pending: pods.filter((p) => p.status?.phase === "Pending").length,
    failed: pods.filter((p) => p.status?.phase === "Failed").length,
    succeeded: pods.filter((p) => p.status?.phase === "Succeeded").length,
  };

  const allEvents = (eventsResult.items ?? [])
    .sort((a, b) => {
      const tA = a.lastTimestamp?.getTime() ?? a.metadata?.creationTimestamp?.getTime() ?? 0;
      const tB = b.lastTimestamp?.getTime() ?? b.metadata?.creationTimestamp?.getTime() ?? 0;
      return tB - tA;
    })
    .slice(0, 10)
    .map((e) => ({
      type: e.type ?? "Normal",
      reason: e.reason ?? "",
      message: e.message ?? "",
      timestamp: (e.lastTimestamp ?? e.metadata?.creationTimestamp)?.toISOString() ?? null,
      involvedObject: {
        kind: e.involvedObject?.kind ?? "",
        name: e.involvedObject?.name ?? "",
      },
    }));

  let resourceUsage: NamespaceOverviewResult["resourceUsage"] = {
    available: false,
    cpuUsage: "0m",
    memoryUsage: "0Mi",
    cpuNanoCores: 0,
    memoryBytes: 0,
  };

  try {
    const raw = await customObjectsApi.listNamespacedCustomObject({
      group: "metrics.k8s.io",
      version: "v1beta1",
      namespace,
      plural: "pods",
    });
    const body = (raw as { body?: { items?: unknown[] }; items?: unknown[] })?.body ?? raw;
    const metricItems = (Array.isArray(body?.items) ? body.items : []) as Array<{
      containers?: Array<{ usage?: { cpu?: string; memory?: string } }>;
    }>;

    let totalCpu = 0;
    let totalMem = 0;
    for (const item of metricItems) {
      for (const c of item.containers ?? []) {
        totalCpu += parseCpuQuantityToNanoCores(c.usage?.cpu ?? "0") ?? 0;
        totalMem += parseMemoryQuantityToBytes(c.usage?.memory ?? "0") ?? 0;
      }
    }

    resourceUsage = {
      available: true,
      cpuUsage: `${Math.round(totalCpu / 1_000_000)}m`,
      memoryUsage: `${Math.round(totalMem / 1024 / 1024)}Mi`,
      cpuNanoCores: totalCpu,
      memoryBytes: totalMem,
    };
  } catch {
    // metrics API unavailable
  }

  return {
    name: namespace,
    status: (nsObj as any)?.status?.phase ?? "Active",
    deployments,
    pods: podSummary,
    services: serviceResult.items?.length ?? 0,
    ingresses: ingressResult.items?.length ?? 0,
    events: allEvents,
    resourceUsage,
  };
}
