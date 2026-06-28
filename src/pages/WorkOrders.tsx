import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calendarEventUrl } from "@/lib/integrations";
import type { Quote, QuoteSummary, WorkOrder } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, PageTitle, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Plus, Wrench, CalendarPlus, Trash2 } from "lucide-react";

const STATUS_LABEL: Record<WorkOrder["status"], string> = { ready: "대기", in_progress: "진행중", done: "완료" };

// 부록 A23 발주서/작업지시서 자동 생성
export default function WorkOrders() {
  const toast = useToast();
  const [list, setList] = useState<WorkOrder[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => store.workorders.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.", "warning");
    setBusy(true);
    try {
      const q = (await store.getQuote(pick)) as Quote;
      await store.workorders.save({
        id: "", quote_id: q.id, quote_no: q.quote_no, site: q.site,
        items: q.items.map((it) => ({ type: it.type, spec: `${it.w || "-"}×${it.h || "-"}m`, qty: it.qty })),
        constructions: q.constructions.filter((c) => c.checked).map((c) => c.name),
        schedule: { installDate: "" }, crew: "", status: "ready", created_at: "",
      });
      setCreating(false); setPick("");
      await load();
      toast("작업지시서를 생성했습니다.", "success");
    } finally { setBusy(false); }
  };

  const update = async (w: WorkOrder, p: Partial<WorkOrder>) => {
    await store.workorders.save({ ...w, ...p });
    await load();
  };
  const del = async (w: WorkOrder) => {
    if (!confirm(`${w.quote_no} 작업지시서를 삭제할까요?`)) return;
    await store.workorders.remove(w.id);
    await load();
  };

  return (
    <>
      <div className="page-head">
        <PageTitle title="작업지시서" sub={`수주 건의 시공팀 지시서 · ${list.length}건`} />
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>작업지시서 생성</Button>
      </div>

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={<Wrench size={40} strokeWidth={1.5} />} title="작업지시서가 없습니다" /></div>
      ) : (
        list.map((w) => (
          <div className="card" key={w.id}>
            <div className="row">
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <Link className="link" to={`/quotes/${w.quote_id}`} style={{ fontWeight: 700 }}>{w.quote_no}</Link>
                  <Chip variant="blue">{STATUS_LABEL[w.status]}</Chip>
                </div>
                <div className="dim" style={{ marginTop: 4 }}>현장: {w.site?.floor || "-"} / 높이 {w.site?.height || "-"} / {w.site?.road || "-"}</div>
              </div>
              <div className="spacer" />
              <Select value={w.status} onChange={(val) => update(w, { status: val as WorkOrder["status"] })} style={{ width: 120 }}
                options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />} title="삭제" aria-label="삭제" onClick={() => del(w)} />
            </div>

            <div className="grid cols-2" style={{ marginTop: 16 }}>
              <div>
                <div className="card-sub" style={{ margin: 0 }}>품목</div>
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {w.items.map((it, i) => <li key={i}>{it.type} · {it.spec} · {it.qty}개</li>)}
                </ul>
                {w.constructions.length > 0 && (
                  <>
                    <div className="card-sub" style={{ margin: "12px 0 0" }}>시공항목</div>
                    <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                      {w.constructions.map((c) => <Chip key={c}>{c}</Chip>)}
                    </div>
                  </>
                )}
              </div>
              <div>
                <Field label="설치 예정일">
                  <Input type="date" value={w.schedule.installDate} onChange={(e) => update(w, { schedule: { installDate: e.target.value } })} />
                </Field>
                <Field label="시공팀/담당">
                  <Input value={w.crew} onChange={(e) => update(w, { crew: e.target.value })} placeholder="예: 1팀 김반장" />
                </Field>
                {w.schedule.installDate && (
                  <a className="btn" data-size="sm" href={calendarEventUrl(`설치: ${w.quote_no}`, w.schedule.installDate, w.crew)} target="_blank" rel="noreferrer">
                    <CalendarPlus size={16} />구글 캘린더 추가
                  </a>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {creating && (
        <Modal title="작업지시서 생성" onClose={() => setCreating(false)}
          footer={<><Button variant="primary" loading={busy} onClick={create}>생성</Button><Button variant="outline" disabled={busy} onClick={() => setCreating(false)}>취소</Button></>}>
          <Field label="수주(수락) 견적 선택">
            <Select value={pick} onChange={setPick} placeholder="선택…"
              options={quotes.map((q) => ({ value: q.id, label: `${q.quote_no} · ${q.customer}` }))} />
          </Field>
        </Modal>
      )}
    </>
  );
}
