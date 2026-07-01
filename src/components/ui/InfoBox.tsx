import type { CSSProperties, ReactNode } from "react";

interface Props {
  /** 박스 소제목(.bt, 대문자 캡션) */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// 견적 문서(.qdoc) 내 섹션 박스: 옅은 배경 + 대문자 소제목 + 내용(주로 KeyValue 묶음).
// `.qdoc` 컨텍스트 안에서 사용한다(`.box`/`.bt` 스타일이 그 하위로 스코프됨).
export default function InfoBox({ title, children, className, style }: Props) {
  const cls = ["box", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style}>
      {title != null && <div className="bt">{title}</div>}
      {children}
    </div>
  );
}
