"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { NamespaceAppFilters } from "@/components/filters/NamespaceAppFilters";
import { TableSkeleton } from "@/components/ui/Skeleton";
import type { ApplicationListItem, PodListItem } from "@/lib/types";

function inferAppFromPodName(podName: string): string {
  const parts = podName.split("-");
  if (parts.length >= 3) {
    return parts.slice(0, -2).join("-");
  }
  return podName;
}

export function PodsList() {
  const [namespace, setNamespace] = useState("");
  const [app, setApp] = useState("");

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (namespace) p.namespace = namespace;
    if (app) p.app = app;
    return Object.keys(p).length > 0 ? p : undefined;
  }, [namespace, app]);

  const { data: pods, error, loading } = useApi<PodListItem[]>("/pods", params);
  const { data: applications } = useApi<ApplicationListItem[]>("/applications");

  const namespaces = useMemo(() => {
    const fromApps = applications ? [...new Set(applications.map((a) => a.namespace))] : [];
    const fromPods = pods ? [...new Set(pods.map((p) => p.namespace))] : [];
    return [...new Set([...fromApps, ...fromPods])].sort();
  }, [applications, pods]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-48 animate-shimmer rounded-[var(--radius-md)]" />
          <div className="h-10 w-48 animate-shimmer rounded-[var(--radius-md)]" />
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)]">
          <TableSkeleton rows={8} cols={6} />
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

  const displayPods = pods ?? [];

  const columns = [
    {
      key: "name",
      header: "Pod",
      render: (row: PodListItem) => {
        const appName = inferAppFromPodName(row.name);
        return (
          <Link
            href={`/applications/${row.namespace}/${appName}`}
            className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
          >
            {row.name}
          </Link>
        );
      },
    },
    {
      key: "namespace",
      header: "Namespace",
      render: (row: PodListItem) => (
        <span className="font-mono text-xs text-[var(--text-muted)]">{row.namespace}</span>
      ),
    },
    {
      key: "node",
      header: "Node",
      render: (row: PodListItem) => (
        <span className="text-[var(--text-secondary)]">{row.node || "-"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: PodListItem) => (
        <Badge variant={row.status === "Running" ? "success" : "warning"} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "restartCount",
      header: "Restarts",
      render: (row: PodListItem) => (
        <span className="tabular-nums">{row.restartCount}</span>
      ),
    },
    {
      key: "images",
      header: "Image",
      render: (row: PodListItem) => (
        <span
          className="inline-block max-w-[200px] truncate font-mono text-xs text-[var(--text-muted)]"
          title={row.images.join(", ")}
        >
          {row.images[0] || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <NamespaceAppFilters
          namespaces={namespaces}
          applications={applications || []}
          namespace={namespace}
          app={app}
          onNamespaceChange={setNamespace}
          onAppChange={setApp}
        />
      </div>

      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <DataTable
          columns={columns}
          data={displayPods}
          getRowKey={(row) => `${row.namespace}/${row.name}`}
          onRowClick={(row) => {
            const appName = inferAppFromPodName(row.name);
            window.location.href = `/applications/${row.namespace}/${appName}`;
          }}
          emptyTitle="Nenhum pod encontrado"
          emptyDescription="Tente ajustar os filtros."
        />
      </div>

      <p className="text-xs text-[var(--text-muted)]">{displayPods.length} pod(s)</p>
    </div>
  );
}
