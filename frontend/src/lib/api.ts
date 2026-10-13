/**
 * fetch 封装：统一 credentials、错误解析、401 跳登录。
 * 所有请求走相对路径 /api/v1/...，由 next.config.ts 代理到后端。
 */
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public allowed?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login" || window.location.pathname === "/register") return;
  window.location.href = "/login";
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // 非 JSON 响应
  }
  const err = body?.error;
  return new ApiError(
    res.status,
    err?.code ?? `HTTP_${res.status}`,
    err?.message ?? `请求失败（${res.status}）`,
    err?.allowed,
  );
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    redirectToLogin();
    throw await parseError(res);
  }
  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });
