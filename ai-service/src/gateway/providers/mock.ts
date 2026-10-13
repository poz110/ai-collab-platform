import type { ChatRequest, ChatResponse } from '../../types.js';
import type { Provider } from './provider.js';

export interface MockProviderOptions {
  models?: readonly string[];
  /** Rough tokens-per-character ratio used for fake usage accounting. */
  charsPerToken?: number;
}

/**
 * Deterministic provider for tests and offline development.
 *
 * Behaviour:
 * - If the last user message contains a fenced ```json block, that JSON is
 *   returned as `data` (lets tests drive any scenario).
 * - Otherwise `data` is `{ echo: <last user message> }`.
 * - Usage is estimated from message length so cost accounting is exercised.
 */
export class MockProvider implements Provider {
  readonly name = 'mock';
  readonly models: readonly string[];
  readonly calls: Array<ChatRequest & { model: string }> = [];
  private readonly charsPerToken: number;

  constructor(opts: MockProviderOptions = {}) {
    this.models = opts.models ?? ['mock-small', 'mock-large'];
    this.charsPerToken = opts.charsPerToken ?? 4;
  }

  chat(request: ChatRequest & { model: string }): Promise<ChatResponse> {
    this.calls.push(request);
    const lastUser = [...request.messages].reverse().find((m) => m.role !== 'system');
    const content = lastUser?.content ?? '';

    let data: unknown = { echo: content };
    const match = content.match(/```json\s*([\s\S]*?)```/);
    if (match?.[1]) data = JSON.parse(match[1]);

    const inputChars = request.messages.reduce((n, m) => n + m.content.length, 0);
    const outputChars = JSON.stringify(data).length;

    return Promise.resolve({
      data,
      text: typeof data === 'string' ? data : JSON.stringify(data),
      model: request.model,
      provider: this.name,
      usage: {
        inputTokens: Math.ceil(inputChars / this.charsPerToken),
        outputTokens: Math.ceil(outputChars / this.charsPerToken),
      },
      requestId: `mock-${this.calls.length}`,
    });
  }
}
