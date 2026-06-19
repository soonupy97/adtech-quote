import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, STATUS_LABEL, won } from "@/lib/quote";
import type { QuoteStatus, QuoteSummary } from "@/types";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Link2, Plus, Search } from "lucide-react";

const STATUSES: (QuoteStatus | "all")[] = ["all", "draft", "sent", "viewed", "accepted", "rejected"];

export default function Quotes() {
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState<QuoteSummary[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<QuoteStatus | "all">("all");
  const [link, setLink] = useState<string | null>(null);

  const load = () => store.listQuotes().then(setList);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((it) => {
      if (filter !== "all" && it.status !== filter) return false;
      if (!kw) return true;
      return (
        it.quote_no.toLowerCase().includes(kw) ||
        (it.customer || "").toLowerCase().includes(kw)
      );
    });
  }, [list, q, filter]);

  const send = async (id: string) => {
    const { url } = await store.markSent(id);
    setLink(url);
    await load();
    toast("발송 처리되었습니다. 링크를 전달하세요.");
  };

  const dup = async (id: string) => {
    const copy = await store.duplicateQuote(id);
    toast("견적을 복제했습니다.");
    navigate(`/editor/${copy.id}`);
  };

  const del = async (id: string, no: string) => {
    if (!confirm(`${no} 견적을 삭제할까요?`)) return;
    await store.removeQuote(id);
    await load();
    toast("삭제되었습니다.");
  };

  const copyLink = () => {
    if (link) navigator.clipboard?.writeText(link);
    toast("링크를 복사했습니다.");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>견적</h1>
          <div className="sub">전체 {list.length}건</div>
        </div>
        <div className="spacer" />
        <Link className="btn primary" to="/editor"><Plus size={16} />새 견적</Link>
      </div>

      <div className="card">
        <div className="row wrap" style={{ marginBottom: 16 }}>
          <input
            placeholder="견적번호·고객명 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <div className="spacer" />
          <div className="row" style={{ gap: 6 }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`btn sm ${filter === s ? "primary" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? "전체" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="big"><Search size={40} strokeWidth={1.5} /></div>
            <div className="ttl">견적이 없습니다</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>견적번호</th>
                  <th>고객</th>
                  <th>대표품목</th>
                  <th className="amt">총액</th>
                  <th>상태</th>
                  <th>발송</th>
                  <th>열람</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td><Link className="link" to={`/quotes/${it.id}`}>{it.quote_no}</Link></td>
                    <td>{it.customer || "-"}</td>
                    <td className="dim">{it.title}</td>
                    <td className="amt">{won(it.grand)}</td>
                    <td><StatusBadge status={it.status} /></td>
                    <td className="dim">{fmtDate(it.sent_at)}</td>
                    <td className="dim">{fmtDate(it.first_viewed_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn sm soft" title="링크 발송" onClick={() => send(it.id)}><Link2 size={15} /></button>
                        <button className="btn sm" title="편집" onClick={() => navigate(`/editor/${it.id}`)}>편집</button>
                        <button className="btn sm" title="복제" onClick={() => dup(it.id)}>복제</button>
                        <button className="btn sm danger" title="삭제" onClick={() => del(it.id, it.quote_no)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {link && (
        <Modal
          title="고객 발송 링크"
          onClose={() => setLink(null)}
          footer={
            <>
              <button className="btn primary" onClick={copyLink}>링크 복사</button>
              <a className="btn soft" href={link} target="_blank" rel="noreferrer">미리보기</a>
              <div className="spacer" />
              <button className="btn" onClick={() => setLink(null)}>닫기</button>
            </>
          }
        >
          <div className="dim" style={{ marginBottom: 10 }}>
            이 링크를 카카오톡·문자로 고객에게 전달하세요. 고객은 로그인 없이 열람·수락할 수 있습니다.
          </div>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </Modal>
      )}
    </>
  );
}
