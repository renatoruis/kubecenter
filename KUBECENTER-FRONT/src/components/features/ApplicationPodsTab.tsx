"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/timeAgo";
import { YamlViewerModal } from "@/components/ui/YamlViewerModal";
import {
  Container,
  Server,
  HardDrive,
  AlertTriangle,
  ChevronUp,
  Tag,
  Code,
} from "lucide-react";
import type { PodListItem, PodDescribeResponse } from "@/lib/types";

interface ApplicationPodsTabProps {
  namespace: string;
  app: string;
}

function formatUptime(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return "—";
  const totalMins = Math.floor(diff / 60000);
  if (totalMins < 1) return "< 1min";
  if (totalMins < 60) return `${totalMins}min`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function PodDescribePanel({
  namespace,
  podName,
  onClose,
  onViewYaml,
}: {
  namespace: string;
  podName: string;
  onClose: () => void;
  onViewYaml: (name: string) => void;
}) {
  const { data, loading, error } = useApi<PodDescribeResponse>(
    `/pods/${namespace}/describe/${podName}`,
  );

  if (loading) return <Skeleton className="h-64 rounded-[var(--radius-xl)]" />;
  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--error-subtle)] p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {data.name}
          </h3>
          <button
            onClick={() => onViewYaml(data.name)}
            className="rounded-[var(--radius-md)] p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50"
            title="Ver YAML"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button variant="ghost" size="sm" icon={<ChevronUp className="h-4 w-4" />} onClick={onClose}>
          Fechar
        </Button>
      </div>

      {/* Pod Info */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-md)] bg-slate-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</p>
          <Badge variant={data.status === "Running" ? "success" : "warning"} dot className="mt-1">
            {data.status}
          </Badge>
        </div>
        <div className="rounded-[var(--radius-md)] bg-slate-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Node</p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{data.node ?? "—"}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-slate-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">IP</p>
          <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">{data.ip ?? "—"}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-slate-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">QoS</p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{data.qosClass ?? "—"}</p>
        </div>
      </div>

      {/* Conditions */}
      {data.conditions.length > 0 && (
        <Card title="Conditions" icon={<Server className="h-4 w-4" />}>
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Condição</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Razão</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Última transição</th>
                </tr>
              </thead>
              <tbody>
                {data.conditions.map((c, i) => (
                  <tr key={i} className={`border-b border-[var(--border-subtle)] last:border-0 ${i % 2 === 1 ? "bg-[var(--bg-muted)]" : ""}`}>
                    <td className="px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]">{c.type}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={c.status === "True" ? "success" : c.status === "False" ? "error" : "warning"} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{c.reason || "—"}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">
                      {c.lastTransitionTime ? <span title={c.lastTransitionTime}>{timeAgo(c.lastTransitionTime)}</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Containers */}
      <Card title={`Containers (${data.containers.length})`} icon={<Container className="h-4 w-4" />}>
        <div className="space-y-4">
          {data.containers.map((c) => (
            <div key={c.name} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
              <div className={`flex items-center justify-between px-4 py-3 ${c.ready ? "bg-emerald-500/5 border-b border-emerald-500/10" : "bg-red-500/5 border-b border-red-500/10"}`}>
                <div className="flex items-center gap-2.5">
                  <Container className={`h-4 w-4 ${c.ready ? "text-emerald-400" : "text-red-400"}`} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</span>
                  <Badge variant={c.ready ? "success" : "error"} dot>{c.state}</Badge>
                  {c.restartCount > 0 && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                      c.restartCount >= 10 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {c.restartCount} {c.restartCount === 1 ? "restart" : "restarts"}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Imagem</p>
                  <p className="font-mono text-xs text-[var(--text-secondary)] break-all">{c.image}</p>
                </div>

                {c.stateDetail && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Detalhe</p>
                    <p className="text-xs text-amber-400">{c.stateDetail}</p>
                  </div>
                )}

                {(c.ports?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Portas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.ports.map((p, pi) => (
                        <span key={pi} className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                          {p.containerPort}/{p.protocol}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(Object.keys(c.resources?.requests ?? {}).length > 0 || Object.keys(c.resources?.limits ?? {}).length > 0) && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recursos</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-subtle)]">
                            <th className="pr-6 pb-1.5 text-left font-medium text-[var(--text-muted)]"></th>
                            <th className="pr-6 pb-1.5 text-left font-medium text-[var(--text-muted)]">CPU</th>
                            <th className="pb-1.5 text-left font-medium text-[var(--text-muted)]">Memória</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[var(--border-subtle)]">
                            <td className="pr-6 py-1.5 font-medium text-[var(--text-secondary)]">Requests</td>
                            <td className="pr-6 py-1.5 font-mono text-[var(--text-primary)]">{c.resources?.requests?.cpu || "—"}</td>
                            <td className="py-1.5 font-mono text-[var(--text-primary)]">{c.resources?.requests?.memory || "—"}</td>
                          </tr>
                          <tr>
                            <td className="pr-6 py-1.5 font-medium text-[var(--text-secondary)]">Limits</td>
                            <td className="pr-6 py-1.5 font-mono text-[var(--text-primary)]">{c.resources?.limits?.cpu || "—"}</td>
                            <td className="py-1.5 font-mono text-[var(--text-primary)]">{c.resources?.limits?.memory || "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Volumes */}
      {data.volumes.length > 0 && (
        <Card title={`Volumes (${data.volumes.length})`} icon={<HardDrive className="h-4 w-4" />}>
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Nome</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {data.volumes.map((v, i) => (
                  <tr key={i} className={`border-b border-[var(--border-subtle)] last:border-0 ${i % 2 === 1 ? "bg-[var(--bg-muted)]" : ""}`}>
                    <td className="px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]">{v.name}</td>
                    <td className="px-4 py-2.5"><Badge variant="default">{v.type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Labels & Annotations */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.keys(data.labels).length > 0 && (
          <Card title="Labels" icon={<Tag className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.labels).map(([k, v]) => (
                <span key={k} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-[var(--text-secondary)]">
                  {k}={v}
                </span>
              ))}
            </div>
          </Card>
        )}
        {Object.keys(data.annotations).length > 0 && (
          <Card title="Annotations" icon={<Tag className="h-4 w-4" />}>
            <div className="flex flex-col gap-1">
              {Object.entries(data.annotations).slice(0, 10).map(([k, v]) => (
                <div key={k} className="text-[10px] font-mono truncate text-[var(--text-muted)]" title={`${k}: ${v}`}>
                  <span className="text-[var(--text-secondary)]">{k}</span>: {v}
                </div>
              ))}
              {Object.keys(data.annotations).length > 10 && (
                <span className="text-[10px] text-[var(--text-muted)]">+{Object.keys(data.annotations).length - 10} mais</span>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Events */}
      {data.events.length > 0 && (
        <Card title="Pod Events" icon={<AlertTriangle className="h-4 w-4" />}>
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tipo</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Razão</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Mensagem</th>
                  <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Age</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((ev, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-slate-800/30 ${
                      idx % 2 === 1 ? "bg-[var(--bg-muted)]" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <Badge variant={ev.type === "Warning" ? "warning" : "success"} dot>{ev.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-primary)]">{ev.reason}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] max-w-md truncate" title={ev.message}>{ev.message}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">
                      <span title={ev.lastTimestamp ?? ""}>{timeAgo(ev.lastTimestamp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export function ApplicationPodsTab({ namespace, app }: ApplicationPodsTabProps) {
  const { data, error, loading } = useApi<PodListItem[]>(
    `/pods/${namespace}/${app}`,
  );
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [yamlPod, setYamlPod] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-64 rounded-[var(--radius-xl)]" />;
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
      header: "Pod",
      render: (row: PodListItem) => (
        <span className="font-medium text-[var(--text-primary)]">{row.name}</span>
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
        <div className="flex items-center gap-2">
          <Badge variant={row.status === "Running" ? "success" : "warning"} dot>
            {row.status}
          </Badge>
          {row.restartCount > 0 && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
              row.restartCount >= 10
                ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                : "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
            }`}>
              {row.restartCount} {row.restartCount === 1 ? "restart" : "restarts"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "uptime",
      header: "Idade",
      render: (row: PodListItem) => (
        <span className="tabular-nums text-[var(--text-secondary)]">
          {row.status === "Running" ? formatUptime(row.startTime) : row.status}
        </span>
      ),
    },
    {
      key: "images",
      header: "Images",
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
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <DataTable
          columns={columns}
          data={data || []}
          getRowKey={(row) => row.name}
          onRowClick={(row) => setSelectedPod(row.name === selectedPod ? null : row.name)}
          emptyTitle="Nenhum pod encontrado"
        />
      </div>

      {selectedPod && (
        <PodDescribePanel
          namespace={namespace}
          podName={selectedPod}
          onClose={() => setSelectedPod(null)}
          onViewYaml={(name) => setYamlPod(name)}
        />
      )}

      <YamlViewerModal
        isOpen={yamlPod !== null}
        onClose={() => setYamlPod(null)}
        kind="pod"
        namespace={namespace}
        name={yamlPod ?? ""}
      />
    </div>
  );
}
