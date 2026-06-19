import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { won } from "@/lib/quote";
import type { Payment, Signage, WorkOrder } from "@/types";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type EvKind = "install" | "pay" | "expiry";
interface CalEvent {
  date: string; // YYYY-MM-DD
  kind: EvKind;
  label: string;
  to: string;
}
const KIND_META: Record<EvKind, { label: string; cls: string }> = {
  install: { label: "설치", cls: "ev-install" },
  pay: { label: "입금", cls: "ev-pay" },
  expiry: { label: "만료", cls: "ev-expiry" },
};
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [events, setEvents] = useState<CalEvent[]>([]);

  useEffect(() => {
    (async () => {
      const [wos, pays, signs] = await Promise.all([
        store.workorders.list(),
        store.payments.list(),
        store.signage.list(),
      ]);
      const evs: CalEvent[] = [];
      (wos as WorkOrder[]).forEach((w) => {
        if (w.schedule?.installDate) evs.push({ date: w.schedule.installDate, kind: "install", label: `${w.quote_no} 설치${w.crew ? ` · ${w.crew}` : ""}`, to: `/quotes/${w.quote_id}` });
      });
      (pays as Payment[]).forEach((p) => {
        if (p.due_date && !p.paid) evs.push({ date: p.due_date, kind: "pay", label: `${p.customer || p.quote_no} ${won(p.amount)}`, to: "/payments" });
      });
      (signs as Signage[]).forEach((s) => {
        if (s.status === "active" && s.permitExpiry) evs.push({ date: s.permitExpiry, kind: "expiry", label: `${s.name} 만료`, to: "/signage" });
      });
      setEvents(evs);
    })();
  }, []);

  const byDate = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of events) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  // 월 그리드 (6주 x 7일)
  const cells = useMemo(() => {
    const first = new Date(cur.y, cur.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // 그 주 일요일부터
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cur]);

  const upcoming = useMemo(() => {
    const t = ymd(today);
    return events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  }, [events, today]);

  const move = (delta: number) => {
    setCur((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const todayStr = ymd(today);

  return (
    <>
      <div className="page-head">
        <div><h1>일정</h1><div className="sub">설치 예정 · 입금 납기 · 광고물 표시기간 만료</div></div>
        <div className="spacer" />
        <button className="btn sm" onClick={() => setCur({ y: today.getFullYear(), m: today.getMonth() })}>오늘</button>
        <button className="btn sm" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <strong style={{ minWidth: 96, textAlign: "center" }}>{cur.y}.{String(cur.m + 1).padStart(2, "0")}</strong>
        <button className="btn sm" onClick={() => move(1)}><ChevronRight size={16} /></button>
      </div>

      <div className="card">
        <div className="row wrap" style={{ gap: 14, marginBottom: 12 }}>
          {(Object.keys(KIND_META) as EvKind[]).map((k) => (
            <span key={k} className="row" style={{ gap: 6, fontSize: 12.5, color: "var(--text-2)" }}>
              <span className={`cal-dot ${KIND_META[k].cls}`} />{KIND_META[k].label}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {WEEK.map((w, i) => <div key={w} className={`cal-h ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>{w}</div>)}
          {cells.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === cur.m;
            const evs = byDate[key] || [];
            return (
              <div key={i} className={`cal-cell ${inMonth ? "" : "dim-cell"} ${key === todayStr ? "today" : ""}`}>
                <div className={`cal-num ${d.getDay() === 0 ? "sun" : ""} ${d.getDay() === 6 ? "sat" : ""}`}>{d.getDate()}</div>
                {evs.slice(0, 3).map((e, j) => (
                  <Link key={j} to={e.to} className={`cal-ev ${KIND_META[e.kind].cls}`} title={e.label}>{e.label}</Link>
                ))}
                {evs.length > 3 && <div className="cal-more">+{evs.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">다가오는 일정</div>
        {upcoming.length === 0 ? (
          <div className="empty"><div className="big"><CalendarDays size={40} strokeWidth={1.5} /></div><div className="ttl">예정된 일정이 없습니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>날짜</th><th>구분</th><th>내용</th></tr></thead>
              <tbody>
                {upcoming.map((e, i) => (
                  <tr key={i}>
                    <td className="dim" style={{ whiteSpace: "nowrap" }}>{e.date}</td>
                    <td><span className={`chip ${e.kind === "expiry" ? "" : "blue"}`}>{KIND_META[e.kind].label}</span></td>
                    <td><Link className="link" to={e.to}>{e.label}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
