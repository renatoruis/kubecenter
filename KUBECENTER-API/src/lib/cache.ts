import NodeCache from "node-cache";

const DEFAULT_TTL_SECONDS = 30;

export const cache = new NodeCache({
  stdTTL: DEFAULT_TTL_SECONDS,
  checkperiod: DEFAULT_TTL_SECONDS * 2
});

export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = await fetcher();
  cache.set<T>(key, value, ttlSeconds);
  return value;
}
