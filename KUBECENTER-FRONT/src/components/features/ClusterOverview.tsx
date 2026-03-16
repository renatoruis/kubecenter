"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { timeAgo } from "@/lib/timeAgo";
import { Boxes, Container, Activity, Network, Server } from "lucide-react";
import type { ClusterOverview as ClusterOverviewType } from "@/lib/types";

function HealthScoreRing({ score }: { score: number }) {
  const radius = 54;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? "var(--success)"
      : score >= 60
        ? "var(--warning)"
        : "var(--error)";

  const label =
    score >= 80 ? "Saudável" : score >= 60 ? "Atenção" : "Crítico";

  return (
    <div className="flex items-center gap-6 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-5">
      <div className="relative h-[132px] w-[132px] shrink-0">
        <svg
          viewBox="0 0 132 132"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke="var(--bg-muted)"
            strokeWidth={stroke}
          />
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color }}
          >
            {score}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            / 100
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Health Score
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Índice geral de saúde do cluster calculado a partir de pods, nós e deployments.
        </p>
        <Badge
          variant={score >= 80 ? "success" : score >= 60 ? "warning" : "error"}
          dot
          className="mt-2"
        >
          {label}
        </Badge>
      </div>
    </div>
  );
}

export function ClusterOverview() {
  const { data, error, loading, lastUpdated } =
    useApi<ClusterOverviewType>("/", undefined, { refreshInterval: 30000 });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const healthScore = useMemo(() => {
    if (!data) return 0;
    const { totals, namespaces, nodes } = data;

    const podScore = totals.pods > 0 ? (totals.runningPods / totals.pods) * 100 : 100;

    const nodeScore = nodes.total > 0 ? (nodes.ready / nodes.total) * 100 : 100;

    let totalDeploys = 0;
    let healthyDeploys = 0;
    for (const ns of namespaces) {
      totalDeploys += ns.deployments;
      if (ns.pods > 0 && ns.runningPods === ns.pods) {
        healthyDeploys += ns.deployments;
      } else if (ns.pods > 0) {
        healthyDeploys += ns.deployments * (ns.runningPods / ns.pods);
      } else {
        healthyDeploys += ns.deployments;
      }
    }
    const deployScore = totalDeploys > 0 ? (healthyDeploys / totalDeploys) * 100 : 100;

    const baseScore = 100;

    return Math.round(
      podScore * 0.4 + nodeScore * 0.2 + deployScore * 0.2 + baseScore * 0.2,
    );
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-[var(--radius-xl)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius-xl)]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
          <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
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

  if (!data) return null;

  const { totals, namespaces, nodes, collectedAt } = data;
  const runningPct = totals.pods > 0 ? Math.round((totals.runningPods / totals.pods) * 100) : 0;

  return (
    <div className="space-y-6">
      <HealthScoreRing score={healthScore} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Deployments"
          value={totals.deployments}
          icon={<Boxes className="h-5 w-5" />}
          color="blue"
          subtitle={
            <Link href="/applications" className="font-medium text-[var(--accent)] hover:underline">
              Ver aplicações &rarr;
            </Link>
          }
        />
        <StatCard
          label="Pods"
          value={totals.pods}
          icon={<Container className="h-5 w-5" />}
          color="slate"
        />
        <StatCard
          label="Running"
          value={totals.runningPods}
          icon={<Activity className="h-5 w-5" />}
          color="green"
          subtitle={
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 rounded-full bg-[var(--bg-muted)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--success)]"
                  style={{ width: `${runningPct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">{runningPct}%</span>
            </div>
          }
        />
        <StatCard
          label="Services"
          value={totals.services}
          icon={<Network className="h-5 w-5" />}
          color="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Namespaces" icon={<Boxes className="h-4 w-4" />}>
          <div className="space-y-3 -mx-5 -mb-5 px-5 pb-5">
            {namespaces.map((ns) => {
              const pct = ns.pods > 0 ? Math.round((ns.runningPods / ns.pods) * 100) : 0;
              const barColor = pct === 100 ? "bg-[var(--success)]" : pct >= 50 ? "bg-[var(--warning)]" : "bg-[var(--error)]";
              return (
                <Link
                  key={ns.name}
                  href={`/applications?q=${encodeURIComponent(ns.name)}`}
                  className="group flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3 hover:bg-slate-800/30 hover:border-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                        {ns.name}
                      </span>
                      <div className="flex items-center gap-3 text-xs tabular-nums text-[var(--text-muted)]">
                        <span>{ns.deployments} deploys</span>
                        <span>{ns.runningPods}/{ns.pods} pods</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-[var(--bg-muted)]">
                        <div
                          className={`h-2 rounded-full ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums font-medium text-[var(--text-secondary)] w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card title="Nós" icon={<Server className="h-4 w-4" />}>
          <div className="mb-4 flex items-center gap-4 text-sm">
            <span className="text-[var(--text-muted)]">Total:</span>
            <span className="font-semibold text-[var(--text-primary)]">{nodes.total}</span>
            <Badge variant="success" dot>{nodes.ready} Ready</Badge>
            {nodes.notReady > 0 && (
              <Badge variant="error" dot>{nodes.notReady} Not Ready</Badge>
            )}
          </div>
          <div className="space-y-2">
            {nodes.items.map((node) => (
              <div
                key={node.name}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-3 hover:bg-slate-800/30"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{node.name}</span>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{node.os}/{node.arch}</span>
                    <span>&middot;</span>
                    <span>{node.kubeletVersion}</span>
                  </div>
                </div>
                <Badge variant={node.status === "Ready" ? "success" : "error"} dot>
                  {node.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span title={collectedAt}>
          Coletado {timeAgo(collectedAt)}
        </span>
        {lastUpdated && (
          <>
            <span>&middot;</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
              Atualizado {timeAgo(lastUpdated)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
