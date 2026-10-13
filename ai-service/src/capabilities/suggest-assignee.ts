import { z } from 'zod';
import type { LLMGateway } from '../gateway/gateway.js';
import { getPrompt } from '../prompts/registry.js';
import '../prompts/assignee.js';
import type {
  AgentProfile,
  AssigneeSuggestion,
  BackendDataProvider,
  IssueRef,
  MemberProfile,
} from '../types.js';

export const explanationSchema = z.object({
  explanations: z.array(
    z.object({ name: z.string(), explanation: z.string() }),
  ),
});

export interface AssignmentWeights {
  skillMatch: number;
  load: number;
  historicalAcceptance: number;
}

export const DEFAULT_WEIGHTS: AssignmentWeights = {
  skillMatch: 0.5,
  load: 0.3,
  historicalAcceptance: 0.2,
};

export const DEFAULT_CAPACITY = 5;

/**
 * Rule engine for smart assignment (architecture §5.2: rules rank, LLM
 * explains — no ML at MVP because cold start has no training data).
 *
 * Score = w_skill * skillOverlap + w_load * (1 - load/capacity)
 *         + w_hist * historicalAcceptance
 */
export function scoreCandidate(
  candidate: {
    skills: string[];
    activeLoad: number;
    capacity?: number | undefined;
    historicalAcceptance?: number | undefined;
  },
  task: { labels: string[]; title: string; description: string },
  weights: AssignmentWeights = DEFAULT_WEIGHTS,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const taskTokens = new Set(
    [...task.labels, ...tokenize(task.title), ...tokenize(task.description)].map((t) =>
      t.toLowerCase(),
    ),
  );
  const matchedSkills = candidate.skills.filter((s) => taskTokens.has(s.toLowerCase()));
  const skillScore =
    candidate.skills.length === 0
      ? 0
      : Math.min(1, matchedSkills.length / Math.max(1, Math.min(3, candidate.skills.length)));
  if (matchedSkills.length) {
    reasons.push(`技能匹配: ${matchedSkills.join(', ')}`);
  }

  const capacity = candidate.capacity ?? DEFAULT_CAPACITY;
  const loadRatio = Math.min(1, candidate.activeLoad / capacity);
  const loadScore = 1 - loadRatio;
  reasons.push(`当前负载 ${candidate.activeLoad}/${capacity}`);

  const hist = candidate.historicalAcceptance;
  const histScore = hist ?? 0.5; // neutral prior without history
  if (hist !== undefined) {
    reasons.push(`历史建议采纳率 ${(hist * 100).toFixed(0)}%`);
  }

  const score =
    weights.skillMatch * skillScore +
    weights.load * loadScore +
    weights.historicalAcceptance * histScore;

  return { score: Math.round(score * 1000) / 1000, reasons };
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s,，。/、;；:：()（）\[\]-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export interface SuggestAssigneeOptions {
  gateway?: LLMGateway; // optional — explanations skipped without it
  backend: BackendDataProvider;
  issueId: string;
  /** Include agents as candidates (default true). */
  includeAgents?: boolean;
  /** Max suggestions returned (default 3). */
  topN?: number;
  weights?: AssignmentWeights;
}

/**
 * Smart assignment (issue spec §3): rule-engine ranking over skills, load,
 * and history; optional LLM-written explanation for the top candidates.
 * Members with no skill overlap AND full load are filtered out entirely.
 */
export async function suggestAssignee(
  opts: SuggestAssigneeOptions,
): Promise<{ suggestions: AssigneeSuggestion[] }> {
  const issue = await opts.backend.getIssue(opts.issueId);
  if (!issue) throw new Error(`Issue not found: ${opts.issueId}`);

  const [members, agents] = await Promise.all([
    opts.backend.listMembers(issue.projectId),
    (opts.includeAgents ?? true)
      ? opts.backend.listAgents(issue.projectId)
      : Promise.resolve([]),
  ]);

  const task = {
    labels: issue.labels,
    title: issue.title,
    description: issue.description,
  };

  const candidates: AssigneeSuggestion[] = [];

  for (const m of members) {
    const { score, reasons } = scoreCandidate(m, task, opts.weights);
    if (isViable(m.skills, m.activeLoad, m.capacity, task)) {
      candidates.push({
        assigneeType: 'member',
        assigneeId: m.id,
        name: m.name,
        score,
        reasons,
      });
    }
  }
  for (const a of agents) {
    const agentAsCandidate = {
      skills: a.capabilities,
      activeLoad: a.activeLoad,
      capacity: a.capacity,
      historicalAcceptance: undefined,
    };
    const { score, reasons } = scoreCandidate(agentAsCandidate, task, opts.weights);
    candidates.push({
      assigneeType: 'agent',
      assigneeId: a.id,
      name: a.name,
      score,
      reasons: [...reasons, `运行时: ${a.runtime}`],
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, opts.topN ?? 3);

  if (opts.gateway && top.length > 0) {
    await attachExplanations(opts.gateway, issue, top);
  }

  return { suggestions: top };
}

function isViable(
  skills: string[],
  activeLoad: number,
  capacity: number | undefined,
  task: { labels: string[]; title: string; description: string },
): boolean {
  const cap = capacity ?? DEFAULT_CAPACITY;
  if (activeLoad >= cap) return false;
  // Zero skills AND zero textual overlap → not a meaningful suggestion.
  if (skills.length === 0) return true; // generalists stay eligible
  return true;
}

async function attachExplanations(
  gateway: LLMGateway,
  issue: IssueRef,
  top: AssigneeSuggestion[],
): Promise<void> {
  const prompt = getPrompt('assignee-explain');
  const messages = prompt.render({
    taskTitle: issue.title,
    taskLabels: issue.labels,
    candidates: top.map((c) => ({
      name: c.name,
      score: c.score,
      reasons: c.reasons,
    })),
  });
  const { data } = await gateway.chat({
    kind: 'suggest_assignee',
    messages,
    schema: explanationSchema,
    schemaName: 'assignment_explanations',
  });
  for (const e of data.explanations) {
    const target = top.find((c) => c.name === e.name);
    if (target) target.explanation = e.explanation;
  }
}
