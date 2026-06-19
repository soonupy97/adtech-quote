import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDateTime } from "@/lib/quote";
import type { Attachment, Quote, QuoteComment } from "@/types";
import QuoteReadonly from "@/components/QuoteReadonly";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { useToast } from "@/components/Toast";
import { Check, Lock, X } from "lucide-react";

type State = "loading" | "notfound" | "ok";

export default function View() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const toast = useToast();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [state, setState] = useState<State>("loading");
  const [q, setQ] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [cName, setCName] = useState("");
  const [cBody, setCBody] = useState("");

  const loadThread = async (quoteId: string) => {
    try {
      setComments((await store.comments.list()).filter((c) => c.quote_id === quoteId).reverse());
      setAttachments((await store.attachments.list()).filter((a) => a.quote_id === quoteId));
    } catch { /* anon 권한 없을 수 있음 */ }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) { setState("notfound"); return; }
      const found = await store.getQuoteByToken(token);
      if (!alive) return;
      if (!found) { setState("notfound"); return; }
      setQ(found);
      setState("ok");
      await store.markViewed(token);
      loadThread(found.id);
    })();
    return () => { alive = false; };
  }, [token]);

  const postComment = async () => {
    if (!q || !cName.trim() || !cBody.trim()) return toast("성함과 내용을 입력하세요.");
    try {
      await store.comments.save({ id: "", quote_id: q.id, author: "customer", name: cName.trim(), body: cBody.trim(), created_at: "" });
      try { await store.notifications.save({ id: "", type: "comment", title: "고객 코멘트가 등록되었습니다", body: `${q.quote_no} · ${cName.trim()}`, quote_id: q.id, read: false, created_at: "" } as never); } catch { /* noop */ }
      setCBody("");
      await loadThread(q.id);
      toast("문의를 남겼습니다.");
    } catch { toast("등록에 실패했습니다."); }
  };

  if (state === "loading") return <div className="empty" style={{ paddingTop: 120 }}>불러오는 중…</div>;

  if (state === "notfound") {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 10 }}><Lock size={40} strokeWidth={1.5} /></div>
          <div className="ttl" style={{ fontSize: 18, fontWeight: 700 }}>견적을 찾을 수 없습니다</div>
          <div className="dim" style={{ marginTop: 8 }}>
            링크가 올바르지 않거나, 아직 발송되지 않은 견적입니다.<br />발송자에게 문의해 주세요.
          </div>
        </div>
      </div>
    );
  }

  const responded = q!.status === "accepted" || q!.status === "rejected";

  const respond = async (accept: boolean) => {
    if (busy) return;
    if (accept) {
      if (!name.trim()) return toast("성함을 입력해 주세요.");
      if (sigRef.current?.isEmpty()) return toast("서명을 해주세요.");
    } else {
      if (!name.trim()) return toast("성함을 입력해 주세요.");
    }
    setBusy(true);
    try {
      const sig = accept ? sigRef.current?.toDataURL() : undefined;
      const updated = await store.markResponse(token, accept, name.trim(), sig);
      if (updated) {
        setQ(updated);
        toast(accept ? "견적을 수락했습니다. 감사합니다!" : "견적을 거절하셨습니다.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main" style={{ paddingTop: 28 }}>
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <div className="chip blue">고객 열람용</div>
        <div className="spacer" />
        <button className="btn soft" onClick={() => window.print()}>PDF 저장</button>
      </div>

      {q!.status === "accepted" && (
        <div className="banner ok"><Check size={16} /> 이 견적을 수락하셨습니다 — {q!.customer_response?.name} · {fmtDateTime(q!.responded_at)}</div>
      )}
      {q!.status === "rejected" && (
        <div className="banner no"><X size={16} /> 이 견적을 거절하셨습니다 — {q!.customer_response?.name} · {fmtDateTime(q!.responded_at)}</div>
      )}

      <div className="card">
        <QuoteReadonly quote={q!} />
      </div>

      {attachments.length > 0 && (
        <div className="card">
          <div className="card-title">첨부 자료</div>
          <div className="gallery">{attachments.map((a) => <a className="thumb" key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} /></a>)}</div>
        </div>
      )}

      {/* 고객 문의/코멘트 (부록 A22) */}
      <div className="card no-print">
        <div className="card-title">문의 남기기</div>
        {comments.length > 0 && (
          <div className="thread" style={{ marginBottom: 14 }}>
            {comments.map((c) => (
              <div className={`comment ${c.author}`} key={c.id}>
                <div className="who">{c.author === "customer" ? `${c.name}(고객)` : "담당자"} · {fmtDateTime(c.created_at)}</div>
                {c.body}
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 6 }}>
          <input placeholder="성함" value={cName} onChange={(e) => setCName(e.target.value)} style={{ maxWidth: 120 }} />
          <input placeholder="질문이나 수정 요청을 남겨주세요" value={cBody} onChange={(e) => setCBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && postComment()} />
          <button className="btn soft" onClick={postComment}>전송</button>
        </div>
      </div>

      {!responded && (
        <div className="card no-print">
          <div className="card-title">견적 확인</div>
          <div className="card-sub">내용을 확인하신 후 수락 또는 거절해 주세요. 수락 시 성함과 서명이 필요합니다.</div>
          <label className="field" style={{ maxWidth: 320 }}>
            <span>성함</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
          </label>
          <div className="field">
            <span style={{ display: "block", fontSize: 13, color: "var(--text-2)", marginBottom: 6, fontWeight: 600 }}>서명</span>
            <SignaturePad ref={sigRef} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => sigRef.current?.clear()}>서명 지우기</button>
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn danger" disabled={busy} onClick={() => respond(false)}>거절</button>
            <div className="spacer" />
            <button className="btn primary lg" disabled={busy} onClick={() => respond(true)}><Check size={18} />수락하기</button>
          </div>
        </div>
      )}
    </div>
  );
}
