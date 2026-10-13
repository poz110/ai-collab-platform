import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BudgetExceededError,
  DailyBudgetGuard,
  InMemoryAuditSink,
  InMemoryCostSink,
  LLMGateway,
  MockProvider,
  ProviderError,
  SchemaValidationError,
  zodToJsonSchema,
  type Provider,
  type ChatRequest,
  type ChatResponse,
} from '../src/index.js';

const ROUTED_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-8', 'gpt-4o-mini'] as const;

function makeGateway(extra: {
  providers?: Provider[];
  costSink?: InMemoryCostSink;
  auditSink?: InMemoryAuditSink;
  budgetGuard?: DailyBudgetGuard;
} = {}) {
  const costSink = extra.costSink ?? new InMemoryCostSink();
  const auditSink = extra.auditSink ?? new InMemoryAuditSink();
  const gateway = new LLMGateway({
    providers: extra.providers ?? [new MockProvider({ models: ROUTED_MODELS })],
    costSink,
    auditSink,
    ...(extra.budgetGuard ? { budgetGuard: extra.budgetGuard } : {}),
  });
  return { gateway, costSink, auditSink };
}

const schema = z.object({ answer: z.string() });

function jsonMessage(payload: unknown) {
  return [{ role: 'user' as const, content: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`` }];
}

describe('LLMGateway', () => {
  it('returns schema-validated data', async () => {
    const { gateway } = makeGateway();
    const res = await gateway.chat({
      kind: 'task_create',
      messages: jsonMessage({ answer: 'ok' }),
      schema,
    });
    expect(res.data).toEqual({ answer: 'ok' });
    expect(res.provider).toBe('mock');
  });

  it('routes by task kind to the configured model', async () => {
    const provider = new MockProvider({ models: ROUTED_MODELS });
    const { gateway } = makeGateway({ providers: [provider] });
    await gateway.chat({ kind: 'progress_insight', messages: jsonMessage({ answer: 'x' }), schema });
    expect(provider.calls[0]?.model).toBe('claude-sonnet-4-6');
    expect(provider.calls[0]?.temperature).toBe(0); // insight is temperature 0
  });

  it('records cost and audit entries per call', async () => {
    const { gateway, costSink, auditSink } = makeGateway();
    await gateway.chat({ kind: 'task_create', messages: jsonMessage({ answer: 'ok' }), schema });
    expect(costSink.records).toHaveLength(1);
    expect(costSink.records[0]?.kind).toBe('task_create');
    expect(costSink.records[0]?.model).toBe('claude-sonnet-4-6');
    expect(auditSink.entries).toHaveLength(1);
  });

  it('enforces the daily budget before calling the provider', async () => {
    const guard = new DailyBudgetGuard({
      limitCentsPerIssuePerDay: 0.0001,
      getSpentCentsToday: () => 0,
    });
    const provider = new MockProvider({ models: ROUTED_MODELS });
    const { gateway } = makeGateway({ providers: [provider], budgetGuard: guard });
    await expect(
      gateway.chat({ kind: 'task_create', messages: jsonMessage({ answer: 'x' }), schema }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(provider.calls).toHaveLength(0); // never spent
  });

  it('falls back to the secondary model on retryable provider errors', async () => {
    const failing: Provider = {
      name: 'anthropic',
      models: ['claude-sonnet-4-6'],
      chat: () => Promise.reject(new ProviderError('overloaded', 'anthropic', 529, true)),
    };
    const mock = new MockProvider({ models: ['gpt-4o-mini'] });
    const asOpenAI: Provider = {
      name: 'openai',
      models: mock.models,
      chat: (r) => mock.chat(r),
    };
    const { gateway } = makeGateway({ providers: [failing, asOpenAI] });
    const res = await gateway.chat({
      kind: 'task_create',
      messages: jsonMessage({ answer: 'via fallback' }),
      schema,
    });
    expect(res.data).toEqual({ answer: 'via fallback' });
    expect(res.model).toBe('gpt-4o-mini');
  });

  it('retries once with validation feedback, then throws SchemaValidationError', async () => {
    const provider = new MockProvider({ models: ROUTED_MODELS });
    const { gateway } = makeGateway({ providers: [provider] });
    // MockProvider echoes content — never matches { answer: string }.
    await expect(
      gateway.chat({ kind: 'task_create', messages: [{ role: 'user', content: 'no json here' }], schema }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
    // initial + one corrective retry
    expect(provider.calls).toHaveLength(2);
    const retryMsg = provider.calls[1]?.messages.at(-1)?.content ?? '';
    expect(retryMsg).toContain('failed schema validation');
  });
});

describe('zodToJsonSchema', () => {
  it('converts objects with required/optional fields', () => {
    const json = zodToJsonSchema(
      z.object({
        title: z.string().describe('The title'),
        count: z.number().int(),
        tags: z.array(z.string()).optional(),
        kind: z.enum(['a', 'b']),
      }),
    );
    expect(json).toMatchObject({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title' },
        count: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        kind: { type: 'string', enum: ['a', 'b'] },
      },
      additionalProperties: false,
    });
    expect((json.required as string[]).sort()).toEqual(['count', 'kind', 'title']);
  });
});
