import { EmptyState } from "./EmptyState";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyTitle = "Nenhum resultado",
  emptyDescription,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`sticky top-0 bg-slate-800/50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={getRowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-[var(--border-subtle)] last:border-0 ${
                idx % 2 === 1 ? "bg-[var(--bg-muted)]" : ""
              } ${onRowClick ? "cursor-pointer hover:bg-slate-800/30" : "hover:bg-slate-800/30"}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-sm text-[var(--text-secondary)] ${col.className ?? ""}`}
                >
                  {col.render
                    ? col.render(row)
                    : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
