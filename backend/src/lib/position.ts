/**
 * 看板 position 小数重排（architecture.md §三 设计说明 2）
 * beforeId = 落点上方卡片，afterId = 落点下方卡片；两端与空列各有默认值。
 */
export const POSITION_STEP = 1024;

export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return POSITION_STEP;
  if (before == null) return after! / 2; // 插到列顶
  if (after == null) return before + POSITION_STEP; // 追加到列尾
  return (before + after) / 2;
}
