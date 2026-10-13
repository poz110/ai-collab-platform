import { z } from 'zod';
import { assembleIssueContext } from '../context/window.js';
import type { LLMGateway } from '../gateway/gateway.js';
import { getPrompt } from '../prompts/registry.js';
import '../prompts/task-split.js';
import type {
  BackendDataProvider,
  FeedbackStore,
  SplitDraft,
} from '../types.js';

/** Bump when subtaskOutputSchema changes (architecture §8 risk 4). */
export const SPLIT_SCHEMA_VERSION = 1;

const subtaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  stage: z.number().int().min(1).max(10),
  dependsOn: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

export const splitOutputSchema = z.object({
  subtasks: z.array(subtaskSchema).min(1).max(12),
  rationale: z.string().min(1),
});

export interface SplitTaskOptions {
  gateway: LLMGateway;
  backend: BackendDataProvider;
  feedback?: FeedbackStore;
  issueId: string;
}

/**
 * Issue → draft subtask tree (issue spec §2: AI 任务拆分).
 *
 * Output is ALWAYS a draft (architecture §2.1): the backend stores it in
 * `issue.draft_split` and only materializes real subtasks when the user
 * confirms via POST /issues/:id/ai/split/confirm.
 *
 * Post-validation beyond the schema: dependsOn must reference sibling
 * titles and be acyclic — malformed references are stripped, not fatal.
 */
export async function splitTask(opts: SplitTaskOptions): Promise<SplitDraft> {
  const issue = await opts.backend.getIssue(opts.issueId);
  if (!issue) throw new Error(`Issue not found: ${opts.issueId}`);

  const [context, recentTitles, accepted] = await Promise.all([
    assembleIssueContext(opts.backend, issue),
    opts.backend.listRecentIssueTitles(issue.projectId, 20),
    opts.feedback?.listAccepted('task_split', 3) ?? Promise.resolve([]),
  ]);

  const prompt = getPrompt('task-split');
  const messages = prompt.render({
    title: issue.title,
    description: issue.description,
    context,
    recentTitles,
    acceptedExamples: accepted.map((e) => JSON.stringify(e.proposal).slice(0, 400)),
  });

  const { data } = await opts.gateway.chat({
    kind: 'task_split',
    messages,
    schema: splitOutputSchema,
    schemaName: 'subtask_tree',
  });

  const subtasks = sanitizeDependencies(data.subtasks);
  return {
    schemaVersion: SPLIT_SCHEMA_VERSION,
    issueId: issue.id,
    subtasks,
    rationale: data.rationale,
  };
}

/**
 * Strip dangling dependsOn references and break cycles. The LLM
 * occasionally hallucinates titles; a missing dep is recoverable, a cycle
 * would corrupt stage ordering downstream.
 */
export function sanitizeDependencies(
  subtasks: z.infer<typeof subtaskSchema>[],
): z.infer<typeof subtaskSchema>[] {
  const titles = new Set(subtasks.map((s) => s.title));
  const cleaned = subtasks.map((s) => ({
    ...s,
    dependsOn: s.dependsOn.filter((d) => d !== s.title && titles.has(d)),
  }));

  // Iterative cycle break: drop edges that point backwards in a topo walk.
  const done = new Set<string>();
  let progressed = true;
  while (progressed && done.size < cleaned.length) {
    progressed = false;
    for (const s of cleaned) {
      if (done.has(s.title)) continue;
      if (s.dependsOn.every((d) => done.has(d))) {
        done.add(s.title);
        progressed = true;
      }
    }
    if (!progressed) {
      // Break the cycle at the first remaining node by dropping its deps.
      const stuck = cleaned.find((s) => !done.has(s.title));
      if (stuck) {
        stuck.dependsOn = [];
        done.add(stuck.title);
        progressed = true;
      }
    }
  }
  return cleaned;
}
