import { appsApi, assertNamespaceAllowed, coreApi, notFoundError, WATCH_NAMESPACES } from "../../lib/k8s";
import { getDeploymentSelector, labelsMatchSelector } from "../shared/selectors";

type ListPodsFilters = {
  namespace?: string;
  app?: string;
};

const sumRestarts = (
  statuses: Array<{ restartCount?: number }> = [],
): number =>
  statuses.reduce((total, status) => total + (status.restartCount ?? 0), 0);

export const listPods = async ({ namespace, app }: ListPodsFilters) => {
  const targetNamespaces = namespace ? [namespace] : WATCH_NAMESPACES;

  if (namespace) {
    assertNamespaceAllowed(namespace);
  }

  const deploymentSelectors: Record<string, Record<string, string>> = {};

  if (app) {
    for (const ns of targetNamespaces) {
      const deployment = await appsApi
        .readNamespacedDeployment({ namespace: ns, name: app })
        .catch((error: { statusCode?: number }) => {
          if (error?.statusCode === 404) return null;
          throw error;
        });

      if (deployment) {
        deploymentSelectors[ns] = getDeploymentSelector(deployment);
      }
    }

    if (Object.keys(deploymentSelectors).length === 0) {
      throw notFoundError("Deployment", {
        app,
        namespace: namespace ?? "multiple",
        watchedNamespaces: targetNamespaces,
      });
    }
  }

  const rows = [];

  for (const ns of targetNamespaces) {
    const podResult = await coreApi.listNamespacedPod({ namespace: ns });
    const selector = deploymentSelectors[ns];

    for (const pod of podResult.items ?? []) {
      if (selector) {
        const podLabels = pod.metadata?.labels ?? {};
        if (!labelsMatchSelector(podLabels, selector)) {
          continue;
        }
      }

      rows.push({
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        node: pod.spec?.nodeName ?? null,
        status: pod.status?.phase ?? "Unknown",
        restartCount: sumRestarts(pod.status?.containerStatuses ?? []),
        images: (pod.spec?.containers ?? [])
          .map((container) => container.image)
          .filter((image): image is string => Boolean(image)),
        resources: (pod.spec?.containers ?? []).map((container) => ({
          container: container.name,
          requests: container.resources?.requests ?? {},
          limits: container.resources?.limits ?? {},
        })),
      });
    }
  }

  return rows;
};

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
  volumes: Array<{
    name: string;
    type: string;
  }>;
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

export async function describePod(
  namespace: string,
  podName: string,
): Promise<PodDescribeResponse> {
  assertNamespaceAllowed(namespace);

  const pod = await coreApi.readNamespacedPod({ namespace, name: podName }).catch(() => null);
  if (!pod) {
    throw notFoundError("Pod", { namespace, pod: podName });
  }

  const containerStatuses = pod.status?.containerStatuses ?? [];

  const containers = (pod.spec?.containers ?? []).map((c) => {
    const cs = containerStatuses.find((s) => s.name === c.name);
    let state = "Unknown";
    let stateDetail: string | null = null;

    if (cs?.state?.running) {
      state = "Running";
      stateDetail = cs.state.running.startedAt?.toISOString?.() ?? null;
    } else if (cs?.state?.waiting) {
      state = "Waiting";
      stateDetail = cs.state.waiting.reason ?? null;
    } else if (cs?.state?.terminated) {
      state = "Terminated";
      stateDetail = cs.state.terminated.reason ?? null;
    }

    return {
      name: c.name,
      image: c.image ?? "",
      ready: cs?.ready ?? false,
      restartCount: cs?.restartCount ?? 0,
      state,
      stateDetail,
      ports: (c.ports ?? []).map((p) => ({
        containerPort: p.containerPort ?? 0,
        protocol: p.protocol ?? "TCP",
      })),
      resources: {
        requests: c.resources?.requests ?? {},
        limits: c.resources?.limits ?? {},
      },
    };
  });

  const volumes = (pod.spec?.volumes ?? []).map((v) => {
    const type = Object.keys(v).filter((k) => k !== "name")[0] ?? "unknown";
    return { name: v.name ?? "", type };
  });

  const eventList = await coreApi.listNamespacedEvent({ namespace });
  const podEvents = (eventList.items ?? [])
    .filter((ev) => ev.involvedObject?.name === podName && ev.involvedObject?.kind === "Pod")
    .map((ev) => ({
      type: ev.type ?? "Normal",
      reason: ev.reason ?? "",
      message: ev.message ?? "",
      count: ev.count ?? 1,
      lastTimestamp: ev.lastTimestamp?.toISOString?.() ?? ev.metadata?.creationTimestamp?.toISOString?.() ?? null,
      source: [ev.source?.component, ev.source?.host].filter(Boolean).join("/") || "unknown",
    }))
    .sort((a, b) => (b.lastTimestamp ?? "").localeCompare(a.lastTimestamp ?? ""));

  return {
    name: pod.metadata?.name ?? podName,
    namespace: pod.metadata?.namespace ?? namespace,
    node: pod.spec?.nodeName ?? null,
    status: pod.status?.phase ?? "Unknown",
    startTime: pod.status?.startTime?.toISOString?.() ?? null,
    ip: pod.status?.podIP ?? null,
    qosClass: pod.status?.qosClass ?? null,
    conditions: (pod.status?.conditions ?? []).map((c) => ({
      type: c.type ?? "",
      status: c.status ?? "",
      lastTransitionTime: c.lastTransitionTime?.toISOString?.() ?? null,
      reason: c.reason ?? null,
      message: c.message ?? null,
    })),
    containers,
    volumes,
    events: podEvents,
    labels: pod.metadata?.labels ?? {},
    annotations: pod.metadata?.annotations ?? {},
  };
}
