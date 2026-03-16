"use client";

import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMemory, nanoCoresToMillicores } from "@/lib/utils";
import { Cpu, MemoryStick, Container, Gauge, AlertTriangle } from "lucide-react";
import type { MetricsResponse } from "@/lib/types";

interface MetricsCardProps {
  namespace: string;
  app: string;
}

function formatResource(val?: string): string {
  return val ?? "-";
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

function getResourceColor(usage: number, limit: number | null | undefined): string {
  if (limit == null || limit <= 0) return "bg-emerald-500";
  const pct = (usage / limit) * 100;
  if (pct >= 95) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function getResourceColorText(usage: number, limit: number | null | undefined): string {
  if (limit == null || limit <= 0) return "text-emerald-400";
  const pct = (usage / limit) * 100;
  if (pct >= 95) return "text-red-400";
  if (pct >= 80) return "text-amber-400";
  return "text-emerald-400";
}

function isResourceWarning(usage: number, limit: number | null | undefined): boolean {
  if (limit == null || limit <= 0) return false;
  return (usage / limit) * 100 >= 80;
}

export function MetricsCard({ namespace, app }: MetricsCardProps) {
  const { data, error, loading } = useApi<MetricsResponse>(
    `/metrics/${namespace}/${app}`,
  );

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-[var(--radius-xl)]" />
        ))}
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

  if (!data) return null;

  if (!data.available) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-amber-500/20 bg-[var(--warning-subtle)] p-4 text-sm text-amber-400">
        API de métricas não disponível.
        {data.warnings?.map((w, i) => (
          <p key={i} className="mt-2 text-xs text-amber-500/70">{w}</p>
        ))}
      </div>
    );
  }

  const spec = data.resourceSpec;
  const cpuUsedM = nanoCoresToMillicores(data.totals.cpuNanoCores);
  const cpuReqM = parseMillicores(spec?.requests?.cpu);
  const cpuLimM = parseMillicores(spec?.limits?.cpu);
  const cpuMax = cpuLimM ?? cpuReqM ?? cpuUsedM * 1.5;
  const cpuPct = cpuMax > 0 ? Math.round((cpuUsedM / cpuMax) * 100) : 0;

  const memUsedMi = data.totals.memoryBytes / (1024 * 1024);
  const memReqMi = parseMemoryMi(spec?.requests?.memory);
  const memLimMi = parseMemoryMi(spec?.limits?.memory);
  const memMax = memLimMi ?? memReqMi ?? memUsedMi * 1.5;
  const memPct = memMax > 0 ? Math.round((memUsedMi / memMax) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CPU Usage"
          value={data.cpuUsage}
          icon={<Cpu className="h-5 w-5" />}
          color="amber"
          progress={cpuPct}
          subtitle={
            <span className="text-xs">
              {cpuReqM != null ? `Req: ${cpuReqM}m` : ""}
              {cpuReqM != null && cpuLimM != null ? " · " : ""}
              {cpuLimM != null ? `Lim: ${cpuLimM}m` : ""}
              {cpuReqM == null && cpuLimM == null ? "Sem limites definidos" : ""}
            </span>
          }
        />
        <StatCard
          label="Memory"
          value={data.memoryUsage}
          icon={<MemoryStick className="h-5 w-5" />}
          color="blue"
          progress={memPct}
          subtitle={
            <span className="text-xs">
              {memReqMi != null ? `Req: ${Math.round(memReqMi)}Mi` : ""}
              {memReqMi != null && memLimMi != null ? " · " : ""}
              {memLimMi != null ? `Lim: ${Math.round(memLimMi)}Mi` : ""}
              {memReqMi == null && memLimMi == null ? "Sem limites definidos" : ""}
            </span>
          }
        />
        <StatCard
          label="Pods"
          value={data.totals.podCount}
          icon={<Container className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="Source"
          value={data.source}
          icon={<Gauge className="h-5 w-5" />}
          color="slate"
        />
      </div>

      {data.pods && data.pods.length > 0 && (
        <Card title="Consumo por Pod" icon={<Container className="h-4 w-4" />}>
          <div className="space-y-4 -mx-5 -mb-5 px-5 pb-5">
            {data.pods.map((p) => {
              const podCpuM = nanoCoresToMillicores(p.cpuNanoCores);
              const podCpuLimM = parseMillicores(p.limits?.cpu) ?? parseMillicores(spec?.limits?.cpu);
              const podCpuReqM = parseMillicores(p.requests?.cpu) ?? parseMillicores(spec?.requests?.cpu);
              const podCpuMax = podCpuLimM ?? podCpuReqM ?? podCpuM * 1.5;
              const podCpuPct = podCpuMax > 0 ? Math.min(Math.round((podCpuM / podCpuMax) * 100), 100) : 0;

              const podMemMi = p.memoryBytes / (1024 * 1024);
              const podMemLimMi = parseMemoryMi(p.limits?.memory) ?? parseMemoryMi(spec?.limits?.memory);
              const podMemReqMi = parseMemoryMi(p.requests?.memory) ?? parseMemoryMi(spec?.requests?.memory);
              const podMemMax = podMemLimMi ?? podMemReqMi ?? podMemMi * 1.5;
              const podMemPct = podMemMax > 0 ? Math.min(Math.round((podMemMi / podMemMax) * 100), 100) : 0;
              const showWarning = isResourceWarning(podCpuM, podCpuLimM) || isResourceWarning(podMemMi, podMemLimMi);

              return (
                <div key={p.pod} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
                  <p className="font-mono text-xs text-[var(--text-primary)] mb-3 truncate flex items-center gap-1.5" title={p.pod}>
                    {p.pod}
                    {showWarning && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* CPU */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Cpu className="h-3 w-3" /> CPU
                        </span>
                        <span className={`font-semibold tabular-nums ${getResourceColorText(podCpuM, podCpuLimM)}`}>
                          {podCpuM}m {podCpuLimM ? `/ ${podCpuLimM}m` : ""} ({podCpuPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${getResourceColor(podCpuM, podCpuLimM)}`} style={{ width: `${podCpuPct}%` }} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-[var(--text-muted)]">
                        {podCpuReqM != null && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Req: {podCpuReqM}m
                          </span>
                        )}
                        {podCpuLimM != null && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                            Lim: {podCpuLimM}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Memory */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <MemoryStick className="h-3 w-3" /> Memory
                        </span>
                        <span className={`font-semibold tabular-nums ${getResourceColorText(podMemMi, podMemLimMi)}`}>
                          {formatMemory(p.memoryBytes)} {podMemLimMi ? `/ ${Math.round(podMemLimMi)}Mi` : ""} ({podMemPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${getResourceColor(podMemMi, podMemLimMi)}`} style={{ width: `${podMemPct}%` }} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-[var(--text-muted)]">
                        {podMemReqMi != null && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Req: {Math.round(podMemReqMi)}Mi
                          </span>
                        )}
                        {podMemLimMi != null && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                            Lim: {Math.round(podMemLimMi)}Mi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
