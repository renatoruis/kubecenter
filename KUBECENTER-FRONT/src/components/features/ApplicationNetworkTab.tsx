"use client";

import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Globe, Network } from "lucide-react";
import type { NetworkResponse } from "@/lib/types";

interface ApplicationNetworkTabProps {
  namespace: string;
  app: string;
}

export function ApplicationNetworkTab({ namespace, app }: ApplicationNetworkTabProps) {
  const { data, error, loading } = useApi<NetworkResponse>(
    `/network/${namespace}/${app}`,
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
    <div className="space-y-6">
      <Card title="Services" icon={<Network className="h-4 w-4" />}>
        {data.services.length === 0 ? (
          <EmptyState
            icon={<Network className="h-6 w-6" />}
            title="Nenhum service vinculado"
          />
        ) : (
          <div className="space-y-3">
            {data.services.map((svc, idx) => (
              <div
                key={idx}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {svc.name || "—"}
                  </span>
                  {svc.type && <Badge variant="default">{svc.type}</Badge>}
                </div>
                {svc.clusterIP && (
                  <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                    Cluster IP: {svc.clusterIP}
                  </p>
                )}
                {svc.ports && svc.ports.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {svc.ports.map((p, i) => (
                      <Badge key={i} variant="default">
                        {p.port} &rarr; {String(p.targetPort)} ({p.protocol || "TCP"})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Ingress" icon={<Globe className="h-4 w-4" />}>
        {data.ingress.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-6 w-6" />}
            title="Nenhum ingress"
          />
        ) : (
          <div className="space-y-3">
            {data.ingress.map((ing, idx) => (
              <div
                key={idx}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {ing.name || "—"}
                  </span>
                  {ing.className && (
                    <Badge variant="default">{ing.className}</Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ing.hosts.map((h) => (
                    <Badge key={h} variant="success" dot>{h}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
