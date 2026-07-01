import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, won } from "@/lib/quote";
import type { Payment, PaymentKind, Quote, QuoteSummary } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, ModalFooter, PageHeader, Select, Table, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Plus, Wallet, Trash2, Check, Undo2 } from "lucide-react";
import RowMenu from "@/components/RowMenu";

const KIND_LABEL: Record<PaymentKind, string> = { deposit: "계약금", interim: "중도금", balance: "잔금" };

// 부록 A24 수주 전환 & 입금 관리 (계약금/중도금/잔금, 미수금 집계)
export default function Payments() {
  const toast = useToast();
  const [list, setList] = useState<Payment[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => store.payments.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  // 견적 → 계약금50/잔금50 스케줄 자동 생성
  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.", "warning");
    setBusy(true);
    try {
      const q = (await store.getQuote(pick)) as Quote;
      const grand = calcTotals(q).grand;
      const dep = Math.round(grand * 0.5);
      const base = { quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "", paid: false, created_at: "" };
      await store.payments.save({ id: "", kind: "deposit", amount: dep, due_date: "", ...base } as Payment);
      await store.payments.save({ id: "", kind: "balance", amount: grand - dep, due_date: "", ...base } as Payment);
      setCreating(false); setPick("");
      await load();
      toast("입금 스케줄을 생성했습니다.", "success");
    } finally { setBusy(false); }
  };

  const togglePaid = async (p: Payment) => {
    await store.payments.save({ ...p, paid: !p.paid, paid_at: !p.paid ? new Date().toISOString() : undefined });
    await load();
  };
  const update = async (p: Payment, patch: Partial<Payment>) => { await store.payments.save({ ...p, ...patch }); await load(); };
  const del = async (p: Payment) => { await store.payments.remove(p.id); await load(); };

  const total = list.reduce((s, p) => s + p.amount, 0);
  const paid = list.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const due = total - paid;
  const rate = total > 0 ? Math.round((paid / total) * 100) : 0;

  const columns: Column<Payment>[] = [
    { key: "quote_no", header: "견적", render: (p) => <Link className="link" to={`/quotes/${p.quote_id}`}>{p.quote_no}</Link> },
    { key: "customer", header: "고객" },
    { key: "kind", header: "구분", render: (p) => <Chip>{KIND_LABEL[p.kind]}</Chip> },
    { key: "amount", header: "금액", align: "right", render: (p) => won(p.amount) },
    { key: "due_date", header: "납기", render: (p) => <Input type="date" value={p.due_date} onChange={(e) => update(p, { due_date: e.target.value })} style={{ width: 150 }} /> },
    { key: "status", header: "상태", render: (p) => (p.paid ? <span className="badge accepted"><span className="dot" />수금완료</span> : <span className="badge sent"><span className="dot" />미수금</span>) },
    {
      key: "act",
      header: "관리",
      render: (p) => (
        <RowMenu actions={[
          p.paid
            ? { label: "입금확인 취소", icon: <Undo2 size={16} />, onClick: () => togglePaid(p) }
            : { label: "입금확인", icon: <Check size={16} />, onClick: () => togglePaid(p) },
          { label: "삭제", icon: <Trash2 size={16} />, danger: true, onClick: () => del(p) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="정산 / 입금" sub="계약금·중도금·잔금 스케줄과 미수금" action={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>입금 스케줄</Button>} />

      <div className="bento">
        <div className="tile feature col-2 row-2">
          <div className="k">총 계약액</div>
          <div className="push-bottom">
            <div className="v-lg">{won(total)}</div>
            <div className="bento-foot">수금률 {rate}% · 미수금 {won(due)}</div>
          </div>
        </div>
        <div className="tile">
          <div className="k">수금 완료</div>
          <div className="v push-bottom">{won(paid)}</div>
        </div>
        <div className="tile">
          <div className="k">미수금</div>
          <div className="v push-bottom">{won(due)}</div>
        </div>
        <div className="tile full">
          <Table
            columns={columns}
            rows={list}
            rowKey={(p) => p.id}
            empty={<EmptyState icon={<Wallet size={40} strokeWidth={1.5} />} title="입금 항목이 없습니다" />}
          />
        </div>
      </div>

      {creating && (
        <Modal title="입금 스케줄 생성" onClose={() => setCreating(false)}
          footer={<ModalFooter confirmLabel="생성 (계약금50/잔금50)" loading={busy} onConfirm={create} onCancel={() => setCreating(false)} />}>
          <Field label="수주(수락) 견적 선택">
            <Select value={pick} onChange={setPick} placeholder="선택…"
              options={quotes.map((q) => ({ value: q.id, label: `${q.quote_no} · ${q.customer} · ${won(q.grand)}` }))} />
          </Field>
        </Modal>
      )}
    </>
  );
}
