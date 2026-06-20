import type { CSSProperties, ReactNode } from "react";

interface Props {
  label: ReactNode;
  /** 라벨 아래에 들어갈 입력 컨트롤(Input/Textarea/Select 등) */
  children: ReactNode;
  /** 라벨 밑 보조 설명 */
  hint?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// label.field > span(라벨) + 컨트롤 패턴을 캡슐화.
export default function Field({ label, children, hint, className, style }: Props) {
  const cls = ["field", className].filter(Boolean).join(" ");
  return (
    <label className={cls} style={style}>
      <span>{label}</span>
      {children}
      {hint && <span className="eyebrow" style={{ marginTop: 8 }}>{hint}</span>}
    </label>
  );
}
