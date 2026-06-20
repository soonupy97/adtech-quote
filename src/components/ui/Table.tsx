import type { CSSProperties, ReactNode } from "react";

export interface Column<T> {
  /** 고유 키 (헤더 React key 로도 사용) */
  key: string;
  header?: ReactNode;
  /** 셀 렌더러. 없으면 행 객체의 [key] 값을 그대로 출력 */
  render?: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** 내용 줄바꿈 허용 (.table td 는 기본 nowrap) */
  wrap?: boolean;
  width?: number | string;
  /** td 에 추가할 클래스 */
  className?: string;
  /** th 에 추가할 클래스 */
  headClassName?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** 행이 없을 때 표시(보통 <EmptyState/>). 없으면 빈 표를 그린다 */
  empty?: ReactNode;
  onRowClick?: (row: T, index: number) => void;
  /** 좁은 화면 가로 스크롤 기준 폭 (.table min-width 오버라이드) */
  minWidth?: number | string;
  className?: string;
  style?: CSSProperties;
}

function cellStyle<T>(col: Column<T>): CSSProperties | undefined {
  const s: CSSProperties = {};
  if (col.align === "center") s.textAlign = "center";
  if (col.width != null) s.width = col.width;
  return Object.keys(s).length ? s : undefined;
}

function cellClass<T>(col: Column<T>): string | undefined {
  return [col.align === "right" && "amt", col.wrap && "wrap", col.className]
    .filter(Boolean)
    .join(" ") || undefined;
}

// 선언형 테이블: columns + rows 로 .table-wrap > table.table 마크업을 생성.
export default function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  minWidth,
  className,
  style,
}: Props<T>) {
  if (rows.length === 0 && empty != null) return <>{empty}</>;

  const tableCls = ["table", className].filter(Boolean).join(" ");
  const tableStyle = minWidth != null ? { ...style, minWidth } : style;

  return (
    <div className="table-wrap">
      <table className={tableCls} style={tableStyle}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={[c.align === "right" && "amt", c.headClassName].filter(Boolean).join(" ") || undefined}
                style={c.align === "center" ? { textAlign: "center" } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c)} style={cellStyle(c)}>
                  {c.render ? c.render(row, i) : (row as Record<string, ReactNode>)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
