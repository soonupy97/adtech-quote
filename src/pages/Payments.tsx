import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, won } from "@/lib/quote";
import type { Payment, PaymentKind, Quote, QuoteSummary } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Plus, Wallet } from "lucide-react";

const KIND_LABEL: Record<PaymentKind, string> = { deposit: "계약금", interim: "중도금", balance: "잔금" };

// 부록 A24 수주 전환 & 입금 관리 (계약금/중도금/잔금, 미수금 집계)
export default function Payments() {
  const toast = useToast();
  const [list, setList] = useState<Payment[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");

  const load = () => store.payments.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  // 견적 → 계약금50/잔금50 스케줄 자동 생성
  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.");
    const q = (await store.getQuote(pick)) as Quote;
    const grand = calcTotals(q).grand;
    const dep = Math.round(grand * 0.5);
    const base = { quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "", paid: false, created_at: "" };
    await store.payments.save({ id: "", kind: "deposit", amount: dep, due_date: "", ...base } as Payment);
    await store.payments.save({ id: "", kind: "balance", amount: grand - dep, due_date: "", ...base } as Payment);
    setCreating(false); setPick("");
    await load();
    toast("입금 스케줄을 생성했습니다.");
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

  return (
    <>
      <div className="page-head">
        <div><h1>정산 / 입금</h1><div className="sub">계약금·중도금·잔금 스케줄과 미수금</div></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} />입금 스케줄</button>
      </div>

      <div className="grid cols-3">
        <div className="card stat"><div className="k">총 계약액</div><div className="v">{won(total)}</div></div>
        <div className="card stat"><div className="k">수금 완료</div><div className="v" style={{ color: "var(--success)" }}>{won(paid)}</div></div>
        <div className="card stat"><div className="k">미수금</div><div className="v" style={{ color: "var(--danger)" }}>{won(due)}</div></div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><div className="big"><Wallet size={40} strokeWidth={1.5} /></div><div className="ttl">입금 항목이 없습니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>견적</th><th>고객</th><th>구분</th><th className="amt">금액</th><th>납기</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="link" to={`/quotes/${p.quote_id}`}>{p.quote_no}</Link></td>
                    <td>{p.customer}</td>
                    <td><span className="chip">{KIND_LABEL[p.kind]}</span></td>
                    <td className="amt">{won(p.amount)}</td>
                    <td><input type="date" value={p.due_date} onChange={(e) => update(p, { due_date: e.target.value })} style={{ width: 150 }} /></td>
                    <td>{p.paid ? <span className="badge accepted"><span className="dot" />수금완료</span> : <span className="badge sent"><span className="dot" />미수금</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className={`btn sm ${p.paid ? "" : "soft"}`} onClick={() => togglePaid(p)}>{p.paid ? "취소" : "입금확인"}</button>
                        <button className="btn sm danger" onClick={() => del(p)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <Modal title="입금 스케줄 생성" onClose={() => setCreating(false)}
          footer={<><button className="btn primary" onClick={create}>생성 (계약금50/잔금50)</button><button className="btn" onClick={() => setCreating(false)}>취소</button></>}>
          <label className="field"><span>수주(수락) 견적 선택</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">선택…</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_no} · {q.customer} · {won(q.grand)}</option>)}
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}
