import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { won } from "@/lib/quote";
import type { CalendarColor, CalendarEvent, Payment, Signage, WorkOrder } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, PageTitle, Select, Table, Textarea, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

type EvKind = "install" | "pay" | "expiry" | "custom";
interface CalEvent {
  date: string; // YYYY-MM-DD
  time?: string;
  kind: EvKind;
  label: string;
  to?: string; // 파생 일정의 원본 링크
  event?: CalendarEvent; // 사용자 일정(편집 대상)
}
const KIND_META: Record<EvKind, { label: string; cls: string }> = {
  install: { label: "설치", cls: "ev-install" },
  pay: { label: "입금", cls: "ev-pay" },
  expiry: { label: "만료", cls: "ev-expiry" },
  custom: { label: "일정", cls: "ev-custom" },
};
const COLOR_CLASS: Record<CalendarColor, string> = {
  blue: "ev-c-blue",
  green: "ev-c-green",
  pink: "ev-c-pink",
  amber: "ev-c-amber",
  gray: "ev-c-gray",
};
const COLOR_OPTIONS: { value: CalendarColor; label: string }[] = [
  { value: "blue", label: "파랑" },
  { value: "green", label: "초록" },
  { value: "amber", label: "주황" },
  { value: "pink", label: "분홍" },
  { value: "gray", label: "회색" },
];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function evClass(e: CalEvent): string {
  if (e.kind === "custom") return COLOR_CLASS[e.event?.color || "blue"];
  return KIND_META[e.kind].cls;
}

