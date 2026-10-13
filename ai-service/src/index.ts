// Public API of @acp/ai-service.

// Contracts
export type * from './types.js';

// Gateway
export { LLMGateway, SchemaValidationError, zodToJsonSchema } from './gateway/gateway.js';
export { DEFAULT_ROUTING, resolveRoute } from './gateway/router.js';
export type { RouteRule, RoutingTable } from './gateway/router.js';
export {
  computeCostCents,
  InMemoryCostSink,
  PRICING,
  DEFAULT_PRICE,
} from './gateway/cost.js';
export { DailyBudgetGuard, BudgetExceededError } from './gateway/budget.js';
export { InMemoryAuditSink } from './gateway/audit.js';

// Providers
export type { Provider } from './gateway/providers/provider.js';
export { ProviderError } from './gateway/providers/provider.js';
export { AnthropicProvider } from './gateway/providers/anthropic.js';
export { OpenAICompatProvider } from './gateway/providers/openai.js';
export { MockProvider } from './gateway/providers/mock.js';

// Prompts
export {
  registerPrompt,
  getPrompt,
  listPrompts,
  clearPromptRegistry,
} from './prompts/registry.js';
export type { PromptTemplate } from './prompts/registry.js';
import './prompts/task-create.js';
import './prompts/task-split.js';
import './prompts/assignee.js';
import './prompts/insight.js';

// Context
export { assembleIssueContext, DEFAULT_WINDOW } from './context/window.js';

// Capabilities
export {
  createTasksFromText,
  taskCreateOutputSchema,
} from './capabilities/create-task.js';
export {
  splitTask,
  splitOutputSchema,
  sanitizeDependencies,
  SPLIT_SCHEMA_VERSION,
} from './capabilities/split-task.js';
export {
  suggestAssignee,
  scoreCandidate,
  explanationSchema,
  DEFAULT_WEIGHTS,
} from './capabilities/suggest-assignee.js';
export type { AssignmentWeights } from './capabilities/suggest-assignee.js';
export {
  generateProgressInsight,
  buildSnapshot,
  detectRisks,
  insightOutputSchema,
} from './capabilities/progress-insight.js';

// Feedback
export { InMemoryFeedbackStore } from './feedback/store.js';
