import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, sampleQuote, won } from "@/lib/quote";
import type { QuoteStatus, QuoteSummary } from "@/types";
import { Button, EmptyState, Input, Modal, PageTitle, StatusBadge, Table, type Column } from "@/components/ui";
import CopyLinkField from "@/components/CopyLinkField";
import { useToast } from "@/components/Toast";
import { FileText, GripVertical, Link2, Plus, Search, Send, Trash2, Pencil, Copy } from "lucide-react";
import RowMenu from "@/components/RowMenu";

// 상태 추적(발송/열람/수락/거절)은 그대로 두고, 목록 필터만 3개로 단순화.
// "발송됨" = 작성중이 아닌 모든 견적(발송·열람·수락·거절)을 묶는다.
const FILTERS: { id: string; label: string; match: (s: QuoteStatus) => boolean }[] = [
  { id: "all", label: "전체", match: () => true },
  { id: "draft", label: "작성중", match: (s) => s === "draft" },
  { id: "sent", label: "발송됨", match: (s) => s !== "draft" },
];

// 칸반 보드 컬럼(지라식 자유 이동). 카드를 컬럼 사이로 끌어 상태를 바꾼다.
// 작성중→발송은 markSent(고객 링크 생성), 나머지는 운영자 수동 상태 변경(setStatus).
// 열람(viewed)은 발송 컬럼에 함께 묶어 표시한다.
const BOARD: { id: QuoteStatus; label: string; accent: string; has: (s: QuoteStatus) => boolean }[] = [
  { id: "draft", label: "작성중", accent: "var(--st-draft)", has: (s) => s === "draft" },
  { id: "sent", label: "발송", accent: "var(--st-sent)", has: (s) => s === "sent" || s === "viewed" },
  { id: "accepted", label: "수주", accent: "var(--st-accepted)", has: (s) => s === "accepted" },
  { id: "rejected", label: "실주", accent: "var(--st-rejected)", has: (s) => s === "rejected" },
];

