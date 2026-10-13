import type { ChatRequest, ChatResponse } from '../../types.js';
import { postJson, ProviderError, type Provider } from './provider.js';

export interface OpenAICompatProviderOptions {
  apiKey: string;
  /** e.g. https://api.openai.com, https://api.deepseek.com — keeps国产模型 pluggable. */
  baseUrl?: string;
  providerName?: string;
  models?: readonly string[];
}

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { content: string | null };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/**
 * OpenAI-compatible chat-completions adapter. Covers OpenAI itself and
 * domestic providers exposing the same wire format (DeepSeek, 通义, …),
 * per tech-selection.md §2.5.
 */
export class OpenAICompatProvider implements Provider {
  readonly name: string;
  readonly models: readonly string[];
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: OpenAICompatProviderOptions) {
    if (!opts.apiKey) throw new Error('OpenAICompatProvider: apiKey required');
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com';
    this.name = opts.providerName ?? 'openai';
    this.models = opts.models ?? ['gpt-4o-mini'];
  }

  async chat(request: ChatRequest & { model: string }): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 4096,
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
    };

    if (request.schema) {
      const name = request.schemaName ?? 'structured_output';
      body.response_format = {
        type: 'json_schema',
        json_schema: { name, schema: request.schema, strict: true },
      };
    }

    const { json } = await postJson(
      `${this.baseUrl}/v1/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      body,
      { provider: this.name },
    );

    const res = json as OpenAIResponse;
    const content = res.choices[0]?.message.content ?? '';

    let data: unknown;
    if (request.schema) {
      try {
        data = JSON.parse(content);
      } catch {
        throw new ProviderError(
          'OpenAI response was not valid JSON for schema request',
          this.name,
        );
      }
    }

    return {
      data,
      text: content,
      model: res.model,
      provider: this.name,
      usage: {
        inputTokens: res.usage.prompt_tokens,
        outputTokens: res.usage.completion_tokens,
      },
      requestId: res.id,
    };
  }
}
