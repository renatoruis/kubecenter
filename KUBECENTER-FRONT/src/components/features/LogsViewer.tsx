"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApi } from "@/hooks/useApi";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCw, Terminal, Play, Pause, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PodListItem, LogsResponse, DeploymentLogsResponse } from "@/lib/types";

type ViewMode = "deployment" | "pod";

interface LogsViewerProps {
  namespace: string;
  app: string;
}

export function LogsViewer({ namespace, app }: LogsViewerProps) {
  const { data: pods } = useApi<PodListItem[]>(`/pods/${namespace}/${app}`);
  const [viewMode, setViewMode] = useState<ViewMode>("deployment");
  const [selectedPod, setSelectedPod] = useState("");
  const [selectedContainer, setSelectedContainer] = useState("");
  const [tailLines, setTailLines] = useState(200);
  const [logs, setLogs] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTail, setLiveTail] = useState(true);
  const [filter, setFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDeploymentLogs = useCallback(async () => {
    try {
      const res = await apiGet<DeploymentLogsResponse>(`/logs/${namespace}/${app}`, {
        tailLines,
        timestamps: false,
      });
      const combined = res.entries
        .map((e) => `[${e.pod}/${e.container}]\n${e.content}`)
        .join("\n\n---\n\n");
      setLogs(combined);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs");
    }
  }, [namespace, app, tailLines]);

  const fetchPodLogs = useCallback(async () => {
    if (!selectedPod || !selectedContainer) return;
    try {
      const res = await apiGet<LogsResponse>(
        `/logs/${namespace}/${selectedPod}/${selectedContainer}`,
        { tailLines, timestamps: false },
      );
      setLogs(res.content);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs");
    }
  }, [namespace, selectedPod, selectedContainer, tailLines]);

  const fetchLogs = useCallback(async () => {
    if (viewMode === "deployment") {
      await fetchDeploymentLogs();
    } else {
      await fetchPodLogs();
    }
  }, [viewMode, fetchDeploymentLogs, fetchPodLogs]);

  const handleManualRefresh = useCallback(async () => {
    setLoading(true);
    await fetchLogs();
    setLoading(false);
  }, [fetchLogs]);

  useEffect(() => {
    if (viewMode === "deployment") {
      setLoading(true);
      fetchDeploymentLogs().finally(() => setLoading(false));
    } else if (selectedPod && selectedContainer) {
      setLoading(true);
      fetchPodLogs().finally(() => setLoading(false));
    } else {
      setLogs(null);
    }
  }, [viewMode, selectedPod, selectedContainer, fetchDeploymentLogs, fetchPodLogs]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!liveTail) return;

    const canPoll =
      viewMode === "deployment" || (viewMode === "pod" && selectedPod && selectedContainer);

    if (canPoll) {
      intervalRef.current = setInterval(() => {
        void fetchLogs();
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [liveTail, viewMode, selectedPod, selectedContainer, fetchLogs]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  const podOptions = (pods || []).map((p) => ({ value: p.name, label: p.name }));
  const containerOptions = selectedPod
    ? (pods || [])
        .find((p) => p.name === selectedPod)
        ?.resources?.map((r) => ({ value: r.container, label: r.container })) || []
    : [];

  useEffect(() => {
    if (pods && pods.length > 0 && !selectedPod) {
      setSelectedPod(pods[0].name);
    }
  }, [pods, selectedPod]);

  useEffect(() => {
    if (containerOptions.length > 0 && !selectedContainer) {
      setSelectedContainer(containerOptions[0].value);
    }
  }, [containerOptions, selectedContainer]);

  const displayLogs = (() => {
    if (!logs) return null;
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs
      .split("\n")
      .filter((line) => line.toLowerCase().includes(q))
      .join("\n");
  })();

  if (!pods) return <Skeleton className="h-64 rounded-[var(--radius-xl)]" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Modo"
          options={[
            { value: "deployment", label: "Deployment completo" },
            { value: "pod", label: "Pod / Container" },
          ]}
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
        />

        {viewMode === "pod" && (
          <>
            <Select
              label="Pod"
              options={podOptions}
              value={selectedPod}
              onChange={(v) => {
                setSelectedPod(v);
                setSelectedContainer("");
              }}
              placeholder="Selecionar pod"
            />
            <Select
              label="Container"
              options={containerOptions}
              value={selectedContainer}
              onChange={setSelectedContainer}
              placeholder="Selecionar container"
            />
          </>
        )}

        <Select
          label="Linhas"
          options={[
            { value: "100", label: "100" },
            { value: "200", label: "200" },
            { value: "500", label: "500" },
            { value: "1000", label: "1000" },
          ]}
          value={String(tailLines)}
          onChange={(v) => setTailLines(Number(v))}
        />

        <div className="flex items-end gap-2">
          <Button
            variant={liveTail ? "primary" : "secondary"}
            size="sm"
            icon={liveTail ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            onClick={() => setLiveTail((v) => !v)}
          >
            {liveTail ? "Pausar" : "Retomar"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={handleManualRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--error-subtle)] p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-slate-800">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-slate-400">
              {viewMode === "deployment"
                ? `Logs — ${app}`
                : selectedPod
                  ? `${selectedPod} / ${selectedContainer}`
                  : "Selecione pod e container"}
            </span>
            {liveTail && (
              <span className="flex items-center gap-1.5 ml-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                  Live
                </span>
              </span>
            )}
          </div>
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar logs..."
              className="w-full rounded-md bg-slate-800/50 border border-slate-700 py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-slate-500 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--ring)] focus:outline-none"
            />
          </div>
        </div>
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="max-h-[600px] overflow-y-auto bg-[#0c0e14] p-4 font-mono text-xs leading-relaxed text-slate-300"
        >
          <pre className="whitespace-pre-wrap break-words">
            {displayLogs ??
              (viewMode === "deployment"
                ? "Carregando logs do deployment..."
                : selectedPod && selectedContainer
                  ? "Carregando..."
                  : "Selecione pod e container")}
          </pre>
          {displayLogs !== null && filter && displayLogs.length === 0 && (
            <p className="text-slate-500 italic mt-2">Nenhuma linha corresponde ao filtro.</p>
          )}
        </div>
      </div>
    </div>
  );
}
