import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, won } from "@/lib/quote";
import { isExpired, reminderFor } from "@/lib/automation";
import type { QuoteStatus, QuoteSummary, Stats } from "@/types";
import { EmptyState, StatusBadge, Table, type Column } from "@/components/ui";
import { Clock, FileText, Plus } from "lucide-react";

const DIST: { key: QuoteStatus; label: string; color: string }[] = [
  { key: "draft", label: "작성", color: "var(--st-draft)" },
  { key: "sent", label: "발송", color: "var(--st-sent)" },
  { key: "viewed", label: "열람", color: "var(--st-viewed)" },
  { key: "accepted", label: "수락", color: "var(--st-accepted)" },
  { key: "rejected", label: "거절", color: "var(--st-rejected)" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<QuoteSummary[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; quote_no: string; customer: string; msg: string }[]>([]);

  useEffect(() => {
    store.stats().then(setStats);
    store.listQuotes().then(async (l) => {
      setRecent(l.slice(0, 6));
      const open = l.filter((q) => q.status === "sent" || q.status === "viewed");
      const full = await Promise.all(open.map((q) => store.getQuote(q.id)));
      const out: { id: string; quote_no: string; customer: string; msg: string }[] = [];
      for (const q of full) {
        if (!q) continue;
        const s = l.find((x) => x.id === q.id)!;
        if (isExpired(q)) out.push({ id: q.id, quote_no: s.quote_no, customer: s.customer, msg: "유효기간 만료 — 재발송 필요" });
        else { const r = reminderFor(q); if (r) out.push({ id: q.id, quote_no: s.quote_no, customer: s.customer, msg: r }); }
      }
      setAlerts(out);
    });
  }, []);

  if (!stats) return <div className="empty" style={{ paddingTop: 64 }}>불러오는 중…</div>;

  const total = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
  const empty = total === 0;

  const recentColumns: Column<QuoteSummary>[] = [
    { key: "quote_no", header: "견적번호", render: (q) => <Link className="link" to={`/quotes/${q.id}`}>{q.quote_no}</Link> },
    { key: "customer", header: "고객", render: (q) => q.customer || "-" },
    { key: "grand", header: "총액", align: "right", render: (q) => won(q.grand) },
    { key: "status", header: "상태", render: (q) => <StatusBadge status={q.status} /> },
    { key: "created_at", header: "작성일", render: (q) => fmtDate(q.created_at) },
  ];

  return (
    <>
      <div className="color-block plain" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="eyebrow">대시보드 · DASHBOARD</div>
          <div className="display" style={{ marginTop: 12 }}>
            견적은 더 빠르게,<br />관리는 더 단순하게.
          </div>
        </div>
        <Link className="btn primary lg" to="/editor"><Plus size={18} />새 견적 만들기</Link>
      </div>

      {empty ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={40} strokeWidth={1.5} />}
            title="아직 견적이 없습니다"
            desc={<span style={{ marginBottom: 20 }}>첫 견적을 만들어 고객에게 보내보세요.</span>}
            action={<Link className="btn primary" to="/editor">첫 견적 만들기</Link>}
          />
        </div>
      ) : (
        <>
          <div className="bento cols-4">
            <div className="tile feature">
              <div className="k">이번달 견적</div>
              <div className="v">{stats.monthCount}건</div>
              <div className="sub">{won(stats.monthAmt)}</div>
            </div>
            <div className="tile">
              <div className="k">진행중 (발송·열람)</div>
              <div className="v">{stats.byStatus.sent + stats.byStatus.viewed}건</div>
              <div className="sub">대기금액 {won(stats.pipelineAmt)}</div>
            </div>
            <div className="tile">
              <div className="k">수주</div>
              <div className="v">{stats.accepted}건</div>
              <div className="sub">발송 {stats.sent}건 중</div>
            </div>
            <div className="tile" style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
              <div className="ring" style={{ ["--p" as string]: stats.winRate }}>
                <div className="inner">{stats.winRate}%</div>
              </div>
              <div>
                <div className="k">수주율</div>
                <div className="sub">수락 / 발송</div>
              </div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title"><Clock size={16} /> 후속 조치 필요 ({alerts.length})</div>
              {alerts.map((a) => (
                <div className="banner info" key={a.id} style={{ marginBottom: 8 }}>
                  <Link to={`/quotes/${a.id}`} style={{ fontWeight: 700 }}>{a.quote_no}</Link> · {a.customer} — {a.msg}
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">파이프라인</div>
            <div className="pipeline">
              {DIST.map((d) => (
                <div className="stage" key={d.key}>
                  <div className="n" style={{ color: d.color }}>{stats.byStatus[d.key]}</div>
                  <div className="l">{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">상태 분포</div>
            <div className="distbar">
              {DIST.map((d) =>
                stats.byStatus[d.key] > 0 ? (
                  <span
                    key={d.key}
                    style={{ width: `${(stats.byStatus[d.key] / total) * 100}%`, background: d.color }}
                  />
                ) : null,
              )}
            </div>
            <div className="legend">
              {DIST.map((d) => (
                <span className="it" key={d.key}>
                  <span className="sw" style={{ background: d.color }} />
                  {d.label} {stats.byStatus[d.key]}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row">
              <div className="card-title" style={{ marginBottom: 0 }}>최근 견적</div>
              <div className="spacer" />
              <Link className="chip blue" to="/quotes">전체 보기 →</Link>
            </div>
            <Table
              columns={recentColumns}
              rows={recent}
              rowKey={(q) => q.id}
              style={{ marginTop: 16 }}
            />
          </div>
        </>
      )}
    </>
  );
}
