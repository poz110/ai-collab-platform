import { z } from 'zod';
import type { LLMGateway } from '../gateway/gateway.js';
import { getPrompt } from '../prompts/registry.js';
import '../prompts/task-create.js'; // register templates
import type {
  BackendDataProvider,
  DraftTask,
  FeedbackStore,
} from '../types.js';

const draftTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  labels: z.array(z.string()).default([]),
  taskType: z.enum(['feature', 'bug', 'chore', 'research', 'docs']),
});

export const taskCreateOutputSchema = z.object({
  tasks: z.array(draftTaskSchema).min(1).max(20),
});

export interface CreateTasksOptions {
  gateway: LLMGateway;
  backend: BackendDataProvider;
  feedback?: FeedbackStore;
  projectId: string;
  /** Natural-language request from the user. */
  input: string;
  /** YYYY-MM-DD; injected for deterministic date inference. */
  today: string;
}

/**
 * Natural language → structured draft tasks (issue spec §1: AI 辅助创建任务,
 * batch supported). Returns DRAFTS — the backend creates real issues only
 * after user confirmation, mirroring the split-draft flow.
 */
export async function createTasksFromText(
  opts: CreateTasksOptions,
): Promise<{ drafts: DraftTask[] }> {
  const recentTitles = await opts.backend.listRecentIssueTitles(opts.projectId, 20);
  const accepted = opts.feedback
    ? await opts.feedback.listAccepted('task_create', 5)
    : [];
  const acceptedExamples = accepted.map((e) => summarizeProposal(e.proposal));

  const prompt = getPrompt('task-create');
  const messages = prompt.render({
    input: opts.input,
    today: opts.today,
    recentTitles,
    acceptedExamples,
  });

  const { data } = await opts.gateway.chat({
    kind: 'task_create',
    messages,
    schema: taskCreateOutputSchema,
    schemaName: 'draft_tasks',
  });

  return { drafts: data.tasks };
}

function summarizeProposal(proposal: unknown): string {
  try {
    const tasks = (proposal as { drafts?: DraftTask[] }).drafts;
    if (Array.isArray(tasks)) {
      return tasks.map((t) => `[${t.taskType}/${t.priority}] ${t.title}`).join(' | ');
    }
    return JSON.stringify(proposal).slice(0, 200);
  } catch {
    return String(proposal).slice(0, 200);
  }
}
