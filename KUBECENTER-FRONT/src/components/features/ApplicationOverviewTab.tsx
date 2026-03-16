"use client";

import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Repeat,
  Box,
  Globe,
  FileText,
  KeyRound,
  Network,
  ArrowRight,
  Container,
  Cpu,
  MemoryStick,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { ApplicationDetail as ApplicationDetailType, MetricsResponse, PodListItem } from "@/lib/types";
import { formatMemory, nanoCoresToMillicores } from "@/lib/utils";

interface ApplicationOverviewTabProps {
  detail: ApplicationDetailType;
  onTabChange?: (tab: string) => void;
}

interface EventsResponse {
  namespace: string;
  app: string;
  events: Array<{
    type: string;
    reason: string;
    message: string;
    count: number;
    firstTimestamp: string | null;
    lastTimestamp: string | null;
    source: string;
    involvedObject: { kind: string; name: string };
  }>;
}

function parseMillicores(val?: string): number | null {
  if (!val) return null;
  if (val.endsWith("m")) return parseInt(val);
  return parseFloat(val) * 1000;
}

function parseMemoryMi(val?: string): number | null {
  if (!val) return null;
  if (val.endsWith("Mi")) return parseInt(val);
  if (val.endsWith("Gi")) return parseFloat(val) * 1024;
  if (val.endsWith("Ki")) return parseInt(val) / 1024;
  return parseInt(val) / (1024 * 1024);
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function UsageBar({
  label,
  used,
  request,
  limit,
  unit,
  color,
}: {
  label: string;
  used: number;
  request: number | null;
  limit: number | null;
  unit: string;
  color: string;
}) {
  const max = limit ?? request ?? used * 1.5;
  const usedPct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const reqPct = request && max > 0 ? Math.min((request / max) * 100, 100) : null;
  const isOverLimit = limit ? used > limit : false;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="tabular-nums text-[var(--text-muted)]">
          {Math.round(used)}{unit}
          {limit ? ` / ${Math.round(limit)}${unit}` : ""}
          {` (${Math.round(usedPct)}%)`}
        </span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${isOverLimit ? "bg-red-500" : color}`}
          style={{ width: `${usedPct}%` }}
        />
        {reqPct != null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-400"
            style={{ left: `${reqPct}%` }}
            title={`Request: ${Math.round(request!)}${unit}`}
          />
        )}
      </div>
      <div className="flex gap-4 text-[10px] text-[var(--text-muted)]">
        <span>Uso: {Math.round(used)}{unit}</span>
        {request != null && <span className="flex items-center gap-1"><span className="inline-block h-2 w-0.5 bg-amber-400 rounded" />Req: {Math.round(request)}{unit}</span>}
        {limit != null && <span>Lim: {Math.round(limit)}{unit}</span>}
      </div>
    </div>
  );
}

function ResourceNode({
  icon,
  label,
  items,
  color,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  items?: string[];
  color: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 min-w-[140px] ${onClick ? "cursor-pointer hover:border-slate-600 hover:bg-slate-800/30" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={color}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        {count != null && (
          <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">
            {count}
          </span>
        )}
      </div>
      {items && items.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <span key={item} className="text-xs text-[var(--text-secondary)] font-mono truncate" title={item}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center px-1 text-[var(--text-muted)]">
      <div className="h-px w-4 bg-slate-700" />
      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
    </div>
  );
}

export function ApplicationOverviewTab({ detail, onTabChange }: ApplicationOverviewTabProps) {
  const { deployment, containers, services, ingress, configmaps, secrets, namespace, name } = detail;

  const { data: metrics } = useApi<MetricsResponse>(`/metrics/${namespace}/${name}`);
  const { data: events } = useApi<EventsResponse>(`/events/${namespace}/${name}`);
  const { data: pods } = useApi<PodListItem[]>(`/pods/${namespace}/${name}`);

  const ingressHosts = ingress.flatMap((i) => i.hosts);
  const ingressNames = ingress.map((i) => i.name ?? "—");
  const podNames = (pods ?? []).map((p) => p.name);

  const cpuUsedM = metrics ? nanoCoresToMillicores(metrics.totals.cpuNanoCores) : 0;
  const cpuReqM = parseMillicores(metrics?.resourceSpec?.requests?.cpu);
  const cpuLimM = parseMillicores(metrics?.resourceSpec?.limits?.cpu);
  const memUsedMi = metrics ? metrics.totals.memoryBytes / (1024 * 1024) : 0;
  const memReqMi = parseMemoryMi(metrics?.resourceSpec?.requests?.memory);
  const memLimMi = parseMemoryMi(metrics?.resourceSpec?.limits?.memory);

  return (
    <div className="space-y-6">
      {/* Resource Map */}
      <Card title="Resource Map" icon={<Network className="h-4 w-4" />}>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max py-2">
            {ingressNames.length > 0 && (
              <>
                <div className="flex flex-col gap-1.5">
                  <ResourceNode
                    icon={<Globe className="h-4 w-4" />}
                    label="Ingress"
                    items={ingressNames}
                    color="text-emerald-400"
                    count={ingressNames.length}
                    onClick={() => onTabChange?.("network")}
                  />
                  {ingressHosts.length > 0 && (
                    <div className="pl-3">
                      {ingressHosts.map((h) => (
                        <span key={h} className="block text-[10px] text-emerald-400/70 font-mono">{h}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Connector />
              </>
            )}

            {services.length > 0 && (
              <>
                <ResourceNode
                  icon={<Network className="h-4 w-4" />}
                  label="Services"
                  items={services}
                  color="text-amber-400"
                  count={services.length}
                  onClick={() => onTabChange?.("network")}
                />
                <Connector />
              </>
            )}

            <div
              onClick={() => onTabChange?.("metrics")}
              className="rounded-[var(--radius-lg)] border-2 border-blue-500/30 bg-blue-500/5 p-4 min-w-[160px] cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/10"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Repeat className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Deployment</span>
              </div>
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {deployment.availableReplicas}/{deployment.replicas}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">{deployment.strategy}</p>
              <div className="mt-2">
                <Badge variant={deployment.availableReplicas >= deployment.replicas ? "success" : "degraded"} dot>
                  {deployment.availableReplicas >= deployment.replicas ? "Healthy" : "Degraded"}
                </Badge>
              </div>
            </div>

            <Connector />

            <ResourceNode
              icon={<Container className="h-4 w-4" />}
              label="Pods"
              items={podNames.length <= 5 ? podNames : podNames.slice(0, 3).concat([`+${podNames.length - 3} mais`])}
              color="text-cyan-400"
              count={pods?.length ?? 0}
              onClick={() => onTabChange?.("pods")}
            />

            {(configmaps.length > 0 || secrets.length > 0) && (
              <>
                <div className="flex items-center px-2 text-[var(--text-muted)]">
                  <div className="h-px w-6 bg-slate-700" />
                </div>
                <div className="flex flex-col gap-3">
                  {configmaps.length > 0 && (
                    <ResourceNode
                      icon={<FileText className="h-4 w-4" />}
                      label="ConfigMaps"
                      items={configmaps}
                      color="text-slate-400"
                      count={configmaps.length}
                      onClick={() => onTabChange?.("configmaps")}
                    />
                  )}
                  {secrets.length > 0 && (
                    <ResourceNode
                      icon={<KeyRound className="h-4 w-4" />}
                      label="Secrets"
                      items={secrets.length <= 4 ? secrets : secrets.slice(0, 3).concat([`+${secrets.length - 3} mais`])}
                      color="text-rose-400"
                      count={secrets.length}
                      onClick={() => onTabChange?.("secrets")}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Resource Usage */}
      <Card title="Consumo de Recursos" icon={<Cpu className="h-4 w-4" />}>
        {metrics ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <UsageBar
              label="CPU"
              used={cpuUsedM}
              request={cpuReqM}
              limit={cpuLimM}
              unit="m"
              color="bg-amber-500"
            />
            <UsageBar
              label="Memory"
              used={memUsedMi}
              request={memReqMi}
              limit={memLimMi}
              unit="Mi"
              color="bg-blue-500"
            />
          </div>
        ) : (
          <Skeleton className="h-20 rounded-[var(--radius-md)]" />
        )}
      </Card>

      {/* Deployment Events */}
      <Card title="Eventos" icon={<Clock className="h-4 w-4" />}>
        {events ? (
          events.events.length === 0 ? (
            <EmptyState title="Nenhum evento recente" description="Nenhum evento encontrado para este deployment." />
          ) : (
            <div className="overflow-x-auto -mx-5 -mb-5">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tipo</th>
                    <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Razão</th>
                    <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Objeto</th>
                    <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Mensagem</th>
                    <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Age</th>
                    <th className="bg-slate-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">#</th>
                  </tr>
                </thead>
                <tbody>
                  {events.events.slice(0, 30).map((ev, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-slate-800/30 ${
                        idx % 2 === 1 ? "bg-[var(--bg-muted)]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {ev.type === "Warning" ? (
                          <Badge variant="warning" dot>{ev.type}</Badge>
                        ) : (
                          <Badge variant="success" dot>{ev.type}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-primary)]">{ev.reason}</td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">
                        <span className="font-mono">{ev.involvedObject.kind}/{ev.involvedObject.name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] max-w-sm truncate" title={ev.message}>
                        {ev.message}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">
                        {timeAgo(ev.lastTimestamp ?? ev.firstTimestamp)}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">{ev.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <Skeleton className="h-32 rounded-[var(--radius-md)]" />
        )}
      </Card>

      {/* Containers */}
      <Card title="Containers" icon={<Box className="h-4 w-4" />}>
        <div className="space-y-4">
          {containers.map((c) => (
            <div key={c.name} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{c.image}</p>
              {c.ports && c.ports.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.ports.map((p, i) => (
                    <Badge key={i} variant="default">{p.containerPort ?? p.name}</Badge>
                  ))}
                </div>
              )}
              {c.resources && (Object.keys(c.resources.requests || {}).length > 0 || Object.keys(c.resources.limits || {}).length > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-[var(--radius-sm)] bg-slate-800/50 px-3 py-2">
                    <span className="font-medium text-[var(--text-muted)]">Requests</span>
                    <p className="mt-0.5 text-[var(--text-secondary)]">
                      CPU: {c.resources.requests?.["cpu"] ?? "-"} &middot; Mem: {c.resources.requests?.["memory"] ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-sm)] bg-slate-800/50 px-3 py-2">
                    <span className="font-medium text-[var(--text-muted)]">Limits</span>
                    <p className="mt-0.5 text-[var(--text-secondary)]">
                      CPU: {c.resources.limits?.["cpu"] ?? "-"} &middot; Mem: {c.resources.limits?.["memory"] ?? "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
