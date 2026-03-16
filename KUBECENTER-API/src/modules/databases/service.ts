import { AppError } from "../../lib/errors";
import { appsApi, assertNamespaceAllowed, coreApi } from "../../lib/k8s";
import { fetchMySqlMetadata, fetchMySqlTableData } from "./connectors/mysql";
import { fetchPostgresMetadata, fetchPostgresTableData } from "./connectors/postgres";
import type { DatabaseMetadata } from "./connectors/types";
import { discoverDatabasesFromWorkloads, type DiscoveredDatabaseConfig } from "./detector";

export interface DatabaseInspectionItem {
  source: DiscoveredDatabaseConfig["source"];
  config: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    url?: string;
    dbString?: string;
  };
  inferredEngine: DiscoveredDatabaseConfig["inferredEngine"];
  connected: boolean;
  metadata?: DatabaseMetadata;
  warning?: string;
}

export interface DatabasesByAppResponse {
  namespace: string;
  app: string;
  discoveredCount: number;
  inspectedAt: string;
  databases: DatabaseInspectionItem[];
}

function maskPassword(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  return "***";
}

function sanitizeConnectionString(value?: string): string | undefined {
  if (!value) {
    return value;
  }
  return value.replace(/(postgres(?:ql)?:\/\/[^:\s]+:)([^@]+)(@)/i, "$1***$3").replace(
    /(mysql:\/\/[^:\s]+:)([^@]+)(@)/i,
    "$1***$3",
  );
}

async function inspectDatabase(config: DiscoveredDatabaseConfig): Promise<DatabaseInspectionItem> {
  const baseItem: DatabaseInspectionItem = {
    source: config.source,
    inferredEngine: config.inferredEngine,
    connected: false,
    config: {
      host: config.host,
      port: config.port,
      user: config.user,
      password: maskPassword(config.password),
      database: config.database,
      url: sanitizeConnectionString(config.url),
      dbString: sanitizeConnectionString(config.dbString),
    },
  };

  try {
    if (config.inferredEngine === "postgres") {
      const metadata = await fetchPostgresMetadata(config);
      return {
        ...baseItem,
        connected: true,
        metadata,
      };
    }

    if (config.inferredEngine === "mysql") {
      const metadata = await fetchMySqlMetadata(config);
      return {
        ...baseItem,
        connected: true,
        metadata,
      };
    }

    return {
      ...baseItem,
      warning: "Unsupported or unknown database engine. Expected postgres/mysql.",
    };
  } catch (error) {
    return {
      ...baseItem,
      warning: error instanceof Error ? error.message : "Database inspection failed",
    };
  }
}

export async function getDatabasesByApp(
  namespace: string,
  app: string,
): Promise<DatabasesByAppResponse> {
  assertNamespaceAllowed(namespace);
  const discovered = await discoverDatabasesFromWorkloads(appsApi, coreApi, namespace, app);

  if (discovered.length === 0) {
    throw new AppError(404, "NOT_FOUND", "No database configuration found for app", {
      namespace,
      app,
    });
  }

  const inspections = await Promise.all(discovered.map((config) => inspectDatabase(config)));
  return {
    namespace,
    app,
    discoveredCount: discovered.length,
    inspectedAt: new Date().toISOString(),
    databases: inspections,
  };
}

export interface TableDataResponse {
  namespace: string;
  app: string;
  schema: string;
  table: string;
  rows: Record<string, unknown>[];
  limit: number;
  offset: number;
}

export async function getTableData(
  namespace: string,
  app: string,
  schema: string,
  table: string,
  limit: number,
  offset: number,
): Promise<TableDataResponse> {
  assertNamespaceAllowed(namespace);

  const limitNum = Math.min(Math.max(1, Math.floor(limit) || 100), 1000);
  const offsetNum = Math.max(0, Math.floor(offset) || 0);

  const discovered = await discoverDatabasesFromWorkloads(appsApi, coreApi, namespace, app);

  for (const config of discovered) {
    const inspection = await inspectDatabase(config);
    const hasTable = inspection.metadata?.tables?.some(
      (t) => t.schema === schema && t.table === table,
    );
    if (!hasTable) continue;

    let rows: Record<string, unknown>[];
    if (config.inferredEngine === "postgres") {
      rows = await fetchPostgresTableData(config, schema, table, limitNum, offsetNum);
    } else if (config.inferredEngine === "mysql") {
      rows = await fetchMySqlTableData(config, schema, table, limitNum, offsetNum);
    } else {
      throw new AppError(400, "UNSUPPORTED_ENGINE", "Table data only supported for postgres/mysql");
    }

    return {
      namespace,
      app,
      schema,
      table,
      rows,
      limit: limitNum,
      offset: offsetNum,
    };
  }

  throw new AppError(404, "NOT_FOUND", "Table not found in any discovered database", {
    namespace,
    app,
    schema,
    table,
  });
}
