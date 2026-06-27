import type { QuoteStatus } from "@/types";

// 표시용 단순화: 데이터는 5단계(작성·발송·열람·수락·거절)를 그대로 유지하되,
// 운영자 화면 뱃지에선 4개로 묶어 노출한다 — 열람→발송 통합, 수락→수주, 거절→실주.
// 정밀 이력(열람 시각 등)은 견적 목록의 '발송/열람' 컬럼과 상세 타임라인에서 확인한다.
const DISPLAY: Record<QuoteStatus, { label: string; cls: string }> = {
  draft: { label: "작성중", cls: "draft" },
  sent: { label: "발송", cls: "sent" },
  viewed: { label: "발송", cls: "sent" },
  accepted: { label: "수주", cls: "accepted" },
  rejected: { label: "실주", cls: "rejected" },
};

export default function StatusBadge({ status }: { status: QuoteStatus }) {
  const d = DISPLAY[status] ?? DISPLAY.draft;
  return (
    <span className={`badge ${d.cls}`}>
      <span className="dot" />
      {d.label}
    </span>
  );
}