export default function CalendarPage() {
  const toast = useToast();
  const today = new Date();
  const todayStr = ymd(today);
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [derived, setDerived] = useState<CalEvent[]>([]);
  const [custom, setCustom] = useState<CalendarEvent[]>([]);
  const [edit, setEdit] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDerived = async () => {
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
    setDerived(evs);
  };
  const loadCustom = () => store.events.list().then(setCustom);
  useEffect(() => {
    loadDerived();
    loadCustom();
  }, []);

  // 파생 + 사용자 일정 병합
  const events = useMemo<CalEvent[]>(() => {
    const mine: CalEvent[] = custom.map((e) => ({
      date: e.date,
      time: e.time,
      kind: "custom",
      label: e.time ? `${e.time} ${e.title}` : e.title,
      event: e,
    }));
    return [...derived, ...mine];
  }, [derived, custom]);

  const byDate = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of [...events].sort((a, b) => (a.time || "").localeCompare(b.time || ""))) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cur.y, cur.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cur]);

  const upcoming = useMemo(() => {
    return events
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
      .slice(0, 12);
  }, [events, todayStr]);

  const move = (delta: number) => {
    setCur((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const blank = (date: string): CalendarEvent => ({ id: "", title: "", date, time: "", color: "blue", memo: "", created_at: "" });
  const openAdd = (date: string) => setEdit(blank(date));

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast("일정 제목을 입력하세요.", "warning");
    if (!edit.date) return toast("날짜를 선택하세요.", "warning");
    setSaving(true);
    try {
      await store.events.save(edit);
      setEdit(null);
      await loadCustom();
      toast("일정을 저장했습니다.", "success");
    } finally { setSaving(false); }
  };
  const del = async () => {
    if (!edit?.id) return;
    if (!confirm("이 일정을 삭제할까요?")) return;
    setSaving(true);
    try {
      await store.events.remove(edit.id);
      setEdit(null);
      await loadCustom();
      toast("일정을 삭제했습니다.", "success");
    } finally { setSaving(false); }
  };

  const columns: Column<CalEvent>[] = [
    { key: "date", header: "날짜", className: "dim", render: (e) => <span style={{ whiteSpace: "nowrap" }}>{e.date}{e.time ? ` ${e.time}` : ""}</span> },
    { key: "kind", header: "구분", render: (e) => <Chip variant={e.kind === "custom" ? "blue" : e.kind === "expiry" ? "default" : "blue"}>{KIND_META[e.kind].label}</Chip> },
    {
      key: "label", header: "내용", render: (e) =>
        e.kind === "custom"
          ? <button className="link as-link" onClick={() => e.event && setEdit(e.event)}>{e.label}</button>
          : <Link className="link" to={e.to!}>{e.label}</Link>,
    },
  ];

  return (
    <>
      <div className="page-head">
        <PageTitle title="일정" sub="설치 예정 · 입금 납기 · 광고물 만료 + 직접 등록 일정" />
        <Button size="sm" onClick={() => setCur({ y: today.getFullYear(), m: today.getMonth() })}>오늘</Button>
        <Button size="sm" icon={<ChevronLeft size={16} />} onClick={() => move(-1)} />
        <strong style={{ minWidth: 96, textAlign: "center" }}>{cur.y}.{String(cur.m + 1).padStart(2, "0")}</strong>
        <Button size="sm" icon={<ChevronRight size={16} />} onClick={() => move(1)} />
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openAdd(todayStr)}>일정 추가</Button>
      </div>

      <div className="card">
        <div className="row wrap" style={{ gap: 16, marginBottom: 12 }}>
          {(["install", "pay", "expiry", "custom"] as EvKind[]).map((k) => (
            <span key={k} className="row" style={{ gap: 8, fontSize: 12, color: "var(--text-2)" }}>
              <span className={`cal-dot ${KIND_META[k].cls}`} />{KIND_META[k].label}
            </span>
          ))}
          <span className="dim" style={{ fontSize: 12 }}>· 빈 날짜를 클릭하면 일정을 추가할 수 있어요</span>
        </div>
        <div className="cal-grid">
          {WEEK.map((w, i) => <div key={w} className={`cal-h ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>{w}</div>)}
          {cells.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === cur.m;
            const evs = byDate[key] || [];
            return (
              <div
                key={i}
                className={`cal-cell clickable ${inMonth ? "" : "dim-cell"} ${key === todayStr ? "today" : ""}`}
                onClick={() => openAdd(key)}
                title="클릭하여 일정 추가"
              >
                <div className={`cal-num ${d.getDay() === 0 ? "sun" : ""} ${d.getDay() === 6 ? "sat" : ""}`}>{d.getDate()}</div>
                {evs.slice(0, 3).map((e, j) =>
                  e.kind === "custom" ? (
                    <button
                      key={j}
                      className={`cal-ev ${evClass(e)}`}
                      title={e.label}
                      onClick={(ev) => { ev.stopPropagation(); e.event && setEdit(e.event); }}
                    >{e.label}</button>
                  ) : (
                    <Link
                      key={j}
                      to={e.to!}
                      className={`cal-ev ${evClass(e)}`}
                      title={e.label}
                      onClick={(ev) => ev.stopPropagation()}
                    >{e.label}</Link>
                  ),
                )}
                {evs.length > 3 && <div className="cal-more">+{evs.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">다가오는 일정</div>
        <Table
          columns={columns}
          rows={upcoming}
          rowKey={(_, i) => i}
          empty={<EmptyState icon={<CalendarDays size={40} strokeWidth={1.5} />} title="예정된 일정이 없습니다" />}
        />
      </div>

      {edit && (
        <Modal
          title={edit.id ? "일정 편집" : "일정 추가"}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="primary" loading={saving} onClick={save}>저장</Button>
              {edit.id && <Button variant="danger" icon={<Trash2 size={15} />} title="삭제" aria-label="삭제" disabled={saving} onClick={del} />}
              <div className="spacer" />
              <Button disabled={saving} onClick={() => setEdit(null)}>취소</Button>
            </>
          }
        >
          <Field label="제목"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="예: 현장 미팅, 자재 발주" autoFocus /></Field>
          <div className="grid cols-2">
            <Field label="날짜"><Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <Field label="시간 (선택)"><Input type="time" value={edit.time || ""} onChange={(e) => setEdit({ ...edit, time: e.target.value })} /></Field>
          </div>
          <Field label="색상">
            <Select value={edit.color || "blue"} onChange={(v) => setEdit({ ...edit, color: v as CalendarColor })} options={COLOR_OPTIONS} />
          </Field>
          <Field label="메모 (선택)"><Textarea value={edit.memo || ""} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
