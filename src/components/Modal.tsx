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
    <div className="modal-back" onClick={onClose}>
      <div className={`modal${wide ? " wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <div className="modal-title">{title}</div>
          <div className="spacer" />
          <button className="btn sm" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        {children}
        {footer && (
          <div className="row" style={{ marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
