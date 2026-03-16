"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { SecretsResponse } from "@/lib/types";

interface ApplicationSecretsTabProps {
  namespace: string;
  app: string;
}

export function ApplicationSecretsTab({ namespace, app }: ApplicationSecretsTabProps) {
  const { data, error, loading } = useApi<SecretsResponse>(
    `/secrets/${namespace}/${app}`,
  );
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const handleReveal = async (secretName: string, key: string) => {
    const cacheKey = `${secretName}:${key}`;
    if (revealed[cacheKey] !== undefined) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      return;
    }
    try {
      const res = await apiGet<{ key: string; value: string }>(
        `/secrets/${namespace}/${secretName}/values/${key}`,
      );
      setRevealed((prev) => ({ ...prev, [cacheKey]: res.value }));
    } catch {
      // ignore
    }
  };

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
        icon={<KeyRound className="h-6 w-6" />}
        title="Nenhum Secret referenciado"
        description="Esta aplicação não referencia nenhum Secret."
      />
    );
  }

  const entries = (secret: { entries?: Array<{ key: string; value: string }>; keys: string[] }) =>
    secret.entries ?? secret.keys.map((key) => ({ key, value: "***" }));

  return (
    <div className="space-y-6">
      {data.secrets.map((secret) => (
        <Card
          key={secret.name}
          title={secret.name}
          icon={<KeyRound className="h-4 w-4" />}
          actions={
            <>
              {!secret.found && <Badge variant="warning">Não encontrado</Badge>}
              {secret.type && (
                <Badge variant="default">{secret.type}</Badge>
              )}
            </>
          }
        >
          {secret.usage.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {secret.usage.map((u) => (
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
                  <th className="bg-slate-800/50 px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries(secret).map(({ key, value }) => {
                  const cacheKey = `${secret.name}:${key}`;
                  const isRevealed = revealed[cacheKey] !== undefined;
                  const displayValue = isRevealed ? revealed[cacheKey] : value;
                  return (
                    <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-slate-800/30">
                      <td className="px-5 py-3 font-mono text-sm text-[var(--text-primary)]">
                        {key}
                      </td>
                      <td
                        className="max-w-md truncate px-5 py-3 font-mono text-sm text-[var(--text-secondary)]"
                        title={displayValue}
                      >
                        {displayValue}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          onClick={() => handleReveal(secret.name, key)}
                        >
                          {isRevealed ? "Ocultar" : "Mostrar"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
