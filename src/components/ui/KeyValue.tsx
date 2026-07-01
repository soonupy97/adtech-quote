import type { ReactNode } from "react";

interface Props {
  /** 라벨(좌측) */
  k: ReactNode;
  /** 값(우측) — 비어 있으면 "-" 로 표시 */
  children?: ReactNode;
}

// 견적 문서(.qdoc) 등에서 반복되는 key/value 한 줄. 값이 비면 "-".
// `.qdoc` 컨텍스트 안에서 사용한다(`.kv`/`.k` 스타일이 그 하위로 스코프됨).
export default function KeyValue({ k, children }: Props) {
  const empty = children == null || children === "" || children === false;
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span>{empty ? "-" : children}</span>
    </div>
  );
}
