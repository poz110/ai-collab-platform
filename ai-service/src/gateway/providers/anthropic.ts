import type { ChatRequest, ChatResponse, JsonSchema } from '../../types.js';
import { postJson, ProviderError, type Provider } from './provider.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  baseUrl?: string;
  models?: readonly string[];
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; name: string; input: unknown }
  >;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Anthropic Messages API adapter.
 *
 * Structured output uses forced tool-use (`tool_choice: {type: 'tool'}`),
 * the most reliable way to get schema-conforming JSON from Claude
 * (architecture.md §5.2).
 */
export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';
  readonly models: readonly string[];
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: AnthropicProviderOptions) {
    if (!opts.apiKey) throw new Error('AnthropicProvider: apiKey required');
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    this.models = opts.models ?? ['claude-sonnet-4-6', 'claude-opus-4-8'];
  }

  async chat(request: ChatRequest & { model: string }): Promise<ChatResponse> {
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      ...(system ? { system } : {}),
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
    };

    if (request.schema) {
      const name = request.schemaName ?? 'structured_output';
      body.tools = [
        {
          name,
          description: 'Return the structured result.',
          input_schema: request.schema as JsonSchema,
        },
      ];
      body.tool_choice = { type: 'tool', name };
    }

    const { json } = await postJson(
      `${this.baseUrl}/v1/messages`,
      {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
      { provider: this.name },
    );

    const res = json as AnthropicResponse;
    const toolUse = res.content.find((c) => c.type === 'tool_use');
    const text = res.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('');

    if (request.schema && !toolUse) {
      throw new ProviderError(
        'Anthropic response missing tool_use block for schema request',
        this.name,
      );
    }

    return {
      data: toolUse && 'input' in toolUse ? toolUse.input : undefined,
      text,
      model: res.model,
      provider: this.name,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
      requestId: res.id,
    };
  }
}
