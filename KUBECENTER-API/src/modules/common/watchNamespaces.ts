import { AppError } from "./errors";

export function getWatchNamespacesFromEnv(rawValue: string | undefined): Set<string> {
  if (!rawValue) {
    return new Set();
  }

  return new Set(
    rawValue
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function assertNamespaceIsWatched(namespace: string, watchNamespacesEnv: string | undefined): void {
  const watched = getWatchNamespacesFromEnv(watchNamespacesEnv);
  if (watched.size === 0 || !watched.has(namespace)) {
    throw new AppError(403, "FORBIDDEN_NAMESPACE", `Namespace "${namespace}" is not allowed`);
  }
}
