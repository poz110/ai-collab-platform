import { z } from 'zod';
import type { LLMGateway } from '../gateway/gateway.js';
import { getPrompt } from '../prompts/registry.js';
import '../prompts/insight.js';
import type {
  BackendDataProvider,
  IssueRef,
  MemberProfile,
  ProgressInsight,
} from '../types.js';

export const insightOutputSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(
    z.object({
      issueKey: z.string(),
      severity: z.enum(['high', 'medium', 'low']),
      kind: z.enum(['overdue', 'blocked', 'stale', 'overload']),
      detail: z.string(),
    }),
  ),
  suggestions: z.array(z.string()),
});

export interface ProjectSnapshot {
  issues: IssueRef[];
  members: MemberProfile[];
}

/**
 * Build the structured snapshot that the insight prompt consumes
 * (architecture §5.2: snapshots, not raw comment streams). Kept separate
 * so the backend can reuse it for dashboards.
 */
export function buildSnapshot(
  issues: IssueRef[],
  members: MemberProfile[],
  today: string,
): Record<string, unknown> {
  const todayMs = Date.parse(today);
  const loadByMember = new Map<string, number>();
  for (const issue of issues) {
    if (
      issue.assigneeType === 'member' &&
      issue.assigneeId &&
      (issue.status === 'todo' || issue.status === 'in_progress')
    ) {
      loadByMember.set(
        issue.assigneeId,
        (loadByMember.get(issue.assigneeId) ?? 0) + 1,
      );
    }
  }

  return {
    today,
    issueCount: issues.length,
    byStatus: countBy(issues, (i) => i.status),
    issues: issues.map((i) => ({
      key: i.key,
      title: i.title,
      status: i.status,
      priority: i.priority,
      dueDate: i.dueDate,
      overdue:
        i.dueDate !== undefined &&
        Date.parse(i.dueDate) < todayMs &&
        i.status !== 'done' &&
        i.status !== 'cancelled',
      assignee: i.assigneeId,
      daysSinceUpdate: Math.floor(
        (todayMs - Date.parse(i.createdAt)) / 86_400_000,
      ),
    })),
    memberLoad: members.map((m) => ({
      name: m.name,
      openIssues: loadByMember.get(m.id) ?? m.activeLoad,
      capacity: m.capacity ?? 5,
    })),
  };
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export interface ProgressInsightOptions {
  gateway: LLMGateway;
  backend: BackendDataProvider;
  projectId: string;
  /** Issues in the project — the backend queries; here for testability. */
  issues: IssueRef[];
  /** YYYY-MM-DD. */
  today: string;
}

/**
 * Progress insight (issue spec §4): risk identification + status summary
 * + actionable suggestions, every claim cited by issue key. Risks found
 * deterministically are merged with the LLM's output so nothing the rule
 * layer already knows can be talked away by the model.
 */
export async function generateProgressInsight(
  opts: ProgressInsightOptions,
): Promise<ProgressInsight> {
  const members = await opts.backend.listMembers(opts.projectId);
  const snapshot = buildSnapshot(opts.issues, members, opts.today);

  const prompt = getPrompt('progress-insight');
  const messages = prompt.render({
    snapshotJson: JSON.stringify(snapshot, null, 2),
    today: opts.today,
  });

  const { data } = await opts.gateway.chat({
    kind: 'progress_insight',
    messages,
    schema: insightOutputSchema,
    schemaName: 'progress_report',
    temperature: 0,
  });

  const deterministicRisks = detectRisks(opts.issues, opts.today);
  const merged = mergeRisks(deterministicRisks, data.risks);

  return {
    projectId: opts.projectId,
    generatedAt: opts.today,
    summary: data.summary,
    risks: merged,
    suggestions: data.suggestions,
  };
}

/** Rule-layer risk detection — the ground truth the LLM annotates. */
export function detectRisks(
  issues: IssueRef[],
  today: string,
): ProgressInsight['risks'] {
  const todayMs = Date.parse(today);
  const risks: ProgressInsight['risks'] = [];
  for (const i of issues) {
    if (i.status === 'done' || i.status === 'cancelled') continue;
    if (i.dueDate && Date.parse(i.dueDate) < todayMs) {
      risks.push({
        issueKey: i.key,
        severity: daysLate(i.dueDate, todayMs) > 3 ? 'high' : 'medium',
        kind: 'overdue',
        detail: `Due ${i.dueDate}, still ${i.status}`,
      });
    }
    if (i.status === 'blocked') {
      risks.push({
        issueKey: i.key,
        severity: 'high',
        kind: 'blocked',
        detail: 'Marked blocked',
      });
    }
  }
  return risks;
}

function daysLate(dueDate: string, todayMs: number): number {
  return Math.floor((todayMs - Date.parse(dueDate)) / 86_400_000);
}

function mergeRisks(
  deterministic: ProgressInsight['risks'],
  llm: ProgressInsight['risks'],
): ProgressInsight['risks'] {
  const seen = new Set(deterministic.map((r) => `${r.issueKey}:${r.kind}`));
  return [
    ...deterministic,
    ...llm.filter((r) => !seen.has(`${r.issueKey}:${r.kind}`)),
  ];
}
