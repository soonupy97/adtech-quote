import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export interface RowAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** 파괴적 동작(삭제 등) — 빨강 + 구분선 위로 분리 */
  danger?: boolean;
  /** 조건부 비표시(예: 이미 발행된 항목의 '발행') */
  hidden?: boolean;
}

/**
 * 테이블 행의 "관리" 셀용 ⋮(kebab) 드롭다운 메뉴.
 * - .table-wrap 의 overflow 클리핑을 피하려고 버튼 위치를 측정해 position:fixed 로 띄운다.
 * - 클릭 토글 + 바깥 클릭/스크롤/ESC 로 닫힘.
 */
export default function RowMenu({ actions, label = "관리" }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const visible = actions.filter((a) => !a.hidden);
  // 파괴적 동작을 아래로 모아 일반 동작 다음에 구분선과 함께 노출
  const normal = visible.filter((a) => !a.danger);
  const danger = visible.filter((a) => a.danger);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // 항목 높이 대략치로 아래 공간이 부족하면 위로 펼침(flip-up)
    const estH = visible.length * 40 + 16 + (normal.length && danger.length ? 13 : 0);
    const below = window.innerHeight - r.bottom;
    const openUp = below < estH + 8 && r.top > below;
    const top = openUp ? Math.max(8, r.top - estH - 4) : r.bottom + 4;
    setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // 캡처 단계 — 테이블 래퍼 등 어떤 조상이 스크롤돼도 닫는다
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const renderItem = (a: RowAction, i: number) => (
    <button
      key={i}
      role="menuitem"
      className={`row-menu-item${a.danger ? " danger" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(false);
        a.onClick();
      }}
    >
      {a.icon != null && <span className="ic">{a.icon}</span>}
      <span>{a.label}</span>
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn"
        data-size="sm"
        data-icon-only
        data-variant="ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreVertical size={16} />
      </button>
      {open && pos && (
        <div
          ref={popRef}
          className="row-menu-pop"
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {normal.map(renderItem)}
          {danger.length > 0 && normal.length > 0 && <div className="row-menu-sep" />}
          {danger.map((a, i) => renderItem(a, normal.length + i))}
        </div>
      )}
    </>
  );
}
