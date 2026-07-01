import type { ReactNode } from "react";

interface Props {
  /** 라벨(상단 소문자 캡션) */
  label: ReactNode;
  /** 주요 값(하단 정렬) */
  value: ReactNode;
  /** 값 아래 보조 문구 */
  sub?: ReactNode;
  /** 우측 상단 아이콘 */
  icon?: ReactNode;
  /** feature 배경(연한 오트밀 타일) */
  feature?: boolean;
  className?: string;
}

// KPI/통계 타일 표준화: `.bento` 그리드 안에서 라벨+아이콘(상단), 값(하단정렬), 보조문구.
// 반드시 `.bento` 컨테이너 안에서 사용한다(타일 스타일이 `.bento .tile` 로 스코프됨).
export default function StatCard({ label, value, sub, icon, feature, className }: Props) {
  const cls = ["tile", feature && "feature", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="kpi-top">
        <div className="k">{label}</div>
        {icon && <span className="kpi-ic">{icon}</span>}
      </div>
      <div className="v push-bottom">{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  );
}
