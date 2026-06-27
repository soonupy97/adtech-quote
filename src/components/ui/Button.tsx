import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

// 범용 디자인 시스템 컨벤션의 버튼 변형:
//  primary       — 주요 CTA (솔리드 ink)
//  secondary     — 기본 보조 액션 (회색 솔리드) · 기본값
//  outline       — 테두리만 (투명 배경)
//  ghost         — 배경·테두리 없음 (툴바/아이콘)
//  danger        — 파괴적 액션 (삭제 등)
//  link          — 텍스트 링크형
//  inverse       — 어두운 블록 위 흰 버튼
//  inverse-ghost — 어두운 블록 위 반투명 버튼
//  kakao         — 카카오 브랜드 (로그인/발송)
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "link"
  | "inverse"
  | "inverse-ghost"
  | "kakao";
export type ButtonSize = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** 라벨 왼쪽 아이콘 (lucide 등). children 없이 아이콘만 주면 아이콘 버튼. */
  icon?: ReactNode;
  /** 진행 중 상태: 스피너 표시 + 자동 비활성화(중복 클릭 방지) */
  loading?: boolean;
}

// 디자인 시스템 버튼. .btn 은 베이스 마커이고, 변형/사이즈/상태(props)는 모두 data-* 속성으로
// 노출한다 → CSS 는 [data-variant] / [data-size] / [data-icon-only] 등 속성 선택자로 스타일링.
export default function Button({
  variant = "secondary",
  size = "md",
  block,
  icon,
  loading,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  // 아이콘만 있고 라벨이 없으면 정사각(원형) 아이콘 버튼으로 취급
  const hasLabel = children != null && children !== false && children !== "";
  const iconOnly = !hasLabel && (icon != null || !!loading);

  // 사이즈별 아이콘 크기 (높이·폰트와 함께 단계적으로 증가)
  const iconSize = { sm: 14, md: 16, lg: 18 }[size];

  return (
    <button
      type={type}
      className={className ? `btn ${className}` : "btn"}
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      data-block={block || undefined}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} className="spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
