import { Client } from "pg";

import { AppError } from "../../../lib/errors";
import type { DatabaseConnectionConfig, DatabaseMetadata } from "./types";

function normalizePort(port: unknown, fallback = 5432): number {
  if (typeof port === "number" && Number.isFinite(port)) {
    return port;
  }
  if (typeof port === "string" && port.trim()) {
    const parsed = Number(port);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function resolveConnectionString(config: DatabaseConnectionConfig): string | undefined {
  return config.url ?? config.dbString;
}

export async function fetchPostgresMetadata(config: DatabaseConnectionConfig): Promise<DatabaseMetadata> {
  const connectionString = resolveConnectionString(config);
  const client = new Client(
    connectionString
      ? { connectionString }
      : {
          host: config.host,
          port: normalizePort(config.port),
          user: config.user,
          password: config.password,
          database: config.database,
        },
  );

  try {
    await client.connect();
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

    const versionResult = await client.query<{ version: string }>("SELECT version() AS version");
    const tablesResult = await client.query<{
      schema: string;
      table: string;
      row_estimate: number | null;
      size_bytes: number | null;
    }>(
      `
      SELECT
        ns.nspname AS schema,
        c.relname AS table,
        c.reltuples::bigint AS row_estimate,
        pg_total_relation_size(c.oid)::bigint AS size_bytes
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
        AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY ns.nspname, c.relname
      `,
    );

    const schemas = Array.from(new Set(tablesResult.rows.map((row) => row.schema)));
    return {
      engine: "postgres",
      version: versionResult.rows[0]?.version,
      schemas,
      tables: tablesResult.rows.map((row) => ({
        schema: row.schema,
        table: row.table,
        rowEstimate: row.row_estimate,
        sizeBytes: row.size_bytes,
      })),
    };
  } catch (error) {
    throw new AppError(502, "UPSTREAM_UNAVAILABLE", "Failed to connect/read PostgreSQL metadata", {
      reason: error instanceof Error ? error.message : "Unknown error",
      host: config.host,
      database: config.database,
    });
  } finally {
    await client.end().catch(() => undefined);
  }
}

const SAFE_IDENTIFIER = /^[a-zA-Z0-9_]+$/;

function assertSafeIdentifier(value: string, name: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new AppError(400, "BAD_REQUEST", `Invalid ${name}: must be alphanumeric or underscore`);
  }
}

export async function fetchPostgresTableData(
  config: DatabaseConnectionConfig,
  schema: string,
  table: string,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  assertSafeIdentifier(schema, "schema");
  assertSafeIdentifier(table, "table");

  const connectionString = resolveConnectionString(config);
  const client = new Client(
    connectionString
      ? { connectionString }
      : {
          host: config.host,
          port: normalizePort(config.port),
          user: config.user,
          password: config.password,
          database: config.database,
        },
  );

  try {
    await client.connect();
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

    const result = await client.query(
      `SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows as Record<string, unknown>[];
  } catch (error) {
    throw new AppError(502, "UPSTREAM_UNAVAILABLE", "Failed to read table data from PostgreSQL", {
      reason: error instanceof Error ? error.message : "Unknown error",
      schema,
      table,
    });
  } finally {
    await client.end().catch(() => undefined);
  }
}
