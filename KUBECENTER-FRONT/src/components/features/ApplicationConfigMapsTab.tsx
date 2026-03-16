"use client";

import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { FileText } from "lucide-react";
import type { ConfigMapsResponse } from "@/lib/types";

interface ApplicationConfigMapsTabProps {
  namespace: string;
  app: string;
}

export function ApplicationConfigMapsTab({ namespace, app }: ApplicationConfigMapsTabProps) {
  const { data, error, loading } = useApi<ConfigMapsResponse>(
    `/configmaps/${namespace}/${app}`,
  );

  if (loading) return <Skeleton className="h-64 rounded-[var(--radius-xl)]" />;
  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--error-subtle)] p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="Nenhum ConfigMap referenciado"
        description="Esta aplicação não referencia nenhum ConfigMap."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.configMaps.map((cm) => (
        <Card
          key={cm.name}
          title={cm.name}
          icon={<FileText className="h-4 w-4" />}
          actions={
            !cm.found ? <Badge variant="warning">Não encontrado</Badge> : undefined
          }
        >
          {cm.usage.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {cm.usage.map((u) => (
                <Badge key={u} variant="default">{u}</Badge>
              ))}
            </div>
          )}
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="bg-slate-800/50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Chave
                  </th>
                  <th className="bg-slate-800/50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cm.data || {}).map(([key, value]) => (
                  <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-mono text-sm text-[var(--text-primary)]">
                      {key}
                    </td>
                    <td
                      className="max-w-md truncate px-5 py-3 font-mono text-sm text-[var(--text-secondary)]"
                      title={value}
                    >
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
