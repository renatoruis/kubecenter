import type { ApiError } from "./types";

const API_PREFIX = process.env.NEXT_PUBLIC_API_URL || "/api";

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const prefix = API_PREFIX.replace(/\/$/, "");
  const clean = path.replace(/^\/+/, "");
  let url = clean ? `${prefix}/${clean}` : prefix;

  if (params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    });
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

const getToken = () => process.env.NEXT_PUBLIC_API_TOKEN;

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: ApiError,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = buildUrl(path, params);

  const res = await fetch(url, {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiClientError(
      body?.message || res.statusText,
      res.status,
      body,
    );
  }

  return res.json();
}

export const api = {
  get: apiGet,
};
