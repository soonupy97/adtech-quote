import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, fmtDate, won } from "@/lib/quote";
import type { Contract, ContractParty, Quote, QuoteSummary } from "@/types";
import Modal from "@/components/Modal";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { useToast } from "@/components/Toast";
import { Plus, FileSignature, Check } from "lucide-react";

// 부록 A23 전자계약 전환 + 다중 서명자
export default function Contracts() {
  const toast = useToast();
  const [list, setList] = useState<Contract[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [signing, setSigning] = useState<{ c: Contract; idx: number } | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);

  const load = () => store.contracts.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.");
    const q = (await store.getQuote(pick)) as Quote;
    const settings = await store.getSettings();
    const parties: ContractParty[] = [
      { role: "갑", name: q.supplier?.name || settings.supplier.name || "공급자" },
      { role: "을", name: q.customer?.name || "고객" },
    ];
    await store.contracts.save({
      id: "", quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "",
      amount: calcTotals(q).grand,
      terms: settings.terms?.standard || "표준 계약 조건에 따른다.",
      parties, status: "draft", created_at: "",
    });
    await store.activities.save({ id: "", actor: "직원", action: "전자계약 생성", target_type: "contract", target_id: q.id, created_at: "" } as never);
    setCreating(false); setPick("");
    await load();
    toast("계약서를 생성했습니다.");
  };

  const doSign = async () => {
    if (!signing) return;
    if (sigRef.current?.isEmpty()) return toast("서명을 해주세요.");
    const c = { ...signing.c, parties: signing.c.parties.map((p) => ({ ...p })) };
    c.parties[signing.idx] = {
      ...c.parties[signing.idx],
      signature: sigRef.current!.toDataURL(),
      signed_at: new Date().toISOString(),
    };
    if (c.parties.every((p) => p.signature)) c.status = "signed";
    await store.contracts.save(c);
    setSigning(null);
    await load();
    toast("서명이 완료되었습니다.");
  };

  const del = async (c: Contract) => {
    if (!confirm(`${c.quote_no} 계약을 삭제할까요?`)) return;
    await store.contracts.remove(c.id);
    await load();
  };

  return (
    <>
      <div className="page-head">
        <div><h1>전자계약</h1><div className="sub">수락된 견적을 계약서로 전환 · {list.length}건</div></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} />계약 생성</button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><div className="big"><FileSignature size={40} strokeWidth={1.5} /></div><div className="ttl">계약이 없습니다</div><div>수락된 견적에서 계약서를 만들 수 있습니다.</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>견적번호</th><th>고객</th><th className="amt">계약금액</th><th>서명</th><th>상태</th><th>생성일</th><th></th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="link" to={`/quotes/${c.quote_id}`}>{c.quote_no}</Link></td>
                    <td>{c.customer}</td>
                    <td className="amt">{won(c.amount)}</td>
                    <td>
                      {c.parties.map((p) => (
                        <span key={p.role} className={`chip ${p.signature ? "blue" : ""}`} style={{ marginRight: 4 }}>
                          {p.role} {p.signature ? <Check size={14} /> : "…"}
                        </span>
                      ))}
                    </td>
                    <td>{c.status === "signed" ? <span className="badge accepted"><span className="dot" />체결</span> : <span className="badge draft"><span className="dot" />작성중</span>}</td>
                    <td className="dim">{fmtDate(c.created_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {c.parties.map((p, i) => !p.signature && (
                          <button key={i} className="btn sm soft" onClick={() => setSigning({ c, idx: i })}>{p.role} 서명</button>
                        ))}
                        <button className="btn sm danger" onClick={() => del(c)}>삭제</button>
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
        <Modal title="계약 생성" onClose={() => setCreating(false)}
          footer={<><button className="btn primary" onClick={create}>생성</button><button className="btn" onClick={() => setCreating(false)}>취소</button></>}>
          <label className="field"><span>수락된 견적 선택</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">선택…</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_no} · {q.customer} · {won(q.grand)}</option>)}
            </select>
          </label>
          {quotes.length === 0 && <div className="dim">수락된 견적이 없습니다. 고객 수락 후 계약을 생성하세요.</div>}
        </Modal>
      )}

      {signing && (
        <Modal title={`${signing.c.parties[signing.idx].role} (${signing.c.parties[signing.idx].name}) 서명`} onClose={() => setSigning(null)}
          footer={<><button className="btn primary" onClick={doSign}>서명 완료</button><button className="btn" onClick={() => sigRef.current?.clear()}>지우기</button><button className="btn" onClick={() => setSigning(null)}>취소</button></>}>
          <SignaturePad ref={sigRef} />
        </Modal>
      )}
    </>
  );
}
