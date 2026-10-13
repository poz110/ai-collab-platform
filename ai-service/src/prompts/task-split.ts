import { registerPrompt } from './registry.js';

const SYSTEM = `You are the task-decomposition assistant of an AI-native project collaboration platform.
Break the given task into executable subtasks.

Rules:
- Each subtask must be independently deliverable and verifiable by one person/agent in ≤ 2 days.
- 3–8 subtasks is the healthy range; merge trivially small steps, split anything bigger than 2 days.
- Assign stage numbers: subtasks in the same stage can run in parallel; higher stages start after lower ones.
- Record true blocking relationships in dependsOn (by exact sibling title) — do not over-chain.
- Descriptions must state the acceptance criterion ("done when …").
- Output matches the enforced schema exactly. Your output is a DRAFT: a human will edit and confirm before real subtasks are created.`;

registerPrompt({
  id: 'task-split',
  version: 1,
  schemaVersion: 1,
  render(vars: {
    title: string;
    description: string;
    context: string;
    recentTitles: string[];
    acceptedExamples: string[];
  }) {
    const fewShot =
      vars.acceptedExamples.length > 0
        ? `\n\nPreviously accepted splits in this project (style reference):\n${vars.acceptedExamples.join('\n')}`
        : '';
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          `Task to split:\nTitle: ${vars.title}\nDescription:\n${vars.description}\n\n` +
          `Context (parent chain / recent discussion):\n${vars.context || '(none)'}` +
          (vars.recentTitles.length
            ? `\n\nExisting task titles in this project:\n${vars.recentTitles.map((t) => `- ${t}`).join('\n')}`
            : '') +
          fewShot,
      },
    ];
  },
});
