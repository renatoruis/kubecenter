import { assertNamespaceAllowed, coreApi, appsApi } from "../../lib/k8s";
import { getDeploymentSelector, labelsMatchSelector } from "../shared/selectors";

export interface K8sEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  source: string;
  involvedObject: {
    kind: string;
    name: string;
  };
}

export interface EventsResponse {
  namespace: string;
  app: string;
  events: K8sEvent[];
}

export async function getDeploymentEvents(
  namespace: string,
  app: string,
): Promise<EventsResponse> {
  assertNamespaceAllowed(namespace);

  const deployment = await appsApi.readNamespacedDeployment({ namespace, name: app }).catch(() => null);
  const selector = deployment ? getDeploymentSelector(deployment) : null;

  const podList = await coreApi.listNamespacedPod({ namespace });
  const podNames = new Set<string>();
  for (const pod of podList.items ?? []) {
    if (selector && !labelsMatchSelector(pod.metadata?.labels ?? {}, selector)) continue;
    if (pod.metadata?.name) podNames.add(pod.metadata.name);
  }

  const eventList = await coreApi.listNamespacedEvent({ namespace });

  const relevantEvents: K8sEvent[] = [];
  for (const ev of eventList.items ?? []) {
    const objName = ev.involvedObject?.name ?? "";
    const objKind = ev.involvedObject?.kind ?? "";

    const isDeployment = objKind === "Deployment" && objName === app;
    const isReplicaSet = objKind === "ReplicaSet" && objName.startsWith(app + "-");
    const isPod = objKind === "Pod" && podNames.has(objName);

    if (isDeployment || isReplicaSet || isPod) {
      relevantEvents.push({
        type: ev.type ?? "Normal",
        reason: ev.reason ?? "",
        message: ev.message ?? "",
        count: ev.count ?? 1,
        firstTimestamp: ev.firstTimestamp?.toISOString?.() ?? ev.metadata?.creationTimestamp?.toISOString?.() ?? null,
        lastTimestamp: ev.lastTimestamp?.toISOString?.() ?? null,
        source: [ev.source?.component, ev.source?.host].filter(Boolean).join("/") || "unknown",
        involvedObject: {
          kind: objKind,
          name: objName,
        },
      });
    }
  }

  relevantEvents.sort((a, b) => {
    const ta = a.lastTimestamp ?? a.firstTimestamp ?? "";
    const tb = b.lastTimestamp ?? b.firstTimestamp ?? "";
    return tb.localeCompare(ta);
  });

  return { namespace, app, events: relevantEvents };
}
