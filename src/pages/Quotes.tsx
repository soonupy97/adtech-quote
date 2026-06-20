import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, STATUS_LABEL, won } from "@/lib/quote";
import type { QuoteStatus, QuoteSummary } from "@/types";
import { Button, EmptyState, Input, Modal, StatusBadge, Table, type Column } from "@/components/ui";
import SendActions from "@/components/SendActions";
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
  const [linkItem, setLinkItem] = useState<QuoteSummary | null>(null);

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
    setLinkItem(list.find((x) => x.id === id) || null);
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

  const columns: Column<QuoteSummary>[] = [
    { key: "quote_no", header: "견적번호", render: (it) => <Link className="link" to={`/quotes/${it.id}`}>{it.quote_no}</Link> },
    { key: "customer", header: "고객", render: (it) => it.customer || "-" },
    { key: "title", header: "대표품목", className: "dim", render: (it) => it.title },
    { key: "grand", header: "총액", align: "right", render: (it) => won(it.grand) },
    { key: "status", header: "상태", render: (it) => <StatusBadge status={it.status} /> },
    { key: "sent_at", header: "발송", className: "dim", render: (it) => fmtDate(it.sent_at) },
    { key: "first_viewed_at", header: "열람", className: "dim", render: (it) => fmtDate(it.first_viewed_at) },
    {
      key: "act",
      header: "관리",
      render: (it) => (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" variant="secondary" title="링크 발송" icon={<Link2 size={15} />} onClick={() => send(it.id)} />
          <Button size="sm" title="편집" onClick={() => navigate(`/editor/${it.id}`)}>편집</Button>
          <Button size="sm" title="복제" onClick={() => dup(it.id)}>복제</Button>
          <Button size="sm" variant="danger" title="삭제" onClick={() => del(it.id, it.quote_no)}>삭제</Button>
        </div>
      ),
    },
  ];

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
          <Input
            placeholder="견적번호·고객명 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <div className="spacer" />
          <div className="row" style={{ gap: 8 }}>
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? "primary" : "secondary"}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? "전체" : STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>

        <Table
          columns={columns}
          rows={filtered}
          rowKey={(it) => it.id}
          empty={<EmptyState icon={<Search size={40} strokeWidth={1.5} />} title="견적이 없습니다" />}
        />
      </div>

      {link && (
        <Modal
          title="고객 발송 링크"
          onClose={() => setLink(null)}
          footer={
            <>
              <Button variant="primary" onClick={copyLink}>링크 복사</Button>
              <a className="btn secondary" href={link} target="_blank" rel="noreferrer">미리보기</a>
              <div className="spacer" />
              <Button onClick={() => setLink(null)}>닫기</Button>
            </>
          }
        >
          <div className="dim" style={{ marginBottom: 12 }}>
            이 링크를 카카오톡·문자로 고객에게 전달하세요. 고객은 로그인 없이 열람·수락할 수 있습니다.
          </div>
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
            <SendActions url={link} tel={linkItem?.customer_tel} customer={linkItem?.customer} quoteNo={linkItem?.quote_no} />
          </div>
        </Modal>
      )}
    </>
  );
}
