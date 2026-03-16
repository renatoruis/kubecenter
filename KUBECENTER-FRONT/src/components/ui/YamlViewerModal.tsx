"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Copy, Check } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

interface YamlViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  kind: string;
  namespace: string;
  name: string;
}

function highlightYaml(raw: string): React.ReactNode[] {
  return raw.split("\n").map((line, i) => {
    const commentMatch = line.match(/^(\s*)(#.*)$/);
    if (commentMatch) {
      return (
        <span key={i}>
          {commentMatch[1]}
          <span className="text-slate-500">{commentMatch[2]}</span>
          {"\n"}
        </span>
      );
    }

    const kvMatch = line.match(/^(\s*)([\w.\-/]+)(:)(.*)/);
    if (kvMatch) {
      const [, indent, key, colon, rest] = kvMatch;
      return (
        <span key={i}>
          {indent}
          <span className="text-cyan-400">{key}</span>
          <span className="text-slate-500">{colon}</span>
          <span className="text-amber-200">{rest}</span>
          {"\n"}
        </span>
      );
    }

    const listMatch = line.match(/^(\s*)(- )(.*)/);
    if (listMatch) {
      const [, indent, dash, rest] = listMatch;
      const innerKv = rest.match(/^([\w.\-/]+)(:)(.*)/);
      if (innerKv) {
        return (
          <span key={i}>
            {indent}
            <span className="text-slate-500">{dash}</span>
            <span className="text-cyan-400">{innerKv[1]}</span>
            <span className="text-slate-500">{innerKv[2]}</span>
            <span className="text-amber-200">{innerKv[3]}</span>
            {"\n"}
          </span>
        );
      }
      return (
        <span key={i}>
          {indent}
          <span className="text-slate-500">{dash}</span>
          <span className="text-amber-200">{rest}</span>
          {"\n"}
        </span>
      );
    }

    return (
      <span key={i}>
        <span className="text-slate-300">{line}</span>
        {"\n"}
      </span>
    );
  });
}

export function YamlViewerModal({ isOpen, onClose, kind, namespace, name }: YamlViewerModalProps) {
  const [yaml, setYaml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const fetchYaml = useCallback(async () => {
    setLoading(true);
    setError(null);
    setYaml(null);
    try {
      const res = await apiGet<{ yaml: string }>(
        `/resources/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/yaml`,
      );
      setYaml(res.yaml);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar YAML");
    } finally {
      setLoading(false);
    }
  }, [kind, namespace, name]);

  useEffect(() => {
    if (isOpen) {
      void fetchYaml();
    } else {
      setYaml(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, fetchYaml]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    if (!yaml) return;
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            <span className="text-cyan-400">{kind}</span>
            <span className="text-slate-500">/</span>
            <span>{name}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!yaml}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-[var(--radius-md)] p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {yaml && (
            <pre className="font-mono text-xs leading-relaxed whitespace-pre overflow-x-auto">
              {highlightYaml(yaml)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
