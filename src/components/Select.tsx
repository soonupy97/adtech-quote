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
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = "선택",
  emptyText = "선택할 항목 없음",
  disabled,
  className,
  style,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  // 옵션이 없으면 열어봐야 빈 패널뿐 → 트리거 자체를 비활성화
  const isEmpty = options.length === 0;
  const isDisabled = disabled || isEmpty;

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

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    btnRef.current?.focus();
  };

  const moveActive = (dir: 1 | -1) => {
    if (!options.length) return;
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) break;
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
      case " ":
        e.preventDefault();
        choose(active);
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
        aria-label={ariaLabel}
        onClick={() => !isDisabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value${selected ? "" : " placeholder"}`}>
          {selected ? selected.label : isEmpty ? emptyText : placeholder}
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
            {options.map((o, i) => (
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
          </div>,
          document.body
        )}
    </>
  );
}
