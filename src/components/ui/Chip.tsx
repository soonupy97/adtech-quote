import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  variant?: "default" | "blue";
  className?: string;
  style?: CSSProperties;
}

// .chip 패턴(작은 라벨/태그)을 캡슐화.
export default function Chip({ children, variant = "default", className, style }: Props) {
  const cls = ["chip", variant === "blue" && "blue", className].filter(Boolean).join(" ");
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}
