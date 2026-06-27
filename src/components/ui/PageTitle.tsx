import type { ReactNode } from "react";

interface Props {
  /** 페이지 제목 (h1) */
  title: ReactNode;
  /** 제목 아래 보조 설명 */
  sub?: ReactNode;
  /** 제목 우측 인라인 배지(상태칩 등) */
  badges?: ReactNode;
}

// page-head 내부의 제목 묶음(h1 + 부제 + 인라인 배지)을 캡슐화.
// .page-title 은 flex:1 로 남은 가로 공간을 채워, 형제 액션을 오른쪽으로 밀어낸다(별도 spacer 불필요).
export default function PageTitle({ title, sub, badges }: Props) {
  return (
    <div className="page-title">
      {badges != null ? (
        <div className="row" style={{ gap: 12 }}>
          <h1>{title}</h1>
          {badges}
        </div>
      ) : (
        <h1>{title}</h1>
      )}
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  );
}
