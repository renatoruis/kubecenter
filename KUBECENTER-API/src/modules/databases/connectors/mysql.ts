import mysql from "mysql2/promise";

import { AppError } from "../../../lib/errors";
import type { DatabaseConnectionConfig, DatabaseMetadata } from "./types";

function normalizePort(port: unknown, fallback = 3306): number {
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

export async function fetchMySqlMetadata(config: DatabaseConnectionConfig): Promise<DatabaseMetadata> {
  const connection = await mysql.createConnection(
    config.url ?? config.dbString
      ? { uri: (config.url ?? config.dbString) as string }
      : {
          host: config.host,
          port: normalizePort(config.port),
          user: config.user,
          password: config.password,
          database: config.database,
        },
  );

  try {
    await connection.query("SET SESSION TRANSACTION READ ONLY");

    const [versionRowsRaw] = await connection.query("SELECT VERSION() AS version");
    const [tableRowsRaw] = await connection.query(
      `
      SELECT
        t.TABLE_SCHEMA AS schema_name,
        t.TABLE_NAME AS table_name,
        t.TABLE_ROWS AS row_estimate,
        (t.DATA_LENGTH + t.INDEX_LENGTH) AS size_bytes
      FROM information_schema.TABLES t
      WHERE t.TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
      `,
    );
    const versionRows = versionRowsRaw as Array<{ version: string }>;
    const tableRows = tableRowsRaw as Array<{
      schema_name: string;
      table_name: string;
      row_estimate: number | null;
      size_bytes: number | null;
    }>;

    const schemas = Array.from(new Set(tableRows.map((row) => row.schema_name)));
    return {
      engine: "mysql",
      version: versionRows[0]?.version,
      schemas,
      tables: tableRows.map((row) => ({
        schema: row.schema_name,
        table: row.table_name,
        rowEstimate: row.row_estimate,
        sizeBytes: row.size_bytes,
      })),
    };
  } catch (error) {
    throw new AppError(502, "UPSTREAM_UNAVAILABLE", "Failed to connect/read MySQL metadata", {
      reason: error instanceof Error ? error.message : "Unknown error",
      host: config.host,
      database: config.database,
    });
  } finally {
    await connection.end().catch(() => undefined);
  }
}

const SAFE_IDENTIFIER = /^[a-zA-Z0-9_]+$/;

function assertSafeIdentifier(value: string, name: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new AppError(400, "BAD_REQUEST", `Invalid ${name}: must be alphanumeric or underscore`);
  }
}

export async function fetchMySqlTableData(
  config: DatabaseConnectionConfig,
  schema: string,
  table: string,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  assertSafeIdentifier(schema, "schema");
  assertSafeIdentifier(table, "table");

  const connection = await mysql.createConnection(
    config.url ?? config.dbString
      ? { uri: (config.url ?? config.dbString) as string }
      : {
          host: config.host,
          port: normalizePort(config.port),
          user: config.user,
          password: config.password,
          database: config.database,
        },
  );

  try {
    await connection.query("SET SESSION TRANSACTION READ ONLY");

    const [rows] = await connection.query(
      "SELECT * FROM ?? . ?? LIMIT ? OFFSET ?",
      [schema, table, limit, offset],
    );
    return (rows as Record<string, unknown>[]).map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = v;
      }
      return out;
    });
  } catch (error) {
    throw new AppError(502, "UPSTREAM_UNAVAILABLE", "Failed to read table data from MySQL", {
      reason: error instanceof Error ? error.message : "Unknown error",
      schema,
      table,
    });
  } finally {
    await connection.end().catch(() => undefined);
  }
}
