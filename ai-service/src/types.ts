/**
 * Core contracts for @acp/ai-service.
 *
 * These types mirror the data model in docs/design/architecture.md §三
 * and are the stable interface between this package and the backend
 * (DEV-5). The backend implements `BackendDataProvider`; this package
 * never touches the database directly.
 */

// ---------------------------------------------------------------------------
// LLM Gateway contracts
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * JSON Schema (draft 2020-12 subset) describing the expected assistant
 * output. Providers MUST enforce it (Anthropic: forced tool-use; OpenAI:
 * response_format json_schema) so callers never parse free-form text.
 */
export type JsonSchema = Record<string, unknown>;

export type TaskKind =
  | 'task_create'
  | 'task_split'
  | 'suggest_assignee'
  | 'progress_insight'
  | 'explain';

export interface ChatRequest {
  /** Which capability is calling — drives model routing and cost buckets. */
  kind: TaskKind;
  messages: ChatMessage[];
  /** When set, the response is guaranteed to validate against this schema. */
  schema?: JsonSchema;
  /** Stable name for the schema/tool (provider-side tool name). */
  schemaName?: string;
  /** Sampling temperature. Defaults per kind in the router. */
  temperature?: number;
  maxTokens?: number;
  /** Pin a specific model, bypassing the router (tests, manual override). */
  model?: string;
}

export interface ChatResponse<T = unknown> {
  /** Parsed and schema-validated structured output (when schema given). */
  data: T;
  /** Raw text, for unstructured replies. */
  text: string;
  model: string;
  provider: string;
  usage: TokenUsage;
  /** Provider request id, for support/debugging. */
  requestId?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CostRecord {
  issueId?: string;
  runId?: string;
  kind: TaskKind;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** USD cents, computed from the pricing table. */
  costCents: number;
  at: string; // ISO 8601
}

export interface AuditEntry {
  kind: TaskKind;
  model: string;
  request: ChatRequest;
  responseText: string;
  at: string;
}

/** Persistence sinks — implemented by the backend (Postgres) in production. */
export interface CostSink {
  record(entry: CostRecord): void | Promise<void>;
}

export interface AuditSink {
  record(entry: AuditEntry): void | Promise<void>;
}

/** Daily spend guard, per architecture §5.3 hard rails. */
export interface BudgetGuard {
  /**
   * Throw BudgetExceededError when the issue (or workspace fallback) is
   * over its daily LLM quota. Called before every provider request.
   */
  assertWithinBudget(ctx: { issueId?: string; estimatedCostCents: number }):
    | void
    | Promise<void>;
}

// ---------------------------------------------------------------------------
// Domain contracts (mirror of architecture.md §三, backend-owned)
// ---------------------------------------------------------------------------

export type IssueStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'blocked'
  | 'cancelled';

export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low';

export interface IssueRef {
  id: string;
  /** Human-readable key, e.g. ACP-42. */
  key: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string;
  parentId?: string;
  stage?: number;
  dueDate?: string; // YYYY-MM-DD
  assigneeType?: 'member' | 'agent';
  assigneeId?: string;
  labels: string[];
  createdAt: string;
}

export interface MemberProfile {
  id: string;
  name: string;
  /** Free-form skill tags, e.g. ["frontend", "react", "infra"]. */
  skills: string[];
  /** Currently open (todo+in_progress) assigned issue count. */
  activeLoad: number;
  /** Max comfortable concurrent load; defaults in rule engine. */
  capacity?: number;
  /** IANA timezone, e.g. "Asia/Shanghai". */
  timezone?: string;
  /** Historical acceptance rate of AI suggestions for this member, 0..1. */
  historicalAcceptance?: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  runtime: string;
  capabilities: string[];
  activeLoad: number;
  capacity?: number;
}

/**
 * Everything the AI service needs from the backend. DEV-5's backend
 * implements this over Drizzle; tests implement it in memory.
 */
export interface BackendDataProvider {
  getIssue(issueId: string): Promise<IssueRef | null>;
  /** Recent issue titles in the project — few-shot style alignment. */
  listRecentIssueTitles(projectId: string, limit: number): Promise<string[]>;
  listMembers(projectId: string): Promise<MemberProfile[]>;
  listAgents(projectId: string): Promise<AgentProfile[]>;
  /** Recent comments for context window assembly. */
  listRecentComments(issueId: string, limit: number): Promise<CommentRef[]>;
}

export interface CommentRef {
  id: string;
  authorType: 'member' | 'agent' | 'system';
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Capability outputs
// ---------------------------------------------------------------------------

export interface DraftTask {
  title: string;
  description: string;
  priority: IssuePriority;
  dueDate?: string | undefined;
  labels: string[];
  /** Inferred task type, e.g. "feature" | "bug" | "chore" | "research". */
  taskType: string;
}

export interface SubtaskNode {
  title: string;
  description: string;
  priority: IssuePriority;
  /** Suggested stage grouping (serial execution order). */
  stage: number;
  /** Titles of sibling subtasks this one depends on. */
  dependsOn: string[];
  labels: string[];
}

export interface SplitDraft {
  /** Bumped when the output schema changes — prevents stale drafts. */
  schemaVersion: number;
  issueId: string;
  subtasks: SubtaskNode[];
  /** Plain-language execution order rationale shown to the user. */
  rationale: string;
}

export interface AssigneeSuggestion {
  assigneeType: 'member' | 'agent';
  assigneeId: string;
  name: string;
  /** 0..1 rule-engine score before LLM explanation. */
  score: number;
  reasons: string[];
  /** LLM-generated explanation, when enabled. */
  explanation?: string;
}

export interface ProgressInsight {
  projectId: string;
  generatedAt: string;
  summary: string;
  risks: Array<{
    issueKey: string;
    severity: 'high' | 'medium' | 'low';
    kind: 'overdue' | 'blocked' | 'stale' | 'overload';
    detail: string;
  }>;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Feedback loop (accept/reject → better future suggestions)
// ---------------------------------------------------------------------------

export type FeedbackTarget =
  | 'task_create'
  | 'task_split'
  | 'suggest_assignee'
  | 'progress_insight';

export interface FeedbackEvent {
  target: FeedbackTarget;
  /** What the AI proposed (serialized). */
  proposal: unknown;
  accepted: boolean;
  /** User's edited version, when they accepted with modifications. */
  correction?: unknown;
  issueId?: string;
  at: string;
}

export interface FeedbackStore {
  record(event: FeedbackEvent): void | Promise<void>;
  /**
   * Accepted proposals for few-shot injection, most recent first.
   * Rejections are used for accuracy metrics, not prompt injection.
   */
  listAccepted(target: FeedbackTarget, limit: number): Promise<FeedbackEvent[]>;
  accuracy(target: FeedbackTarget): Promise<{ total: number; accepted: number }>;
}
