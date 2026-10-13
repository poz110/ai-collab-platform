import type { ChatRequest, ChatResponse } from '../../types.js';

/**
 * A chat-model provider. Implementations must be dependency-light
 * (fetch-based) so the package runs on both Node ≥ 20 and Bun.
 */
export interface Provider {
  readonly name: string;
  /** Models this provider can serve, e.g. ["claude-sonnet-4-6"]. */
  readonly models: readonly string[];
  chat(request: ChatRequest & { model: string }): Promise<ChatResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Thin fetch wrapper with timeout + retry on transient failures. */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: { timeoutMs?: number; retries?: number; provider: string },
): Promise<{ status: number; json: unknown }> {
  const { timeoutMs = 60_000, retries = 2, provider } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (res.ok) return { status: res.status, json };
      const retryable = res.status === 429 || res.status >= 500;
      const message =
        (json as { error?: { message?: string } })?.error?.message ??
        `HTTP ${res.status}`;
      if (!retryable || attempt === retries) {
        throw new ProviderError(message, provider, res.status, retryable);
      }
      lastError = new ProviderError(message, provider, res.status, retryable);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      lastError = err;
      if (attempt === retries) {
        throw new ProviderError(
          err instanceof Error ? err.message : String(err),
          provider,
          undefined,
          true,
        );
      }
    } finally {
      clearTimeout(timer);
    }
    // Exponential backoff: 500ms, 1s, 2s…
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastError;
}
