"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { NamespaceAppFilters } from "@/components/filters/NamespaceAppFilters";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Search } from "lucide-react";
import type { ApplicationListItem } from "@/lib/types";

export function ApplicationsList() {
  const searchParams = useSearchParams();
  const { data, error, loading } = useApi<ApplicationListItem[]>(
    "/applications",
    undefined,
    { refreshInterval: 30000 },
  );
  const [namespace, setNamespace] = useState(searchParams.get("namespace") ?? "");
  const [app, setApp] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (namespace) list = list.filter((a) => a.namespace === namespace);
    if (app) list = list.filter((a) => a.name === app);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.namespace.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, namespace, app, search]);

  const namespaces = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map((a) => a.namespace))].sort();
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-48 animate-shimmer rounded-[var(--radius-md)]" />
          <div className="h-10 w-48 animate-shimmer rounded-[var(--radius-md)]" />
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)]">
          <TableSkeleton rows={8} cols={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--error-subtle)] p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  const columns = [
    {
      key: "name",
      header: "Nome",
      render: (row: ApplicationListItem) => (
        <Link
          href={`/applications/${row.namespace}/${row.name}`}
          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "namespace",
      header: "Namespace",
      render: (row: ApplicationListItem) => (
        <span className="font-mono text-xs text-[var(--text-muted)]">{row.namespace}</span>
      ),
    },
    {
      key: "replicas",
      header: "Replicas",
      render: (row: ApplicationListItem) => (
        <span className="tabular-nums">
          {row.availableReplicas}/{row.replicas}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: ApplicationListItem) => (
        <Badge variant={row.status} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "image",
      header: "Image",
      render: (row: ApplicationListItem) => (
        <span
          className="inline-block max-w-[220px] truncate font-mono text-xs text-[var(--text-muted)]"
          title={row.image || undefined}
        >
          {row.image || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <NamespaceAppFilters
          namespaces={namespaces}
          applications={data || []}
          namespace={namespace}
          app={app}
          onNamespaceChange={setNamespace}
          onAppChange={setApp}
        />
        <Input
          label="Busca"
          placeholder="Nome ou namespace..."
          icon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1"
        />
      </div>

      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(row) => `${row.namespace}/${row.name}`}
          onRowClick={(row) => {
            window.location.href = `/applications/${row.namespace}/${row.name}`;
          }}
          emptyTitle="Nenhuma aplicação encontrada"
          emptyDescription="Tente ajustar os filtros ou a busca."
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {filtered.length} de {data?.length ?? 0} aplicação(ões)
        </p>
      </div>
    </div>
  );
}
