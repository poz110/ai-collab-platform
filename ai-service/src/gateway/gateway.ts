import type { z } from 'zod';
import type {
  AuditSink,
  BudgetGuard,
  ChatRequest,
  ChatResponse,
  CostSink,
} from '../types.js';
import { computeCostCents } from './cost.js';
import { ProviderError, type Provider } from './providers/provider.js';
import { resolveRoute, type RoutingTable, DEFAULT_ROUTING } from './router.js';

export interface LLMGatewayOptions {
  providers: Provider[];
  costSink?: CostSink;
  auditSink?: AuditSink;
  budgetGuard?: BudgetGuard;
  routing?: RoutingTable;
  /** Source context for cost rollup (architecture §5.3). */
  context?: { issueId?: string; runId?: string };
  /** Clock injection for tests. */
  now?: () => Date;
}

/**
 * LLM Gateway — the single entry point for every model call in the
 * platform (architecture.md §5.1). Responsibilities:
 *
 * 1. Route by task kind to a cost-appropriate model.
 * 2. Enforce structured output via a zod schema, retrying once on
 *    validation failure with the error fed back to the model.
 * 3. Record cost + audit entries for every call.
 * 4. Enforce daily budget before spending.
 * 5. Fall back to the secondary provider on retryable errors.
 */
export class LLMGateway {
  private readonly providers: Map<string, Provider>;
  private readonly byModel: Map<string, Provider>;

  constructor(private readonly opts: LLMGatewayOptions) {
    this.providers = new Map(opts.providers.map((p) => [p.name, p]));
    this.byModel = new Map();
    for (const provider of opts.providers) {
      for (const model of provider.models) {
        if (!this.byModel.has(model)) this.byModel.set(model, provider);
      }
    }
  }

  /**
   * Chat with schema-validated output. When `schema` (a zod schema) is
   * given, the returned data is guaranteed to parse — or the call throws
   * after one corrective retry.
   */
  async chat<S extends z.ZodTypeAny>(
    request: Omit<ChatRequest, 'schema'> & { schema?: S },
  ): Promise<ChatResponse<z.infer<S>>> {
    const routing = this.opts.routing ?? DEFAULT_ROUTING;
    const route = resolveRoute(request.kind, request.model, routing);
    const fullRequest: ChatRequest = {
      kind: request.kind,
      messages: request.messages,
      temperature: request.temperature ?? route.temperature,
      maxTokens: request.maxTokens ?? route.maxTokens,
      ...(request.model !== undefined ? { model: request.model } : {}),
      ...(request.schema
        ? {
            schema: zodToJsonSchema(request.schema),
            schemaName: request.schemaName ?? request.kind,
          }
        : {}),
    };

    await this.opts.budgetGuard?.assertWithinBudget({
      ...(this.opts.context?.issueId !== undefined
        ? { issueId: this.opts.context.issueId }
        : {}),
      estimatedCostCents: estimateCostCents(route.model, fullRequest),
    });

    const response = await this.callWithFallback(fullRequest, route.model, route.fallback);

    // Validate structured output; one corrective retry on failure.
    let data: z.infer<S>;
    if (request.schema) {
      const parsed = request.schema.safeParse(response.data);
      if (parsed.success) {
        data = parsed.data;
      } else {
        const retryRequest: ChatRequest = {
          ...fullRequest,
          messages: [
            ...fullRequest.messages,
            {
              role: 'assistant',
              content: JSON.stringify(response.data ?? response.text),
            },
            {
              role: 'user',
              content:
                'Your previous output failed schema validation. Errors: ' +
                JSON.stringify(parsed.error.issues.slice(0, 5)) +
                '. Return a corrected output that conforms to the schema.',
            },
          ],
        };
        const retryResponse = await this.callWithFallback(
          retryRequest,
          route.model,
          route.fallback,
        );
        const reparsed = request.schema.safeParse(retryResponse.data);
        if (!reparsed.success) {
          throw new SchemaValidationError(
            request.kind,
            reparsed.error.issues,
            retryResponse.text,
          );
        }
        this.recordCost(retryResponse, request.kind);
        this.recordAudit(retryRequest, retryResponse);
        return { ...retryResponse, data: reparsed.data };
      }
    } else {
      data = response.data as z.infer<S>;
    }

    this.recordCost(response, request.kind);
    this.recordAudit(fullRequest, response);
    return { ...response, data };
  }

