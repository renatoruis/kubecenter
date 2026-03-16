import yaml from "js-yaml";
import {
  appsApi,
  coreApi,
  networkingApi,
  assertNamespaceAllowed,
  AppError,
} from "../../lib/k8s";

type SupportedKind =
  | "deployment"
  | "service"
  | "ingress"
  | "configmap"
  | "secret"
  | "pod"
  | "replicaset";

const SUPPORTED_KINDS = new Set<string>([
  "deployment",
  "service",
  "ingress",
  "configmap",
  "secret",
  "pod",
  "replicaset",
]);

function stripManagedFields(obj: Record<string, unknown>): void {
  const metadata = obj.metadata as Record<string, unknown> | undefined;
  if (!metadata) return;

  delete metadata.managedFields;

  const annotations = metadata.annotations as Record<string, string> | undefined;
  if (annotations) {
    delete annotations["kubectl.kubernetes.io/last-applied-configuration"];
    if (Object.keys(annotations).length === 0) {
      delete metadata.annotations;
    }
  }
}

async function fetchResource(kind: SupportedKind, namespace: string, name: string): Promise<unknown> {
  switch (kind) {
    case "deployment":
      return appsApi.readNamespacedDeployment({ name, namespace });
    case "service":
      return coreApi.readNamespacedService({ name, namespace });
    case "ingress":
      return networkingApi.readNamespacedIngress({ name, namespace });
    case "configmap":
      return coreApi.readNamespacedConfigMap({ name, namespace });
    case "secret":
      return coreApi.readNamespacedSecret({ name, namespace });
    case "pod":
      return coreApi.readNamespacedPod({ name, namespace });
    case "replicaset":
      return appsApi.readNamespacedReplicaSet({ name, namespace });
  }
}

export async function getResourceYaml(
  kind: string,
  namespace: string,
  name: string,
): Promise<string> {
  assertNamespaceAllowed(namespace);

  const lowerKind = kind.toLowerCase();

  if (!SUPPORTED_KINDS.has(lowerKind)) {
    throw new AppError(
      "UNSUPPORTED_KIND",
      `Kind '${kind}' is not supported. Supported: ${[...SUPPORTED_KINDS].join(", ")}`,
      400,
      { kind },
    );
  }

  try {
    const resource = await fetchResource(lowerKind as SupportedKind, namespace, name);
    const obj = JSON.parse(JSON.stringify(resource));

    stripManagedFields(obj);
    delete obj.status;

    return yaml.dump(obj, { lineWidth: 120, noRefs: true, sortKeys: false });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const status = (err as { statusCode?: number }).statusCode ?? (err as { response?: { statusCode?: number } }).response?.statusCode;
    if (status === 404) {
      throw new AppError(
        "RESOURCE_NOT_FOUND",
        `${kind}/${name} not found in namespace '${namespace}'.`,
        404,
        { kind, namespace, name },
      );
    }
    throw err;
  }
}
