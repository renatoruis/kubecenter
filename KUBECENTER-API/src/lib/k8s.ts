import {
  AppsV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  NetworkingV1Api,
} from "@kubernetes/client-node";
import { loadEnv } from "../config/env";
import { AppError } from "./errors";

export interface K8sClients {
  coreV1: CoreV1Api;
  appsV1: AppsV1Api;
  networkingV1: NetworkingV1Api;
  customObjects: CustomObjectsApi;
}

function buildKubeConfig(): KubeConfig {
  const { k8sAuth, kubeconfigPath, kubeContext } = loadEnv();
  const kc = new KubeConfig();

  if (k8sAuth === "cluster") {
    kc.loadFromCluster();
    return kc;
  }

  if (k8sAuth === "kubeconfig") {
    if (kubeconfigPath) {
      kc.loadFromFile(kubeconfigPath);
    } else {
      kc.loadFromDefault();
    }
    if (kubeContext) {
      kc.setCurrentContext(kubeContext);
    }
    return kc;
  }

  // "auto": tenta in-cluster; se não estiver num pod, usa kubeconfig
  try {
    kc.loadFromCluster();
    return kc;
  } catch {
    if (kubeconfigPath) {
      kc.loadFromFile(kubeconfigPath);
    } else {
      kc.loadFromDefault();
    }
    if (kubeContext) {
      kc.setCurrentContext(kubeContext);
    }
    return kc;
  }
}

export function createK8sClients(): K8sClients {
  const kc = buildKubeConfig();
  return {
    coreV1: kc.makeApiClient(CoreV1Api),
    appsV1: kc.makeApiClient(AppsV1Api),
    networkingV1: kc.makeApiClient(NetworkingV1Api),
    customObjects: kc.makeApiClient(CustomObjectsApi),
  };
}

const clients = createK8sClients();
export const coreApi = clients.coreV1;
export const appsApi = clients.appsV1;
export const networkingApi = clients.networkingV1;
export const customObjectsApi = clients.customObjects;

const RAW_WATCH_NAMESPACES = (process.env.WATCH_NAMESPACES ?? "default")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const WATCH_ALL = RAW_WATCH_NAMESPACES.length === 1 && RAW_WATCH_NAMESPACES[0].toLowerCase() === "all";

export let WATCH_NAMESPACES: string[] = WATCH_ALL ? [] : RAW_WATCH_NAMESPACES;

export async function resolveNamespaces(): Promise<string[]> {
  if (!WATCH_ALL) return WATCH_NAMESPACES;
  const result = await coreApi.listNamespace();
  WATCH_NAMESPACES = (result.items ?? [])
    .map((ns) => ns.metadata?.name ?? "")
    .filter((n) => n && !n.startsWith("kube-"));
  return WATCH_NAMESPACES;
}

export const isNamespaceAllowed = (namespace: string): boolean =>
  WATCH_ALL || WATCH_NAMESPACES.includes(namespace);

export const assertNamespaceAllowed = (namespace: string): void => {
  if (!isNamespaceAllowed(namespace)) {
    throw new AppError("NAMESPACE_FORBIDDEN", `Namespace '${namespace}' is not allowed.`, 403, {
      namespace,
      allowedNamespaces: WATCH_NAMESPACES,
    });
  }
};

export const notFoundError = (
  resource: string,
  details: Record<string, unknown>,
): AppError =>
  new AppError("RESOURCE_NOT_FOUND", `${resource} not found.`, 404, details);

export { AppError };
