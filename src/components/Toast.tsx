import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

// 일반적인 토스트 알럿 패턴: 우측 상단 스택 + 타입별 좌측 액센트·아이콘 + 닫기 버튼.
export type ToastType = "default" | "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

// toast("저장했습니다")        → 기본
// toast("삭제 실패", "error")  → 타입 지정
type ToastFn = (msg: string, type?: ToastType) => void;

const ToastCtx = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

// 타입별 아이콘 (default 는 아이콘 없음)
const ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    (msg, type = "default") => {
      const id = ++seq;
      setItems((prev) => [...prev, { id, msg, type }]);
      window.setTimeout(() => dismiss(id), 3000);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => {
          const Icon = t.type !== "default" ? ICON[t.type] : null;
          return (
            <div className="toast" data-type={t.type} key={t.id} role="status">
              {Icon && <Icon className="toast-ic" size={18} aria-hidden />}
              <span className="toast-msg">{t.msg}</span>
              <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="닫기">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
