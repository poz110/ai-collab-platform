import { registerPrompt } from './registry.js';

const SYSTEM = `You are the task-creation assistant of an AI-native project collaboration platform.
Convert the user's natural-language request into one or more structured tasks.

Rules:
- Write titles in the project's existing style (see examples), imperative and ≤ 60 chars when possible.
- Infer taskType from: feature | bug | chore | research | docs.
- Infer priority from urgency cues ("ASAP"/"紧急" → urgent, "这周"/"尽快" → high, default medium).
- Only set dueDate when the user gives an explicit or strongly implied date; use YYYY-MM-DD. Today's date is provided in context.
- If the request contains multiple independent deliverables, return multiple tasks — do not merge them.
- Never invent technical requirements the user did not state; put open questions in the description instead.`;

registerPrompt({
  id: 'task-create',
  version: 1,
  schemaVersion: 1,
  render(vars: {
    input: string;
    today: string;
    recentTitles: string[];
    acceptedExamples: string[];
  }) {
    const fewShot =
      vars.acceptedExamples.length > 0
        ? `\n\nPreviously accepted outputs (match this style):\n${vars.acceptedExamples
            .map((e) => `- ${e}`)
            .join('\n')}`
        : '';
    const styleHints =
      vars.recentTitles.length > 0
        ? `\n\nRecent task titles in this project (for style alignment):\n${vars.recentTitles
            .map((t) => `- ${t}`)
            .join('\n')}`
        : '';
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Today: ${vars.today}\n\nUser request:\n${vars.input}${styleHints}${fewShot}`,
      },
    ];
  },
});
