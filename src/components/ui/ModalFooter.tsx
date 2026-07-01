import type { ReactNode } from "react";
import Button, { type ButtonVariant } from "./Button";

interface Props {
  /** 확인 버튼 라벨 (기본 "저장") */
  confirmLabel?: string;
  onConfirm: () => void;
  /** 확인 버튼 변형 (기본 primary) */
  confirmVariant?: ButtonVariant;
  /** 진행 중: 확인 버튼 스피너 + 취소 비활성화 */
  loading?: boolean;
  /** 취소 버튼 라벨 (기본 "취소") */
  cancelLabel?: string;
  onCancel: () => void;
  /** 확인·취소 사이에 들어갈 부가 버튼 */
  children?: ReactNode;
}

// 모달 표준 푸터: [확인(primary)] [부가] [취소(outline)].
// Modal 푸터는 CSS 에서 row-reverse 라 확인 버튼이 오른쪽 끝에 표시된다.
export default function ModalFooter({
  confirmLabel = "저장",
  onConfirm,
  confirmVariant = "primary",
  loading,
  cancelLabel = "취소",
  onCancel,
  children,
}: Props) {
  return (
    <>
      <Button variant={confirmVariant} loading={loading} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      {children}
      <Button variant="outline" disabled={loading} onClick={onCancel}>
        {cancelLabel}
      </Button>
    </>
  );
}
