import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDateTime } from "@/lib/quote";
import { reminderFor } from "@/lib/automation";
import type { AppNotification, QuoteSummary } from "@/types";
import { useToast } from "@/components/Toast";
import { Clock, Bell } from "lucide-react";

// 부록 A28 알림센터 + 부록 C 리마인더
export default function Notifications() {
  const toast = useToast();
  const [list, setList] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<{ q: QuoteSummary; msg: string }[]>([]);

  const load = async () => {
    setList(await store.notifications.list());
    const quotes = await store.listQuotes();
    const full = await Promise.all(
      quotes.filter((q) => q.status === "sent" || q.status === "viewed").map((q) => store.getQuote(q.id)),
    );
    const rem: { q: QuoteSummary; msg: string }[] = [];
    for (const q of full) {
      if (!q) continue;
      const msg = reminderFor(q);
      if (msg) {
        const s = quotes.find((x) => x.id === q.id)!;
        rem.push({ q: s, msg });
      }
    }
    setReminders(rem);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (n: AppNotification) => { await store.notifications.save({ ...n, read: true }); load(); };
  const markAll = async () => {
    for (const n of list.filter((x) => !x.read)) await store.notifications.save({ ...n, read: true });
    load();
    toast("모두 읽음 처리했습니다.");
  };
  const clear = async () => {
    if (!confirm("모든 알림을 삭제할까요?")) return;
    for (const n of list) await store.notifications.remove(n.id);
    load();
  };

  return (
    <>
      <div className="page-head">
        <div><h1>알림센터</h1><div className="sub">열람·수락·코멘트·만료·리마인더</div></div>
        <div className="spacer" />
        <button className="btn" onClick={markAll} disabled={list.every((n) => n.read)}>모두 읽음</button>
        <button className="btn danger" onClick={clear} disabled={list.length === 0}>전체 삭제</button>
      </div>

      {reminders.length > 0 && (
        <div className="card">
          <div className="card-title"><Clock size={16} /> 팔로업 리마인더</div>
          {reminders.map(({ q, msg }) => (
            <div className="banner info" key={q.id} style={{ marginBottom: 8 }}>
              <Link to={`/quotes/${q.id}`} style={{ fontWeight: 700 }}>{q.quote_no}</Link> · {q.customer} — {msg}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">알림</div>
        {list.length === 0 ? (
          <div className="empty"><div className="big"><Bell size={40} strokeWidth={1.5} /></div><div className="ttl">알림이 없습니다</div></div>
        ) : (
          list.map((n) => (
            <Link
              key={n.id}
              to={n.quote_id ? `/quotes/${n.quote_id}` : "#"}
              className={`noti ${n.read ? "" : "unread"}`}
              onClick={() => markRead(n)}
            >
              <div className="t">{n.title}</div>
              <div className="b">{n.body} · {fmtDateTime(n.created_at)}</div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
