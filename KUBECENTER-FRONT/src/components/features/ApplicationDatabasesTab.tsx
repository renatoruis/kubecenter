"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Database,
  Table2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Server,
  HardDrive,
  Search,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { DatabasesResponse, TableDataResponse } from "@/lib/types";

type DbEntry = DatabasesResponse["databases"][number];
type TableEntry = NonNullable<DbEntry["metadata"]>["tables"][number];

interface ApplicationDatabasesTabProps {
  namespace: string;
  app: string;
}

function DatabaseCard({
  db,
  onClick,
}: {
  db: DbEntry;
  onClick: () => void;
}) {
  const tableCount = db.metadata?.tables?.length ?? 0;
  return (
    <button
      onClick={onClick}
      disabled={!db.connected}
      className="group w-full text-left rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-blue-500/10">
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)]">
              {db.source.containerName}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {db.inferredEngine} &middot; {db.config.host ?? "localhost"}:
              {db.config.port ?? "—"}
            </p>
          </div>
        </div>
        <Badge variant={db.connected ? "success" : "warning"} dot>
          {db.connected ? "Conectado" : "Offline"}
        </Badge>
      </div>
      {db.metadata && (
        <div className="mt-3 flex gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Server className="h-3.5 w-3.5" />
            {db.metadata.version ?? db.metadata.engine}
          </span>
          <span className="flex items-center gap-1">
            <Table2 className="h-3.5 w-3.5" />
            {tableCount} tabela{tableCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3.5 w-3.5" />
            {db.metadata.schemas.length} schema
            {db.metadata.schemas.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {db.warning && (
        <p className="mt-2 text-xs text-amber-400">{db.warning}</p>
      )}
    </button>
  );
}

function TableBrowser({
  tables,
  selected,
  onSelect,
}: {
  tables: TableEntry[];
  selected: { schema: string; table: string } | null;
  onSelect: (schema: string, table: string) => void;
}) {
  const grouped = tables.reduce<Record<string, TableEntry[]>>((acc, t) => {
    (acc[t.schema] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="flex flex-col border-r border-[var(--border)] overflow-y-auto">
      <div className="sticky top-0 bg-slate-900/80 border-b border-[var(--border)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Tabelas
        </p>
      </div>
      <div className="flex-1 py-1">
        {Object.entries(grouped).map(([schema, schemaTables]) => (
          <div key={schema}>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {schema}
            </p>
            {schemaTables.map((t) => {
              const isActive =
                selected?.schema === t.schema && selected?.table === t.table;
              return (
                <button
                  key={`${t.schema}.${t.table}`}
                  onClick={() => onSelect(t.schema, t.table)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-slate-800/30 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Table2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.table}</span>
                  </span>
                  {t.rowEstimate != null && (
                    <span className="shrink-0 text-[10px] text-[var(--text-muted)] tabular-nums">
                      {t.rowEstimate.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableDataViewer({
  namespace,
  app,
  schema,
  table,
}: {
  namespace: string;
  app: string;
  schema: string;
  table: string;
}) {
  const [data, setData] = useState<TableDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [filter, setFilter] = useState("");
  const [filterCol, setFilterCol] = useState("__all__");

  const loadData = async (off: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<TableDataResponse>(
        `/databases/${namespace}/${app}/tables/${schema}/${table}/data`,
        { limit, offset: off },
      );
      setData(res);
      setOffset(off);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const columns = data?.rows[0] ? Object.keys(data.rows[0]) : [];

  const filteredRows = data?.rows.filter((row) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    if (filterCol === "__all__") {
      return Object.values(row).some((val) =>
        String(val ?? "").toLowerCase().includes(q),
      );
    }
    return String((row as Record<string, unknown>)[filterCol] ?? "").toLowerCase().includes(q);
  }) ?? [];

  useEffect(() => {
    void loadData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="flex-1 p-6">
        <Skeleton className="h-64 rounded-[var(--radius-md)]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="sticky top-0 flex items-center justify-between gap-3 bg-slate-900/80 border-b border-[var(--border)] px-5 py-3">
        <div className="shrink-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {schema}.{table}
          </h3>
          {data && (
            <p className="text-[11px] text-[var(--text-muted)]">
              {filter ? `${filteredRows.length} de ` : ""}{data.rows.length} linhas &middot; offset {data.offset}
            </p>
          )}
        </div>
        <div className="flex flex-1 max-w-md items-stretch gap-0 rounded-md border border-slate-700 bg-slate-800/50 overflow-hidden">
          <select
            value={filterCol}
            onChange={(e) => setFilterCol(e.target.value)}
            className="shrink-0 border-r border-slate-700 bg-transparent px-2.5 py-1.5 text-xs text-[var(--text-muted)] focus:outline-none"
          >
            <option value="__all__">Todas colunas</option>
            {columns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={filterCol === "__all__" ? "Filtrar dados..." : `Filtrar por ${filterCol}...`}
              className="w-full bg-transparent py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft className="h-3.5 w-3.5" />}
            onClick={() => void loadData(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconRight={<ChevronRight className="h-3.5 w-3.5" />}
            onClick={() => void loadData(offset + limit)}
            disabled={!data || data.rows.length < limit || loading}
          >
            Próxima
          </Button>
        </div>
      </div>

      {error && (
        <div className="m-4 rounded-[var(--radius-md)] border border-red-500/20 bg-[var(--error-subtle)] p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {data && data.rows.length > 0 ? (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {Object.keys(data.rows[0]).map((col) => (
                  <th
                    key={col}
                    className="sticky top-0 bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-slate-800/30 ${
                    i % 2 === 1 ? "bg-[var(--bg-muted)]" : ""
                  }`}
                >
                  {Object.entries(row).map(([key, val]) => (
                    <td
                      key={key}
                      className="max-w-[300px] truncate px-4 py-2.5 text-sm text-[var(--text-secondary)]"
                      title={String(val ?? "")}
                    >
                      {val === null || val === undefined ? (
                        <span className="italic text-[var(--text-muted)]">
                          NULL
                        </span>
                      ) : typeof val === "object" ? (
                        <span className="font-mono text-xs">
                          {JSON.stringify(val)}
                        </span>
                      ) : (
                        String(val)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : data && !loading ? (
          <EmptyState
            icon={<Table2 className="h-6 w-6" />}
            title="Nenhum registro encontrado"
            description="Esta tabela está vazia."
          />
        ) : null}
      </div>
    </div>
  );
}

export function ApplicationDatabasesTab({
  namespace,
  app,
}: ApplicationDatabasesTabProps) {
  const { data, error, loading } = useApi<DatabasesResponse>(
    `/databases/${namespace}/${app}`,
  );
  const [activeDbIdx, setActiveDbIdx] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    table: string;
  } | null>(null);

  if (loading) return <Skeleton className="h-64 rounded-[var(--radius-xl)]" />;
  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--error-subtle)] p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data || data.discoveredCount === 0) {
    return (
      <EmptyState
        icon={<Database className="h-6 w-6" />}
        title="Nenhum banco de dados descoberto"
        description="Nenhuma conexão de banco de dados foi detectada nas variáveis de ambiente desta aplicação."
      />
    );
  }

  const activeDb = activeDbIdx != null ? data.databases[activeDbIdx] : null;

  if (activeDb) {
    const tables = activeDb.metadata?.tables ?? [];
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setActiveDbIdx(null);
            setSelectedTable(null);
          }}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para bancos de dados
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-blue-500/10">
            <Database className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {activeDb.source.containerName}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {activeDb.inferredEngine} &middot; {activeDb.config.host}:
              {activeDb.config.port}
              {activeDb.metadata?.version
                ? ` · ${activeDb.metadata.version}`
                : ""}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex h-[520px]">
            <div className="w-64 shrink-0">
              <TableBrowser
                tables={tables}
                selected={selectedTable}
                onSelect={(schema, table) =>
                  setSelectedTable({ schema, table })
                }
              />
            </div>
            {selectedTable ? (
              <TableDataViewer
                key={`${selectedTable.schema}.${selectedTable.table}`}
                namespace={namespace}
                app={app}
                schema={selectedTable.schema}
                table={selectedTable.table}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={<Table2 className="h-6 w-6" />}
                  title="Selecione uma tabela"
                  description="Escolha uma tabela à esquerda para visualizar seus dados."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        {data.discoveredCount} banco(s) descoberto(s) &middot; Inspecionado em{" "}
        {new Date(data.inspectedAt).toLocaleString("pt-BR")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.databases.map((db, idx) => (
          <DatabaseCard
            key={idx}
            db={db}
            onClick={() => setActiveDbIdx(idx)}
          />
        ))}
      </div>
    </div>
  );
}
