import type { HTMLAttributes, ReactNode } from "react";

export type BannerVariant = "ok" | "no" | "info";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** ok=수락/성공, no=거절/오류, info=안내 (기본 info) */
  variant?: BannerVariant;
  /** 좌측 아이콘(lucide 등). 지정 시 아이콘·텍스트를 flex 로 정렬 */
  icon?: ReactNode;
  /** 여러 줄 메시지에서 아이콘을 상단에 정렬 */
  alignStart?: boolean;
}

// 상태/안내 배너 표준화: `.banner` + 변형색 + (옵션)아이콘.
// role·style 등 나머지 div 속성은 그대로 전달된다.
export default function Banner({ variant = "info", icon, alignStart, className, children, ...rest }: Props) {
  const cls = ["banner", variant, icon && "has-icon", alignStart && "align-start", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {icon}
      {icon ? <span>{children}</span> : children}
    </div>
  );
}
