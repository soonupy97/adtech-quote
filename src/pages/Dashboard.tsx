import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, timeAgo, won } from "@/lib/quote";
import type { AppNotification, NotiType, QuoteSummary, Stats } from "@/types";
import { CardHeader, EmptyState, PageHeader, Spinner, StatCard, StatusBadge, Table, type Column } from "@/components/ui";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  MessageSquare,
  Plus,
  Send,
  TimerReset,
  XCircle,
  type LucideIcon,
} from "lucide-react";

// 알림 종류별 아이콘(우측 레일 알림 카드)
const NOTI_ICON: Record<NotiType, LucideIcon> = {
  viewed: Eye,
  accepted: CheckCircle2,
  rejected: XCircle,
  comment: MessageSquare,
  expiring: TimerReset,
  reminder: Bell,
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [notis, setNotis] = useState<AppNotification[]>([]);

  useEffect(() => {
    store.stats().then(setStats);
    store.listQuotes().then(setQuotes);
    store.notifications.list().then(setNotis);
  }, []);

  const markRead = async (n: AppNotification) => {
    await store.notifications.save({ ...n, read: true });
    setNotis(await store.notifications.list());
  };
  const markAll = async () => {
    for (const n of notis.filter((x) => !x.read)) await store.notifications.save({ ...n, read: true });
    setNotis(await store.notifications.list());
  };

  if (!stats) return <Spinner label="불러오는 중…" style={{ paddingTop: 64 }} />;

  const unread = notis.filter((n) => !n.read).length;

  const total = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
  const empty = total === 0;
  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const recent = quotes.slice(0, 6);

  // 월별 매출 추이(최근 6개월, 수주 견적 grand 합) — 표준 대시보드 추이 밴드
  const trend: { key: string; label: string; amt: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    trend.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${d.getMonth() + 1}월`, amt: 0 });
  }
  for (const q of quotes) {
    if (q.status !== "accepted") continue;
    const m = trend.find((x) => x.key === (q.responded_at || q.created_at || "").slice(0, 7));
    if (m) m.amt += q.grand;
  }
  const maxAmt = Math.max(1, ...trend.map((m) => m.amt));

  const recentColumns: Column<QuoteSummary>[] = [
    { key: "quote_no", header: "견적번호", render: (q) => <Link className="link" to={`/quotes/${q.id}`}>{q.quote_no}</Link> },
    { key: "customer", header: "고객", render: (q) => q.customer || "-" },
    { key: "grand", header: "총액", align: "right", render: (q) => won(q.grand) },
    { key: "status", header: "상태", render: (q) => <StatusBadge status={q.status} /> },
    { key: "created_at", header: "작성일", render: (q) => fmtDate(q.created_at) },
  ];

  return (
    <>
      <PageHeader
        title="대시보드"
        sub={dateStr}
        action={<Link className="btn" data-variant="primary" data-size="sm" to="/editor"><Plus size={14} />새 견적 만들기</Link>}
      />

      {empty ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={40} strokeWidth={1.5} />}
            title="아직 견적이 없습니다"
            desc={<span style={{ marginBottom: 20 }}>첫 견적을 만들어 고객에게 보내보세요.</span>}
            action={<Link className="btn" data-variant="primary" to="/editor">첫 견적 만들기</Link>}
          />
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="bento cols-4">
            <StatCard
              feature
              label="이번달 견적"
              icon={<FileText size={16} />}
              value={`${stats.monthCount}건`}
              sub={won(stats.monthAmt)}
            />
            <StatCard
              label="진행중 (발송·열람)"
              icon={<Send size={16} />}
              value={`${stats.byStatus.sent + stats.byStatus.viewed}건`}
              sub={`대기금액 ${won(stats.pipelineAmt)}`}
            />
            <StatCard
              label="수주"
              icon={<CheckCircle2 size={16} />}
              value={`${stats.accepted}건`}
              sub={`발송 ${stats.sent}건 중`}
            />
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

          {/* 월별 매출 추이 — KPI 아래 전체폭 추이 밴드 */}
          <div className="card">
            <CardHeader
              title="월별 매출 추이"
              note="최근 6개월 · 수주 기준"
              action={<Link className="chip blue" to="/reports">매출 리포트 →</Link>}
            />
            <div className="barchart" style={{ marginTop: 16 }}>
              {trend.map((m) => (
                <div className="b" key={m.key}>
                  <div className="val">{m.amt ? `${Math.round(m.amt / 10000)}만` : ""}</div>
                  <div className="fill" style={{ height: `${(m.amt / maxAmt) * 100}%` }} />
                  <div className="lab">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 작업 영역: 최근 견적 메인 | 알림 우측 레일 */}
          <div className="dash-grid">
            {/* 최근 견적 */}
            <div className="card">
              <CardHeader
                title="최근 견적"
                action={<Link className="chip blue" to="/quotes">전체 보기 →</Link>}
              />
              <Table columns={recentColumns} rows={recent} rowKey={(q) => q.id} style={{ marginTop: 16 }} />
            </div>

            {/* 알림 우측 레일 (데스크톱에서 sticky) — 알림센터 미니뷰 */}
            <aside className="dash-side">
              <div className="card dash-noti">
                <div className="card-title">
                  <Bell size={16} /> 알림
                  {unread > 0 && <span className="followup-count">{unread}</span>}
                  <div className="spacer" />
                  {unread > 0 && (
                    <button className="btn" data-variant="ghost" data-size="sm" onClick={markAll} title="모두 읽음">
                      <Check size={14} /> 모두 읽음
                    </button>
                  )}
                </div>

                {notis.length === 0 ? (
                  <div className="dash-clear">
                    <span className="dash-clear-ic"><Bell size={22} /></span>
                    <div>
                      <div className="dash-clear-t">새 알림이 없습니다</div>
                      <div className="dash-clear-d">열람·수락·코멘트·만료 알림이 여기에 표시됩니다.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="dash-noti-list">
                      {notis.slice(0, 6).map((n) => {
                        const Ic = NOTI_ICON[n.type] ?? Bell;
                        return (
                          <Link
                            key={n.id}
                            to={n.quote_id ? `/quotes/${n.quote_id}` : "/notifications"}
                            className={`noti-row ${n.read ? "" : "unread"}`}
                            onClick={() => { if (!n.read) markRead(n); }}
                          >
                            <span className={`noti-ic t-${n.type}`}><Ic size={16} /></span>
                            <span className="noti-main">
                              <span className="noti-top">
                                <span className="t">{n.title}</span>
                                <span className="noti-time">{timeAgo(n.created_at)}</span>
                                {!n.read && <span className="noti-unread-dot" aria-hidden />}
                              </span>
                              <span className="b">{n.body}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    <Link className="dash-more" to="/notifications">
                      알림센터 전체 보기 <ArrowRight size={14} />
                    </Link>
                  </>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
