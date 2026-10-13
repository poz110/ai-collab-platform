import { describe, expect, it } from "vitest";
import { positionBetween, POSITION_STEP } from "./position.js";

describe("看板 position 计算", () => {
  it("空列落入默认步长", () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
  });

  it("追加到列尾 = 最后卡片 + 步长", () => {
    expect(positionBetween(2048, null)).toBe(2048 + POSITION_STEP);
  });

  it("插到列顶 = 首张卡片的一半", () => {
    expect(positionBetween(null, 100)).toBe(50);
  });

  it("插入两张卡片之间取中点", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
});
