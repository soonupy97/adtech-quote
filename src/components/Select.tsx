import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** 옵션이 하나도 없을 때 트리거에 표시할 문구(이 경우 자동으로 비활성화) */
  emptyText?: string;
  /** 목록에서 고르거나, 드롭다운 상단 입력란에 직접 입력해 새 값을 추가할 수 있게 함 */
  creatable?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

function optionText(o: SelectOption): string {
  return typeof o.label === "string" ? o.label : o.value;
}

// 이 개수 이상이면 일반 셀렉트에도 검색란을 노출(스크롤로 찾기 번거로운 긴 목록 대응)
const SEARCH_MIN = 8;

export default function Select({
  value,
  onChange,
  options,
  placeholder = "선택",
  emptyText = "선택할 항목 없음",
  creatable = false,
  disabled,
  className,
  style,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState(""); // 드롭다운 상단 검색/직접입력 텍스트
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hasScroll, setHasScroll] = useState(false);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const isEmpty = options.length === 0;
  const isDisabled = disabled || (isEmpty && !creatable);
  // creatable 이거나 옵션이 많으면 드롭다운 상단에 검색(직접입력) 란을 띄운다
  const searchable = creatable || (!creatable && options.length >= SEARCH_MIN);
  // 목록에 없는 값(커스텀)이라도 트리거엔 그 값을 그대로 표시
  const triggerLabel = selected ? selected.label : creatable && value ? value : null;

  const q = query.trim();
  const isTyping = open && q !== "" && searchable;
  const filtered = isTyping
    ? options.filter((o) => optionText(o).toLowerCase().includes(q.toLowerCase()))
    : options;
  const showCreate = creatable && q !== "" && !options.some((o) => o.value === q);
  const rowCount = filtered.length + (showCreate ? 1 : 0);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, bottom: r.bottom, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    setActive(options.findIndex((o) => o.value === value));
  }, [open, place, options, value]);

  // 목록이 실제로 넘칠 때만 스크롤바 자리(오른쪽 패딩)를 확보
  useLayoutEffect(() => {
    const el = listRef.current;
    setHasScroll(!!el && open && el.scrollHeight > el.clientHeight);
  }, [open, filtered.length, showCreate]);

  // 열 때 검색어를 비운다(포커스는 검색란의 autoFocus 로 처리)
  useEffect(() => {
    if (open && searchable) setQuery("");
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const choose = (i: number) => {
    if (i < 0 || i >= rowCount) return;
    if (i < filtered.length) {
      const o = filtered[i];
      if (!o || o.disabled) return;
      pick(o.value);
    } else {
      pick(q); // 직접 입력 추가
    }
  };

  const moveActive = (dir: 1 | -1) => {
    if (!rowCount) return;
    let i = active;
    for (let n = 0; n < rowCount; n++) {
      i = (i + dir + rowCount) % rowCount;
      if (i >= filtered.length || !filtered[i].disabled) break;
    }
    setActive(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive(-1);
        break;
      case "Enter":
        e.preventDefault();
        if (active >= 0) choose(active);
        else if (showCreate) pick(q);
        else if (searchable && filtered.length) choose(0);
        break;
      case " ":
        // 검색란이 있는 경우 스페이스는 텍스트 입력이므로 선택 단축키에서 제외
        if (!searchable) {
          e.preventDefault();
          choose(active);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  // 패널이 화면 아래로 넘치면 위쪽으로 띄움
  const panelMax = 280;
  const openUp = rect ? window.innerHeight - rect.bottom < panelMax && rect.top > window.innerHeight - rect.bottom : false;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`select-trigger${open ? " open" : ""}${className ? ` ${className}` : ""}`}
        style={style}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !isDisabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value${triggerLabel ? "" : " placeholder"}`}>
          {triggerLabel ? triggerLabel : isEmpty && !creatable ? emptyText : placeholder}
        </span>
        <ChevronDown size={16} className="select-caret" />
      </button>
      {open && rect &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="select-panel"
            style={{
              position: "fixed",
              left: rect.left,
              width: rect.width,
              maxHeight: panelMax,
              ...(openUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
            }}
          >
            {searchable && (
              <div className="select-search">
                <input
                  type="text"
                  value={query}
                  placeholder={creatable ? "검색 또는 직접 입력…" : "검색…"}
                  aria-label={creatable ? "검색 또는 직접 입력" : "검색"}
                  autoComplete="off"
                  autoFocus
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(-1);
                  }}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}
            <div ref={listRef} className={`select-list${hasScroll ? " has-scroll" : ""}`}>
              {filtered.map((o, i) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  className={`select-option${o.value === value ? " selected" : ""}${i === active ? " active" : ""}${o.disabled ? " disabled" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(i);
                  }}
                >
                  <span className="select-option-label">{o.label}</span>
                  {o.value === value && <Check size={14} className="select-option-check" />}
                </div>
              ))}
              {showCreate && (
                <div
                  role="option"
                  aria-selected={false}
                  className={`select-option select-create${active === filtered.length ? " active" : ""}`}
                  onMouseEnter={() => setActive(filtered.length)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(q);
                  }}
                >
                  <span className="select-option-label">＋ “{q}” 추가</span>
                </div>
              )}
              {searchable && filtered.length === 0 && !showCreate && (
                <div className="select-option disabled">
                  <span className="select-option-label">검색 결과 없음</span>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
