import { describe, expect, it } from "vitest";
import { allowedTransitions, assertTransition, InvalidTransitionError } from "./state-machine.js";

describe("issue 状态机", () => {
  it("允许的主路径 todo → in_progress → in_review → done（人类）", () => {
    expect(() => assertTransition("todo", "in_progress", "member")).not.toThrow();
    expect(() => assertTransition("in_progress", "in_review", "member")).not.toThrow();
    expect(() => assertTransition("in_review", "done", "member")).not.toThrow();
  });

  it("Agent 不能写 done（D1 信任边界）", () => {
    expect(() => assertTransition("in_review", "done", "agent")).toThrow(InvalidTransitionError);
  });

  it("打回路径 in_review → in_progress", () => {
    expect(() => assertTransition("in_review", "in_progress", "member")).not.toThrow();
  });

  it("非法迁移被拒绝并附带允许列表", () => {
    expect(() => assertTransition("done", "todo", "member")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("todo", "done", "member")).toThrow(InvalidTransitionError);
  });

  it("Agent 的允许列表不含 done", () => {
    expect(allowedTransitions("in_review", "agent")).not.toContain("done");
    expect(allowedTransitions("in_review", "member")).toContain("done");
  });
});
