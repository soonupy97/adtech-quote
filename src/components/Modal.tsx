import type { ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}

export default function Modal({ title, onClose, children, wide, footer }: Props) {
  return (
    <div
      className="modal-back"
      onClick={(e) => {
        // 패널 안에서 드래그(텍스트 선택 등) 후 백드롭에서 마우스를 떼면 click 타깃이
        // .modal-back 이 되어 의도치 않게 닫히는 문제 방지 — 정확히 백드롭을 클릭했을 때만 닫는다.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal${wide ? " wide" : ""}`}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <div className="spacer" />
          <button className="btn modal-close" data-variant="ghost" data-size="sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
