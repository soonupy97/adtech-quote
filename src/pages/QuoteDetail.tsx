import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, fmtDate, fmtDateTime, STATUS_LABEL, won } from "@/lib/quote";
import { isExpired } from "@/lib/automation";
import { simulateSend } from "@/lib/integrations";
import type {
  Activity,
  Attachment,
  Contract,
  ContractParty,
  Invoice,
  Payment,
  Quote,
  QuoteComment,
  QuoteVersion,
} from "@/types";
import StatusBadge from "@/components/StatusBadge";
import QuoteReadonly from "@/components/QuoteReadonly";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Check, FileSignature, Link2, Receipt, Wallet, Wrench, X } from "lucide-react";

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState<Quote | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reply, setReply] = useState("");

  const load = async () => {
    if (!id) return;
    const found = await store.getQuote(id);
    setQ(found);
    setVersions((await store.versions.list()).filter((v) => v.quote_id === id));
    setComments((await store.comments.list()).filter((c) => c.quote_id === id).reverse());
    setAttachments((await store.attachments.list()).filter((a) => a.quote_id === id));
    setActivities((await store.activities.list()).filter((a) => a.target_id === id));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!q) return <div className="empty" style={{ paddingTop: 80 }}>불러오는 중…</div>;
  const totals = calcTotals(q);
  const expired = isExpired(q);

  const send = async () => { const { url } = await store.markSent(q.id); setLink(url); await load(); toast("발송 처리되었습니다."); };
  const dup = async () => { const copy = await store.duplicateQuote(q.id); toast("복제했습니다."); navigate(`/editor/${copy.id}`); };
  const customerView = () => window.open(store.shareUrl(q.public_token), "_blank");

  // 전환 (부록 A23/A24)
  const toContract = async () => {
    const s = await store.getSettings();
    const parties: ContractParty[] = [
      { role: "갑", name: q.supplier?.name || s.supplier.name || "공급자" },
      { role: "을", name: q.customer?.name || "고객" },
    ];
    await store.contracts.save({ id: "", quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "", amount: totals.grand, terms: s.terms?.standard || "", parties, status: "draft", created_at: "" } as Contract);
    toast("계약서를 생성했습니다."); navigate("/contracts");
  };
  const toWorkOrder = async () => {
    await store.workorders.save({ id: "", quote_id: q.id, quote_no: q.quote_no, site: q.site, items: q.items.map((it) => ({ type: it.type, spec: `${it.w || "-"}×${it.h || "-"}m`, qty: it.qty })), constructions: q.constructions.filter((c) => c.checked).map((c) => c.name), schedule: { installDate: "" }, crew: "", status: "ready", created_at: "" });
    toast("작업지시서를 생성했습니다."); navigate("/workorders");
  };
  const toInvoice = async () => {
    await store.invoices.save({ id: "", quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "", supplyAmount: totals.supply, vat: totals.vat, total: totals.grand, status: "draft", provider: "popbill", created_at: "" } as Invoice);
    toast("세금계산서 초안을 생성했습니다."); navigate("/invoices");
  };
  const toPayments = async () => {
    const dep = Math.round(totals.grand * 0.5);
    const base = { quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "", paid: false, created_at: "" };
    await store.payments.save({ id: "", kind: "deposit", amount: dep, due_date: "", ...base } as Payment);
    await store.payments.save({ id: "", kind: "balance", amount: totals.grand - dep, due_date: "", ...base } as Payment);
    toast("입금 스케줄을 생성했습니다."); navigate("/payments");
  };

  const restore = async (v: QuoteVersion) => {
    if (!confirm(`버전 ${v.version} 으로 복원할까요?`)) return;
    await store.saveQuote({ ...v.snapshot, id: q.id });
    await load();
    toast(`버전 ${v.version} 복원 완료`);
  };

  const addReply = async () => {
    if (!reply.trim()) return;
    await store.comments.save({ id: "", quote_id: q.id, author: "staff", name: "담당자", body: reply.trim(), created_at: "" });
    setReply("");
    await load();
  };

  const events = [...(q.events || [])].reverse();

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h1>{q.quote_no}</h1>
            <StatusBadge status={q.status} />
            {expired && <span className="badge rejected"><span className="dot" />만료</span>}
          </div>
          <div className="sub">{q.customer?.name || "고객 미지정"} · 총 {won(totals.grand)}</div>
        </div>
        <div className="spacer" />
        <div className="row" style={{ gap: 6 }}>
          <button className="btn soft" onClick={send}><Link2 size={16} />발송 링크</button>
          <button className="btn" onClick={() => navigate(`/editor/${q.id}`)}>편집</button>
          <button className="btn" onClick={dup}>복제</button>
          <button className="btn" onClick={customerView}>고객화면</button>
          <button className="btn" onClick={() => window.print()}>PDF</button>
        </div>
      </div>

      {q.status === "accepted" && <div className="banner ok"><Check size={16} /> 고객이 수락했습니다 — {q.customer_response?.name} · {fmtDateTime(q.responded_at)}</div>}
      {q.status === "rejected" && <div className="banner no"><X size={16} /> 고객이 거절했습니다 — {q.customer_response?.name} · {fmtDateTime(q.responded_at)}</div>}

      {/* 전환 액션 (수락 시) — 네이비 스토리 블록 */}
      {q.status === "accepted" && (
        <div className="color-block navy no-print">
          <div className="eyebrow" style={{ color: "rgba(242,242,240,0.6)" }}>수주 전환 · SHIP IT</div>
          <div className="display" style={{ marginTop: 8, marginBottom: 18 }}>
            수주를 다음 단계로.
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn light" onClick={toContract}><FileSignature size={16} />전자계약 생성</button>
            <button className="btn ghost-inverse" onClick={toWorkOrder}><Wrench size={16} />작업지시서</button>
            <button className="btn ghost-inverse" onClick={toPayments}><Wallet size={16} />입금 스케줄</button>
            <button className="btn ghost-inverse" onClick={toInvoice}><Receipt size={16} />세금계산서</button>
          </div>
        </div>
      )}

      <div className="grid cols-2 no-print">
        <div className="card">
          <div className="card-title">진행 상태</div>
          {events.length === 0 ? <div className="dim">기록 없음</div> : (
            <div className="timeline">
              {events.map((e, i) => (
                <div className="ev" key={i}>
                  <span className="pin" />
                  <div className="body">
                    <div className="t">{STATUS_LABEL[e.type] || e.type}{e.meta && (e.meta as { name?: string }).name ? ` · ${(e.meta as { name?: string }).name}` : ""}</div>
                    <div className="d">{fmtDateTime(e.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">요약</div>
          <div className="qdoc">
            <div className="kv"><span className="k">고객</span><span>{q.customer?.name || "-"}</span></div>
            <div className="kv"><span className="k">연락처</span><span>{q.customer?.tel || "-"}</span></div>
            <div className="kv"><span className="k">총액</span><span>{won(totals.grand)}</span></div>
            <div className="kv"><span className="k">작성일</span><span>{fmtDate(q.created_at)}</span></div>
            <div className="kv"><span className="k">발송일</span><span>{fmtDate(q.sent_at)}</span></div>
            <div className="kv"><span className="k">최초열람</span><span>{fmtDate(q.first_viewed_at)}</span></div>
          </div>
          {q.signature && (
            <div style={{ marginTop: 16 }}>
              <div className="card-sub" style={{ margin: 0 }}>고객 서명</div>
              <img src={q.signature} alt="서명" style={{ maxWidth: 240, border: "1px solid var(--line)", borderRadius: 12, marginTop: 8, background: "#fff" }} />
            </div>
          )}
          <div className="row wrap no-print" style={{ marginTop: 14, gap: 6 }}>
            <span className="dim">재발송:</span>
            <button className="btn sm" onClick={() => toast(simulateSend("kakao", q.customer.tel || "고객", store.shareUrl(q.public_token)))}>카카오</button>
            <button className="btn sm" onClick={() => toast(simulateSend("sms", q.customer.tel || "고객", store.shareUrl(q.public_token)))}>문자</button>
          </div>
        </div>
      </div>

      {/* 첨부 갤러리 */}
      {attachments.length > 0 && (
        <div className="card no-print">
          <div className="card-title">첨부</div>
          <div className="gallery">{attachments.map((a) => <div className="thumb" key={a.id}><img src={a.url} alt={a.name} /></div>)}</div>
        </div>
      )}

      {/* 고객 코멘트/재협상 (부록 A22) */}
      <div className="card no-print">
        <div className="card-title">고객 코멘트 / 재협상</div>
        {comments.length === 0 ? <div className="dim">코멘트 없음</div> : (
          <div className="thread" style={{ marginBottom: 14 }}>
            {comments.map((c) => (
              <div className={`comment ${c.author}`} key={c.id}>
                <div className="who">{c.author === "customer" ? `고객 · ${c.name}` : "담당자"} · {fmtDateTime(c.created_at)}</div>
                {c.body}
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 6 }}>
          <input placeholder="고객에게 회신…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addReply()} />
          <button className="btn soft" onClick={addReply}>회신</button>
        </div>
      </div>

      {/* 버전 관리 (부록 A19) */}
      {versions.length > 0 && (
        <div className="card no-print">
          <div className="card-title">버전 히스토리</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>버전</th><th>저장 시각</th><th className="amt">총액</th><th></th></tr></thead>
              <tbody>
                {versions.slice().reverse().map((v) => (
                  <tr key={v.id}>
                    <td>v{v.version}</td>
                    <td className="dim">{fmtDateTime(v.created_at)}</td>
                    <td className="amt">{won(calcTotals(v.snapshot).grand)}</td>
                    <td><button className="btn sm" onClick={() => restore(v)}>복원</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 활동 로그 */}
      {activities.length > 0 && (
        <div className="card no-print">
          <div className="card-title">이 견적의 활동</div>
          <div className="timeline">
            {activities.map((a) => (
              <div className="ev" key={a.id}><span className="pin" /><div className="body"><div className="t">{a.action}</div><div className="d">{a.actor} · {fmtDateTime(a.created_at)}</div></div></div>
            ))}
          </div>
        </div>
      )}

      <div className="card"><QuoteReadonly quote={q} /></div>

      {link && (
        <Modal title="고객 발송 링크" onClose={() => setLink(null)}
          footer={<><button className="btn primary" onClick={() => { navigator.clipboard?.writeText(link); toast("복사했습니다."); }}>링크 복사</button><a className="btn soft" href={link} target="_blank" rel="noreferrer">미리보기</a><div className="spacer" /><button className="btn" onClick={() => setLink(null)}>닫기</button></>}>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </Modal>
      )}
    </>
  );
}
