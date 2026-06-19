import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, fmtDate, won } from "@/lib/quote";
import type { Invoice, Quote, QuoteSummary } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Plus, Receipt } from "lucide-react";

const PROVIDER_LABEL: Record<Invoice["provider"], string> = { popbill: "팝빌", barobill: "바로빌", manual: "수기" };

// 부록 A24 세금계산서 발행 (팝빌/바로빌 연동 자리 — 프로토타입은 상태 관리)
export default function Invoices() {
  const toast = useToast();
  const [list, setList] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [provider, setProvider] = useState<Invoice["provider"]>("popbill");

  const load = () => store.invoices.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.");
    const q = (await store.getQuote(pick)) as Quote;
    const t = calcTotals(q);
    await store.invoices.save({
      id: "", quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "",
      supplyAmount: t.supply, vat: t.vat, total: t.grand, status: "draft", provider, created_at: "",
    });
    setCreating(false); setPick("");
    await load();
    toast("세금계산서 초안을 생성했습니다.");
  };

  const issue = async (inv: Invoice) => {
    await store.invoices.save({ ...inv, status: "issued", issued_at: new Date().toISOString() });
    await load();
    toast(`${PROVIDER_LABEL[inv.provider]}(으)로 발행 처리되었습니다.`);
  };
  const del = async (inv: Invoice) => { await store.invoices.remove(inv.id); await load(); };

  return (
    <>
      <div className="page-head">
        <div><h1>세금계산서</h1><div className="sub">수주 건의 전자세금계산서 발행 · {list.length}건</div></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} />계산서 생성</button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><div className="big"><Receipt size={40} strokeWidth={1.5} /></div><div className="ttl">발행 내역이 없습니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>견적</th><th>고객</th><th className="amt">공급가</th><th className="amt">부가세</th><th className="amt">합계</th><th>발행처</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link className="link" to={`/quotes/${inv.quote_id}`}>{inv.quote_no}</Link></td>
                    <td>{inv.customer}</td>
                    <td className="amt">{won(inv.supplyAmount)}</td>
                    <td className="amt">{won(inv.vat)}</td>
                    <td className="amt">{won(inv.total)}</td>
                    <td><span className="chip">{PROVIDER_LABEL[inv.provider]}</span></td>
                    <td>{inv.status === "issued" ? <span className="badge accepted"><span className="dot" />발행 {fmtDate(inv.issued_at)}</span> : <span className="badge draft"><span className="dot" />초안</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {inv.status === "draft" && <button className="btn sm soft" onClick={() => issue(inv)}>발행</button>}
                        <button className="btn sm danger" onClick={() => del(inv)}>삭제</button>
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
        <Modal title="세금계산서 생성" onClose={() => setCreating(false)}
          footer={<><button className="btn primary" onClick={create}>생성</button><button className="btn" onClick={() => setCreating(false)}>취소</button></>}>
          <label className="field"><span>수주(수락) 견적</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">선택…</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_no} · {q.customer} · {won(q.grand)}</option>)}
            </select>
          </label>
          <label className="field"><span>발행처</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value as Invoice["provider"])}>
              {Object.entries(PROVIDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="dim">실제 발행은 팝빌/바로빌 API 연동이 필요합니다(운영). 프로토타입은 상태만 기록합니다.</div>
        </Modal>
      )}
    </>
  );
}
