import type { ReactNode } from "react";
import PageTitle from "./PageTitle";

interface Props {
  /** 페이지 제목 (h1) */
  title: ReactNode;
  /** 제목 아래 보조 설명(건수 등) */
  sub?: ReactNode;
  /** 제목 우측 인라인 배지(상태칩 등) */
  badges?: ReactNode;
  /** 헤더 우측 정렬 액션(주요 버튼 등) */
  action?: ReactNode;
  className?: string;
}

// 페이지 상단 헤더 표준화: `.page-head` 컨테이너 + PageTitle(제목/부제/배지) + 우측 액션.
// PageTitle 이 flex:1 로 남은 공간을 채워 액션을 오른쪽으로 밀어낸다(별도 spacer 불필요).
export default function PageHeader({ title, sub, badges, action, className }: Props) {
  const cls = ["page-head", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <PageTitle title={title} sub={sub} badges={badges} />
      {action}
    </div>
  );
}
