import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  /** 아이콘 크기(px). 기본 18 */
  size?: number;
  /** 라벨을 주면 스피너 + 텍스트를 가로 중앙 정렬한 박스로 렌더(페이지/영역 로딩용) */
  label?: string;
  /** 라벨 없이도 중앙 박스로 렌더하고 싶을 때 */
  center?: boolean;
  className?: string;
  style?: CSSProperties;
}

// 범용 로딩 스피너. Button 의 로딩 표시와 동일한 Loader2 + `spin` 키프레임을 사용해 톤을 맞춘다.
// 인라인: <Spinner /> — 회전 아이콘만. 텍스트 옆·작은 영역에 사용.
// 박스:  <Spinner label="불러오는 중…" /> — 중앙 정렬(페이지/카드 로딩 자리표시).
export default function Spinner({ size = 18, label, center, className, style }: Props) {
  const icon = <Loader2 size={size} className="spin" aria-hidden />;
  if (label || center) {
    return (
      <div className={`spinner-box${className ? ` ${className}` : ""}`} role="status" aria-live="polite" style={style}>
        {icon}
        {label && <span>{label}</span>}
      </div>
    );
  }
  return (
    <span className={`spinner${className ? ` ${className}` : ""}`} role="status" aria-live="polite" style={style}>
      {icon}
    </span>
  );
}
