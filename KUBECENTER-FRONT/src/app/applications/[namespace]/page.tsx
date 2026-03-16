"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/timeAgo";
import {
  Layers,
  Boxes,
  Container,
  Network,
  Globe,
  AlertTriangle,
  Cpu,
  MemoryStick,
  Calendar,
} from "lucide-react";
import type { NamespaceOverview } from "@/lib/types";

interface PageProps {
  params: Promise<{ namespace: string }>;
}

function PodStatusBar({ pods }: { pods: NamespaceOverview["pods"] }) {
  if (pods.total === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">Nenhum pod neste namespace</p>
    );
  }

  const segments = [
    { label: "Running", count: pods.running, color: "bg-emerald-500" },
    { label: "Pending", count: pods.pending, color: "bg-amber-500" },
    { label: "Failed", count: pods.failed, color: "bg-red-500" },
    { label: "Succeeded", count: pods.succeeded, color: "bg-blue-500" },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-all duration-300`}
            style={{ width: `${(s.count / pods.total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className={`inline-block h-2 w-2 rounded-full ${s.color}`} />
            {s.label}: <span className="font-medium text-[var(--text-secondary)] tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type DeploymentRow = NamespaceOverview["deployments"][number];
type EventRow = NamespaceOverview["events"][number];

export default function NamespaceOverviewPage({ params }: PageProps) {
  const { namespace } = use(params);

  const { data, error, loading, lastUpdated } = useApi<NamespaceOverview>(
    `/namespaces/${namespace}/overview`,
    undefined,
    { refreshInterval: 30000 },
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-[var(--radius-lg)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius-xl)]" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-[var(--radius-xl)]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
          <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Erro ao carregar namespace"
        description={error}
      />
    );
  }

  if (!data) return null;

  const deploymentColumns = [
    {
      key: "name",
      header: "Nome",
      render: (row: DeploymentRow) => (
        <Link
          href={`/applications/${namespace}/${row.name}`}
          className="font-medium text-[var(--accent)] hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "replicas",
      header: "Réplicas",
      render: (row: DeploymentRow) => (
        <span className="tabular-nums">
          {row.availableReplicas}/{row.replicas}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: DeploymentRow) => (
        <Badge
          variant={row.status}
          dot
        >
          {row.status === "healthy" ? "Saudável" : row.status === "degraded" ? "Degradado" : "Escalado p/ 0"}
        </Badge>
      ),
    },
    {
      key: "image",
      header: "Imagem",
      render: (row: DeploymentRow) => (
        <span className="max-w-[300px] truncate block text-[var(--text-muted)]" title={row.image ?? ""}>
          {row.image ?? "—"}
        </span>
      ),
    },
  ];

  const eventColumns = [
    {
      key: "type",
      header: "Tipo",
      render: (row: EventRow) => (
        <Badge variant={row.type === "Warning" ? "warning" : "success"} dot>
          {row.type}
        </Badge>
      ),
    },
    { key: "reason", header: "Motivo" },
    {
      key: "message",
      header: "Mensagem",
      render: (row: EventRow) => (
        <span className="max-w-[400px] truncate block" title={row.message}>
          {row.message}
        </span>
      ),
    },
    {
      key: "involvedObject",
      header: "Objeto",
      render: (row: EventRow) => (
        <span className="text-[var(--text-muted)]">
          {row.involvedObject.kind}/{row.involvedObject.name}
        </span>
      ),
    },
    {
      key: "timestamp",
      header: "Quando",
      render: (row: EventRow) => (
        <span className="text-[var(--text-muted)] tabular-nums" title={row.timestamp ?? ""}>
          {timeAgo(row.timestamp)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-blue-500/10">
          <Layers className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{data.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={data.status === "Active" ? "success" : "warning"} dot>
              {data.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Deployments"
          value={data.deployments.length}
          icon={<Boxes className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Pods"
          value={data.pods.total}
          icon={<Container className="h-5 w-5" />}
          color="green"
          subtitle={
            data.pods.total > 0 ? (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-[var(--bg-muted)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--success)]"
                    style={{ width: `${Math.round((data.pods.running / data.pods.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  {Math.round((data.pods.running / data.pods.total) * 100)}%
                </span>
              </div>
            ) : undefined
          }
        />
        <StatCard
          label="Services"
          value={data.services}
          icon={<Network className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          label="Ingresses"
          value={data.ingresses}
          icon={<Globe className="h-5 w-5" />}
          color="slate"
        />
      </div>

      <Card title="Status dos Pods" icon={<Container className="h-4 w-4" />}>
        <PodStatusBar pods={data.pods} />
      </Card>

      {data.resourceUsage.available && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-blue-500/10">
              <Cpu className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">CPU Total</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{data.resourceUsage.cpuUsage}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-amber-500/10">
              <MemoryStick className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Memória Total</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{data.resourceUsage.memoryUsage}</p>
            </div>
          </div>
        </div>
      )}

      <Card title="Deployments" icon={<Boxes className="h-4 w-4" />}>
        <DataTable<DeploymentRow>
          columns={deploymentColumns}
          data={data.deployments}
          getRowKey={(row) => row.name}
          emptyTitle="Nenhum deployment"
          emptyDescription="Este namespace não possui deployments."
        />
      </Card>

      <Card title="Eventos Recentes" icon={<Calendar className="h-4 w-4" />}>
        <DataTable<EventRow>
          columns={eventColumns}
          data={data.events}
          getRowKey={(row) => `${row.reason}-${row.timestamp}-${row.involvedObject.name}`}
          emptyTitle="Nenhum evento"
          emptyDescription="Nenhum evento recente neste namespace."
        />
      </Card>

      {lastUpdated && (
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            Atualizado {timeAgo(lastUpdated)}
          </span>
        </div>
      )}
    </div>
  );
}