  private async callWithFallback(
    request: ChatRequest,
    model: string,
    fallback?: string,
  ): Promise<ChatResponse> {
    const provider = this.byModel.get(model);
    if (!provider) {
      throw new Error(`LLMGateway: no provider configured for model ${model}`);
    }
    try {
      return await provider.chat({ ...request, model });
    } catch (err) {
      const retryable = err instanceof ProviderError && err.retryable;
      if (fallback && fallback !== model && (retryable || !this.byModel.has(model))) {
        const fallbackProvider = this.byModel.get(fallback);
        if (fallbackProvider) {
          return fallbackProvider.chat({ ...request, model: fallback });
        }
      }
      throw err;
    }
  }

  private recordCost(response: ChatResponse, kind: ChatRequest['kind']): void {
    if (!this.opts.costSink) return;
    const now = (this.opts.now ?? (() => new Date()))();
    void this.opts.costSink.record({
      ...(this.opts.context?.issueId !== undefined
        ? { issueId: this.opts.context.issueId }
        : {}),
      ...(this.opts.context?.runId !== undefined
        ? { runId: this.opts.context.runId }
        : {}),
      kind,
      provider: response.provider,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costCents: computeCostCents(response.model, response.usage),
      at: now.toISOString(),
    });
  }

  private recordAudit(request: ChatRequest, response: ChatResponse): void {
    if (!this.opts.auditSink) return;
    const now = (this.opts.now ?? (() => new Date()))();
    void this.opts.auditSink.record({
      kind: request.kind,
      model: response.model,
      request,
      responseText: response.text || JSON.stringify(response.data),
      at: now.toISOString(),
    });
  }
}

export class SchemaValidationError extends Error {
  constructor(
    readonly kind: string,
    readonly issues: z.ZodIssue[],
    readonly rawOutput: string,
  ) {
    super(
      `LLM output for ${kind} failed schema validation after retry: ` +
        issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
    this.name = 'SchemaValidationError';
  }
}

/** Pre-call cost estimate for the budget guard (input length + maxTokens). */
function estimateCostCents(model: string, request: ChatRequest): number {
  const inputChars = request.messages.reduce((n, m) => n + m.content.length, 0);
  return computeCostCents(model, {
    inputTokens: Math.ceil(inputChars / 4),
    outputTokens: request.maxTokens ?? 4096,
  });
}

/**
 * zod → JSON Schema. Intentionally minimal: covers the constructs used by
 * this package's schemas (object, string, number, integer, boolean, array,
 * enum, optional, default, describe). Swap in zod-to-json-schema later if
 * schemas grow beyond this subset.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convert(schema: any): Record<string, unknown> {
  const def = schema._def;
  const typeName: string = def.typeName;
  const description: string | undefined = def.description;
  const withDesc = (obj: Record<string, unknown>) =>
    description ? { ...obj, description } : obj;

  switch (typeName) {
    case 'ZodString':
      return withDesc({ type: 'string' });
    case 'ZodNumber':
      return withDesc({ type: def.checks?.some((c: { kind: string }) => c.kind === 'int') ? 'integer' : 'number' });
    case 'ZodBoolean':
      return withDesc({ type: 'boolean' });
    case 'ZodEnum':
    case 'ZodNativeEnum':
      return withDesc({ type: 'string', enum: [...def.values] });
    case 'ZodLiteral':
      return withDesc({ const: def.value });
    case 'ZodArray':
      return withDesc({
        type: 'array',
        items: convert(def.type),
        ...(def.minLength ? { minItems: def.minLength.value } : {}),
        ...(def.maxLength ? { maxItems: def.maxLength.value } : {}),
      });
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!(value as { isOptional?: () => boolean }).isOptional?.()) {
          required.push(key);
        }
      }
      return withDesc({
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      });
    }
    case 'ZodOptional':
      return convert(def.innerType);
    case 'ZodDefault':
      return { ...convert(def.innerType), default: def.defaultValue() };
    case 'ZodNullable':
      return { anyOf: [convert(def.innerType), { type: 'null' }] };
    case 'ZodUnion':
      return withDesc({ anyOf: def.options.map(convert) });
    case 'ZodRecord':
      return withDesc({ type: 'object', additionalProperties: convert(def.valueType) });
    default:
      // Unknown constructs degrade to "anything" rather than crashing.
      return withDesc({});
  }
}