export default function Quotes() {
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState<QuoteSummary[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [link, setLink] = useState<string | null>(null);
  const [linkItem, setLinkItem] = useState<QuoteSummary | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [over, setOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = () => store.listQuotes().then(setList);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const f = FILTERS.find((x) => x.id === filter) || FILTERS[0];
    return list.filter((it) => {
      if (!f.match(it.status)) return false;
      if (!kw) return true;
      return (
        it.quote_no.toLowerCase().includes(kw) ||
        (it.customer || "").toLowerCase().includes(kw)
      );
    });
  }, [list, q, filter]);

  // 보드는 상태별 컬럼이 곧 분류이므로 상태필터는 무시하고 검색어만 적용한다.
  const searched = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(
      (it) => it.quote_no.toLowerCase().includes(kw) || (it.customer || "").toLowerCase().includes(kw),
    );
  }, [list, q]);

  // 발송 링크 보기(이미 발송된 견적용): 상태 변경 없이 링크 모달만 연다.
  const send = async (id: string) => {
    const item = list.find((x) => x.id === id) || null;
    const { url } = await store.markSent(id);
    setLinkItem(item);
    setLink(url);
    await load();
    toast("발송 링크를 불러왔습니다.", "success");
  };

  // 발송 처리(수동): 상태를 발송으로 기록(발송일·이벤트 포함). 링크 모달은 띄우지 않는다.
  const setSent = async (id: string) => {
    const it = list.find((x) => x.id === id);
    await store.markSent(id);
    await load();
    toast(`'${it?.customer || it?.quote_no || "견적"}' 발송 처리했습니다.`, "success");
  };

  const dup = async (id: string) => {
    const copy = await store.duplicateQuote(id);
    toast("견적을 복제했습니다.", "success");
    navigate(`/editor/${copy.id}`);
  };

  const del = async (id: string, no: string) => {
    if (!confirm(`${no} 견적을 삭제할까요?`)) return;
    await store.removeQuote(id);
    await load();
    toast("삭제되었습니다.", "success");
  };

  // 칸반 드롭: 카드를 다른 컬럼에 놓으면 상태만 조용히 변경한다(링크 모달·발송 안내 없음).
  // 작성중→발송은 발송일·이벤트 기록이 필요하므로 markSent, 그 외는 setStatus.
  const dropTo = async (colId: QuoteStatus, id: string) => {
    setOver(null);
    const it = list.find((x) => x.id === id);
    const targetCol = BOARD.find((c) => c.id === colId);
    if (!it || !targetCol || targetCol.has(it.status)) return; // 이미 같은 컬럼이면 무시
    if (colId === "sent" && it.status === "draft") await store.markSent(id);
    else await store.setStatus(id, colId);
    await load();
    toast(`'${it.customer || it.quote_no}' → ${targetCol.label}`, "success");
  };

  // 빈 상태 온보딩: 현실적인 샘플 견적 1건 추가
  const addSample = async () => {
    setSeeding(true);
    try {
      await store.saveQuote(sampleQuote());
      await load();
      toast("샘플 견적서를 추가했습니다.", "success");
    } finally {
      setSeeding(false);
    }
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
        <RowMenu actions={[
          it.status === "draft"
            ? { label: "발송 처리", icon: <Send size={16} />, onClick: () => setSent(it.id) }
            : { label: "발송 링크 복사", icon: <Link2 size={16} />, onClick: () => send(it.id) },
          { label: "편집", icon: <Pencil size={16} />, onClick: () => navigate(`/editor/${it.id}`) },
          { label: "복제", icon: <Copy size={16} />, onClick: () => dup(it.id) },
          { label: "삭제", icon: <Trash2 size={16} />, danger: true, onClick: () => del(it.id, it.quote_no) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <PageTitle title="견적" sub={`전체 ${list.length}건`} />
        <Link className="btn" data-variant="primary" data-size="sm" to="/editor"><Plus size={14} />새 견적</Link>
      </div>

      <div className="tabs">
        <Button size="sm" variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>리스트</Button>
        <Button size="sm" variant={view === "board" ? "primary" : "secondary"} onClick={() => setView("board")}>보드</Button>
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
          {view === "list" && (
            <div className="row" style={{ gap: 8 }}>
              {FILTERS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filter === f.id ? "primary" : "secondary"}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {view === "list" ? (
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(it) => it.id}
            empty={
              list.length === 0 ? (
                <EmptyState
                  icon={<FileText size={40} strokeWidth={1.5} />}
                  title="아직 견적이 없습니다"
                  desc={<span style={{ display: "block", marginBottom: 16 }}>첫 견적을 만들거나, 샘플로 먼저 둘러보세요.</span>}
                  action={
                    <div className="row" style={{ gap: 8, justifyContent: "center" }}>
                      <Link className="btn" data-variant="primary" to="/editor"><Plus size={16} />첫 견적 만들기</Link>
                      <Button variant="secondary" loading={seeding} onClick={addSample}>샘플 견적서 추가</Button>
                    </div>
                  }
                />
              ) : (
                <EmptyState icon={<Search size={40} strokeWidth={1.5} />} title="검색 결과가 없습니다" />
              )
            }
          />
        ) : (
          <div className="kanban quote-board cols-4">
            {BOARD.map((col) => {
              const items = searched.filter((it) => col.has(it.status));
              const canDrop = dragId != null && !col.has(list.find((x) => x.id === dragId)?.status as QuoteStatus);
              return (
                <div
                  key={col.id}
                  className={`col ${over === col.id ? "drop" : ""} ${dragId && canDrop ? "droppable" : ""}`}
                  style={{ ["--col" as string]: col.accent }}
                  onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
                  onDragLeave={() => setOver((v) => (v === col.id ? null : v))}
                  onDrop={(e) => { e.preventDefault(); dropTo(col.id, e.dataTransfer.getData("id")); }}
                >
                  <h4>
                    <span className="col-title"><i className="dot" />{col.label}</span>
                    <span className="count">{items.length}</span>
                  </h4>
                  <div className="col-body">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className={`lead card-kb ${dragId === it.id ? "dragging" : ""}`}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("id", it.id); e.dataTransfer.effectAllowed = "move"; setDragId(it.id); }}
                        onDragEnd={() => { setDragId(null); setOver(null); }}
                        onClick={() => navigate(`/quotes/${it.id}`)}
                      >
                        <GripVertical className="grip" size={14} />
                        <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                          <span className="n">{it.customer || "고객 미정"}</span>
                          <StatusBadge status={it.status} />
                        </div>
                        <div className="m">{it.quote_no} · {it.title}</div>
                        <div className="m amount">{won(it.grand)}</div>
                      </div>
                    ))}
                    {items.length === 0 && <div className="col-empty">{dragId && canDrop ? "여기에 놓기" : "비어 있음"}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {view === "board" && (
        <div className="dim" style={{ marginTop: 8, fontSize: 12 }}>
          카드를 끌어 컬럼 사이로 옮기면 상태가 바뀝니다. <strong>작성중 → 발송</strong>은 고객 링크가 생성되고, 수주·실주는 전화·대면 응답을 수동 반영할 때 사용하세요. (고객이 링크에서 응답하면 자동으로도 갱신됩니다)
        </div>
      )}

      {link && (
        <Modal
          title="고객 발송 링크"
          onClose={() => setLink(null)}
          footer={
            <>
              <Button variant="primary" onClick={() => { navigator.clipboard?.writeText(link); toast("링크를 복사했습니다.", "success"); }}>링크 복사</Button>
              <a className="btn" href={link} target="_blank" rel="noreferrer">미리보기</a>
              <div className="spacer" />
              <Button variant="outline" onClick={() => setLink(null)}>닫기</Button>
            </>
          }
        >
          <div className="dim" style={{ marginBottom: 12 }}>
            이 링크를 카카오톡·문자로 고객에게 전달하세요.<br />고객은 로그인 없이 열람·수락할 수 있습니다.
          </div>
          <CopyLinkField url={link} customer={linkItem?.customer} quoteNo={linkItem?.quote_no} />
        </Modal>
      )}
    </>
  );
}
