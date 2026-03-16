import { appsApi, coreApi, WATCH_NAMESPACES, resolveNamespaces } from "../../lib/k8s";

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
