import type { AppsV1Api, CoreV1Api } from "@kubernetes/client-node";

import { AppError } from "../../lib/errors";
import type { DatabaseConnectionConfig } from "./connectors/types";

const DATABASE_KEYS = new Set([
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_URL",
  "DATABASE_URL",
  "DBSTRING",
]);

type SecretCache = Map<string, Record<string, string>>;

export interface DatabaseDiscoverySource {
  workloadKind: string;
  workloadName: string;
  containerName: string;
}

export interface DiscoveredDatabaseConfig extends DatabaseConnectionConfig {
  source: DatabaseDiscoverySource;
  inferredEngine: "postgres" | "mysql" | "unknown";
  rawEnv: Record<string, string>;
}

function isDatabaseEnvName(name: string): boolean {
  return DATABASE_KEYS.has(name) || name.startsWith("DB_");
}

function normalizeEnvIntoConfig(env: Record<string, string>): DatabaseConnectionConfig {
  const rawPort = env.DB_PORT;
  const parsedPort = rawPort ? Number(rawPort) : undefined;
  return {
    host: env.DB_HOST,
    port: Number.isFinite(parsedPort) ? parsedPort : undefined,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    url: env.DB_URL ?? env.DATABASE_URL,
    dbString: env.DBSTRING,
  };
}

function inferEngine(config: DatabaseConnectionConfig): "postgres" | "mysql" | "unknown" {
  const urlOrString = (config.url ?? config.dbString ?? "").toLowerCase();
  if (urlOrString.startsWith("postgres://") || urlOrString.startsWith("postgresql://")) {
    return "postgres";
  }
  if (urlOrString.startsWith("mysql://")) {
    return "mysql";
  }

  if (config.port === 5432) {
    return "postgres";
  }
  if (config.port === 3306) {
    return "mysql";
  }

  return "unknown";
}

function getAppLabel(labels: Record<string, string> | undefined): string | undefined {
  if (!labels) {
    return undefined;
  }
  return labels.app ?? labels["app.kubernetes.io/name"] ?? labels["k8s-app"];
}

async function readSecretData(
  coreV1Api: CoreV1Api,
  namespace: string,
  secretName: string,
  cache: SecretCache,
): Promise<Record<string, string>> {
  if (!secretName) {
    return {};
  }

  const cacheKey = `${namespace}/${secretName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let raw: any;
  try {
    raw = await (coreV1Api as any).readNamespacedSecret({ namespace, name: secretName });
  } catch {
    return {};
  }
  const secret = raw?.body ?? raw;
  const data = (secret?.data ?? {}) as Record<string, string>;
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!value) {
      continue;
    }
    try {
      resolved[key] = Buffer.from(value, "base64").toString("utf8");
    } catch {
      resolved[key] = value;
    }
  }

  cache.set(cacheKey, resolved);
  return resolved;
}

async function resolveContainerDbEnv(
  coreV1Api: CoreV1Api,
  namespace: string,
  container: any,
  secretCache: SecretCache,
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};

  for (const envVar of container?.env ?? []) {
    if (!envVar?.name || !isDatabaseEnvName(envVar.name)) {
      continue;
    }

    if (typeof envVar.value === "string") {
      resolved[envVar.name] = envVar.value;
      continue;
    }

    const secretRef = envVar.valueFrom?.secretKeyRef;
    if (secretRef?.name && secretRef?.key) {
      const secretData = await readSecretData(coreV1Api, namespace, secretRef.name, secretCache);
      if (secretData[secretRef.key] !== undefined) {
        resolved[envVar.name] = secretData[secretRef.key];
      }
    }
  }

  for (const envFrom of container?.envFrom ?? []) {
    const secretName = envFrom?.secretRef?.name;
    if (!secretName) {
      continue;
    }
    const secretData = await readSecretData(coreV1Api, namespace, secretName, secretCache);
    for (const [key, value] of Object.entries(secretData)) {
      if (isDatabaseEnvName(key)) {
        resolved[key] = value;
      }
    }
  }

  return resolved;
}

function buildDiscoveredConfig(
  source: DatabaseDiscoverySource,
  env: Record<string, string>,
): DiscoveredDatabaseConfig | null {
  const config = normalizeEnvIntoConfig(env);
  if (!config.url && !config.dbString && !config.host) {
    return null;
  }

  return {
    ...config,
    source,
    rawEnv: env,
    inferredEngine: inferEngine(config),
  };
}

export async function discoverDatabasesFromWorkloads(
  appsV1Api: AppsV1Api,
  coreV1Api: CoreV1Api,
  namespace: string,
  app: string,
): Promise<DiscoveredDatabaseConfig[]> {
  const secretCache: SecretCache = new Map();
  const discovered: DiscoveredDatabaseConfig[] = [];

  const [deploymentsRaw, statefulSetsRaw] = await Promise.all([
    (appsV1Api as any).listNamespacedDeployment({ namespace }),
    (appsV1Api as any).listNamespacedStatefulSet({ namespace }),
  ]);

  const workloads: Array<{ kind: string; item: any }> = [];
  for (const deployment of deploymentsRaw?.body?.items ?? deploymentsRaw?.items ?? []) {
    workloads.push({ kind: "Deployment", item: deployment });
  }
  for (const statefulSet of statefulSetsRaw?.body?.items ?? statefulSetsRaw?.items ?? []) {
    workloads.push({ kind: "StatefulSet", item: statefulSet });
  }

  const matching = workloads.filter(({ item }) => {
    const labels = item?.metadata?.labels as Record<string, string> | undefined;
    return getAppLabel(labels) === app || item?.metadata?.name === app;
  });

  for (const { kind, item } of matching) {
    const workloadName = item?.metadata?.name ?? "unknown-workload";
    const containers = item?.spec?.template?.spec?.containers ?? [];

    for (const container of containers) {
      const env = await resolveContainerDbEnv(coreV1Api, namespace, container, secretCache);
      const source: DatabaseDiscoverySource = {
        workloadKind: kind,
        workloadName,
        containerName: container?.name ?? "unknown-container",
      };
      const config = buildDiscoveredConfig(source, env);
      if (config) {
        discovered.push(config);
      }
    }
  }

  if (matching.length === 0) {
    throw new AppError(404, "NOT_FOUND", "No workloads found for requested app", { namespace, app });
  }

  return discovered;
}
