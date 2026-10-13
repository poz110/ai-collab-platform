import { cn } from "@/lib/utils";

/** 头像：显示名字首字符。人类成员用蓝色，与原型一致。 */
export function Avatar({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const ch = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold text-white",
        size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs",
        className,
      )}
      title={name}
    >
      {ch}
    </span>
  );
}
