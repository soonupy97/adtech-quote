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

// 기존 .btn 디자인 시스템(pill)을 그대로 쓰는 얇은 래퍼.
// 기본 .btn 자체가 secondary(회색)이므로 secondary 는 별도 클래스를 붙이지 않는다.
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
  const cls = [
    "btn",
    variant !== "secondary" && variant,
    size !== "md" && size,
    block && "block",
    loading && "is-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconSize = size === "sm" ? 14 : 16;

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} className="spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
