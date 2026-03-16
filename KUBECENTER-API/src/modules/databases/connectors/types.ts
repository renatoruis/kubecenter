export interface DatabaseConnectionConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  url?: string;
  dbString?: string;
}

export interface DatabaseTableMetadata {
  schema: string;
  table: string;
  rowEstimate?: number | null;
  sizeBytes?: number | null;
}

export interface DatabaseMetadata {
  engine: "postgres" | "mysql";
  version?: string;
  schemas: string[];
  tables: DatabaseTableMetadata[];
}
