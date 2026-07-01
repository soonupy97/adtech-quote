import type { ReactNode } from "react";

interface Props {
  /** 카드/섹션 제목 */
  title: ReactNode;
  /** 제목 옆 옅은 보조 문구(인라인) */
  note?: ReactNode;
  /** 우측 정렬 액션(버튼·링크 등) */
  action?: ReactNode;
  className?: string;
}

// 카드 상단 헤더 표준화: `.row` + `.card-title`(하단 마진 제거) + (옵션)보조문구 + `.spacer` + 액션.
// 여러 페이지에서 반복되던 "제목 + 우측 버튼" 헤더 패턴을 한곳으로 모은다.
export default function CardHeader({ title, note, action, className }: Props) {
  const cls = ["row", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="card-title flush">{title}</div>
      {note ? <span className="dim card-hd-note">{note}</span> : null}
      <div className="spacer" />
      {action}
    </div>
  );
}
