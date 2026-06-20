import type { ReactNode } from "react";

interface Props {
  /** 큰 아이콘 (lucide 등) */
  icon?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  /** 하단 액션(버튼 등) */
  action?: ReactNode;
}

// .empty 패턴(아이콘 + 제목 + 설명)을 캡슐화.
export default function EmptyState({ icon, title, desc, action }: Props) {
  return (
    <div className="empty">
      {icon && <div className="big">{icon}</div>}
      <div className="ttl">{title}</div>
      {desc && <div>{desc}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
