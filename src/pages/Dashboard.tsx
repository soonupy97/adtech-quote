import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { Auth } from "@/lib/auth";
import { fmtDate, won } from "@/lib/quote";
import { isExpired, reminderFor } from "@/lib/automation";
import type { QuoteStatus, QuoteSummary, Stats } from "@/types";
import { EmptyState, StatusBadge, Table, type Column } from "@/components/ui";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Send,
  TrendingUp,
  Wallet,
} from "lucide-react";

const DIST: { key: QuoteStatus; label: string; color: string }[] = [
  { key: "draft", label: "작성", color: "var(--st-draft)" },
  { key: "sent", label: "발송", color: "var(--st-sent)" },
  { key: "viewed", label: "열람", color: "var(--st-viewed)" },
  { key: "accepted", label: "수락", color: "var(--st-accepted)" },
  { key: "rejected", label: "거절", color: "var(--st-rejected)" },
];

// 시간대별 인사말
function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 6) return "늦은 시간까지 고생이 많으세요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "안녕하세요";
  return "좋은 저녁이에요";
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<QuoteSummary[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; quote_no: string; customer: string; msg: string }[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    Auth.current().then((s) => setName(s?.name || ""));
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
  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const recentColumns: Column<QuoteSummary>[] = [
    { key: "quote_no", header: "견적번호", render: (q) => <Link className="link" to={`/quotes/${q.id}`}>{q.quote_no}</Link> },
    { key: "customer", header: "고객", render: (q) => q.customer || "-" },
    { key: "grand", header: "총액", align: "right", render: (q) => won(q.grand) },
    { key: "status", header: "상태", render: (q) => <StatusBadge status={q.status} /> },
    { key: "created_at", header: "작성일", render: (q) => fmtDate(q.created_at) },
  ];

  return (
    <>
      {/* 인사 헤더 */}
      <div className="dash-head">
        <div>
          <div className="dash-greet">{greetingFor(today)}{name ? `, ${name}님` : ""} 👋</div>
          <div className="dash-date">{dateStr}</div>
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
          {/* KPI */}
          <div className="bento cols-4">
            <div className="tile feature">
              <div className="kpi-top">
                <div className="k">이번달 견적</div>
                <span className="kpi-ic"><FileText size={16} /></span>
              </div>
              <div className="v push-bottom">{stats.monthCount}건</div>
              <div className="sub">{won(stats.monthAmt)}</div>
            </div>
            <div className="tile">
              <div className="kpi-top">
                <div className="k">진행중 (발송·열람)</div>
                <span className="kpi-ic"><Send size={16} /></span>
              </div>
              <div className="v push-bottom">{stats.byStatus.sent + stats.byStatus.viewed}건</div>
              <div className="sub">대기금액 {won(stats.pipelineAmt)}</div>
            </div>
            <div className="tile">
              <div className="kpi-top">
                <div className="k">수주</div>
                <span className="kpi-ic"><CheckCircle2 size={16} /></span>
              </div>
              <div className="v push-bottom">{stats.accepted}건</div>
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

          {/* 파이프라인 현황 (스테이지 + 분포 통합) */}
          <div className="card">
            <div className="card-title">파이프라인 현황</div>
            <div className="pipeline">
              {DIST.map((d) => (
                <div className="stage" key={d.key}>
                  <div className="n" style={{ color: d.color }}>{stats.byStatus[d.key]}</div>
                  <div className="l">{d.label}</div>
                </div>
              ))}
            </div>
            <div className="distbar" style={{ marginTop: 20 }}>
              {DIST.map((d) =>
                stats.byStatus[d.key] > 0 ? (
                  <span key={d.key} style={{ width: `${(stats.byStatus[d.key] / total) * 100}%`, background: d.color }} />
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

          {/* 2단: 최근 견적 | 후속조치 + 빠른작업 */}
          <div className="dash-grid">
            <div className="card">
              <div className="row">
                <div className="card-title" style={{ marginBottom: 0 }}>최근 견적</div>
                <div className="spacer" />
                <Link className="chip blue" to="/quotes">전체 보기 →</Link>
              </div>
              <Table columns={recentColumns} rows={recent} rowKey={(q) => q.id} style={{ marginTop: 16 }} />
            </div>

            <div className="dash-side">
              <div className="card">
                <div className="card-title">
                  <Clock size={16} /> 후속 조치 필요{alerts.length > 0 ? ` (${alerts.length})` : ""}
                </div>
                {alerts.length === 0 ? (
                  <div className="dash-clear">
                    <CheckCircle2 size={18} /> 처리할 항목이 없습니다
                  </div>
                ) : (
                  alerts.map((a) => (
                    <Link to={`/quotes/${a.id}`} className="banner info dash-alert" key={a.id}>
                      <strong>{a.quote_no}</strong> · {a.customer}
                      <div className="dash-alert-msg">{a.msg}</div>
                    </Link>
                  ))
                )}
              </div>

              <div className="card">
                <div className="card-title">빠른 작업</div>
                <div className="quick-actions">
                  <Link className="quick-action" to="/editor">
                    <span className="qa-ic"><Plus size={16} /></span> 새 견적
                  </Link>
                  <Link className="quick-action" to="/clients">
                    <span className="qa-ic"><Building2 size={16} /></span> 거래처
                  </Link>
                  <Link className="quick-action" to="/payments">
                    <span className="qa-ic"><Wallet size={16} /></span> 정산/입금
                  </Link>
                  <Link className="quick-action" to="/reports">
                    <span className="qa-ic"><TrendingUp size={16} /></span> 매출 리포트
                  </Link>
                </div>
                <Link className="dash-more" to="/quotes">
                  견적 전체 보기 <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
