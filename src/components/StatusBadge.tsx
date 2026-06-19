import type { QuoteStatus } from "@/types";
import { STATUS_LABEL } from "@/lib/quote";

export default function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}
