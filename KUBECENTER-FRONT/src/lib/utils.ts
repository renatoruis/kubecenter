/**
 * Formata millicores (ex: "320m") para exibição legível
 */
export function formatCpu(value: string | number): string {
  if (typeof value === "number") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} cores`;
    return `${value}m`;
  }
  return value;
}

/**
 * Formata bytes para MiB/GiB
 */
export function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
}

/**
 * Converte nanoCores para millicores
 */
export function nanoCoresToMillicores(nanoCores: number): number {
  return Math.round(nanoCores / 1_000_000);
}

/**
 * Formata data ISO para exibição
 */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

/**
 * Formata quantidade K8s (ex: "131813272Ki") para exibição
 */
export function formatK8sQuantity(q: string): string {
  if (!q) return "-";
  // Já vem em formato legível do K8s (Ki, Mi, Gi, etc)
  return q;
}
