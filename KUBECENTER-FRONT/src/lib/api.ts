import type { ApiError } from "./types";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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
    public body?: ApiError
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const res = await fetch(url.toString(), {
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
      body
    );
  }

  return res.json();
}

export const api = {
  get: apiGet,
};
