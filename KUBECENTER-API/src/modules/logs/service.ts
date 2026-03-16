import { AppError } from "../../lib/errors";
import { appsApi, assertNamespaceAllowed, coreApi, notFoundError } from "../../lib/k8s";
import { getDeploymentSelector, labelsMatchSelector } from "../shared/selectors";

export interface PodLogRequest {
  namespace: string;
  pod: string;
  container: string;
  tailLines?: number;
  sinceSeconds?: number;
  timestamps?: boolean;
  follow?: boolean;
  previous?: boolean;
}

export interface PodLogResponse {
  namespace: string;
  pod: string;
  container: string;
  options: {
    tailLines?: number;
    sinceSeconds?: number;
    timestamps: boolean;
    follow: boolean;
  };
  content: string;
}

export interface DeploymentLogsResponse {
  namespace: string;
  app: string;
  options: {
    tailLines?: number;
    sinceSeconds?: number;
    timestamps: boolean;
  };
  entries: Array<{
    pod: string;
    container: string;
    content: string;
  }>;
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(400, "BAD_REQUEST", `"${fieldName}" must be a positive integer`);
  }
}

export function parseOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  assertPositiveInteger(parsed, fieldName);
  return parsed;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  throw new AppError(400, "BAD_REQUEST", "Boolean query parameters must be true or false");
}

export async function getPodLogs(request: PodLogRequest): Promise<PodLogResponse> {
  const timestamps = request.timestamps ?? false;
  const follow = request.follow ?? false;
  const previous = request.previous ?? false;
  assertNamespaceAllowed(request.namespace);

  try {
    const rawResponse = await coreApi.readNamespacedPodLog({
      namespace: request.namespace,
      name: request.pod,
      container: request.container,
      follow,
      previous,
      sinceSeconds: request.sinceSeconds,
      tailLines: request.tailLines,
      timestamps,
    });

    const body = rawResponse as unknown as string;

    return {
      namespace: request.namespace,
      pod: request.pod,
      container: request.container,
      options: {
        tailLines: request.tailLines,
        sinceSeconds: request.sinceSeconds,
        timestamps,
        follow,
      },
      content: body,
    };
  } catch (error) {
    const statusCode = Number(
      (error as { body?: { code?: number }; statusCode?: number })?.body?.code ??
        (error as { statusCode?: number })?.statusCode ??
        0,
    );
    if (statusCode === 404) {
      throw new AppError(404, "NOT_FOUND", "Pod/container log not found", {
        namespace: request.namespace,
        pod: request.pod,
        container: request.container,
      });
    }
    throw new AppError(502, "UPSTREAM_UNAVAILABLE", "Unable to read pod logs from Kubernetes", {
      namespace: request.namespace,
      pod: request.pod,
      container: request.container,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getDeploymentLogs(
  namespace: string,
  app: string,
  options: { tailLines?: number; sinceSeconds?: number; timestamps?: boolean },
): Promise<DeploymentLogsResponse> {
  assertNamespaceAllowed(namespace);

  const deployment = await appsApi
    .readNamespacedDeployment({ namespace, name: app })
    .catch((err: { statusCode?: number }) => {
      if (err?.statusCode === 404) throw notFoundError("Deployment", { namespace, app });
      throw err;
    });

  const selector = getDeploymentSelector(deployment);
  const podResult = await coreApi.listNamespacedPod({ namespace });
  const pods = (podResult.items ?? []).filter((p) =>
    labelsMatchSelector(p.metadata?.labels ?? {}, selector),
  );

  const timestamps = options.timestamps ?? false;
  const entries: DeploymentLogsResponse["entries"] = [];

  for (const pod of pods) {
    const podName = pod.metadata?.name ?? "unknown";
    const containers = pod.spec?.containers ?? [];
    for (const container of containers) {
      const containerName = container.name ?? "unknown";
      try {
        const logRes = await getPodLogs({
          namespace,
          pod: podName,
          container: containerName,
          tailLines: options.tailLines,
          sinceSeconds: options.sinceSeconds,
          timestamps,
          follow: false,
        });
        entries.push({
          pod: podName,
          container: containerName,
          content: logRes.content,
        });
      } catch {
        entries.push({
          pod: podName,
          container: containerName,
          content: "(erro ao carregar logs)",
        });
      }
    }
  }

  return {
    namespace,
    app,
    options: {
      tailLines: options.tailLines,
      sinceSeconds: options.sinceSeconds,
      timestamps,
    },
    entries,
  };
}
