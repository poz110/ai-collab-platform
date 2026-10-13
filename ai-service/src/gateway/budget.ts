import type { BudgetGuard } from '../types.js';

export class BudgetExceededError extends Error {
  constructor(
    readonly issueId: string | undefined,
    readonly spentCents: number,
    readonly limitCents: number,
  ) {
    super(
      `Daily LLM budget exceeded${issueId ? ` for issue ${issueId}` : ''}: ` +
        `${spentCents.toFixed(4)}¢ >= ${limitCents}¢`,
    );
    this.name = 'BudgetExceededError';
  }
}

/**
 * Hard rail from architecture.md §5.3: per-issue daily quota. The backend
 * supplies spend lookup; this class enforces. Fail closed — an error in the
 * spend lookup blocks the call rather than letting spend run away.
 */
export class DailyBudgetGuard implements BudgetGuard {
  constructor(
    private readonly opts: {
      limitCentsPerIssuePerDay: number;
      /** Returns today's spend in cents for the issue (or workspace total). */
      getSpentCentsToday: (issueId?: string) => number | Promise<number>;
    },
  ) {}

  async assertWithinBudget(ctx: {
    issueId?: string;
    estimatedCostCents: number;
  }): Promise<void> {
    const spent = await this.opts.getSpentCentsToday(ctx.issueId);
    if (spent + ctx.estimatedCostCents > this.opts.limitCentsPerIssuePerDay) {
      throw new BudgetExceededError(
        ctx.issueId,
        spent,
        this.opts.limitCentsPerIssuePerDay,
      );
    }
  }
}
