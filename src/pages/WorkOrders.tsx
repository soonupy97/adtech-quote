import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calendarEventUrl } from "@/lib/integrations";
import type { Quote, QuoteSummary, WorkOrder } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Plus, Wrench, CalendarPlus } from "lucide-react";

const STATUS_LABEL: Record<WorkOrder["status"], string> = { ready: "대기", in_progress: "진행중", done: "완료" };

// 부록 A23 발주서/작업지시서 자동 생성
export default function WorkOrders() {
  const toast = useToast();
  const [list, setList] = useState<WorkOrder[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");

  const load = () => store.workorders.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.");
    const q = (await store.getQuote(pick)) as Quote;
    await store.workorders.save({
      id: "", quote_id: q.id, quote_no: q.quote_no, site: q.site,
      items: q.items.map((it) => ({ type: it.type, spec: `${it.w || "-"}×${it.h || "-"}m`, qty: it.qty })),
      constructions: q.constructions.filter((c) => c.checked).map((c) => c.name),
      schedule: { installDate: "" }, crew: "", status: "ready", created_at: "",
    });
    setCreating(false); setPick("");
    await load();
    toast("작업지시서를 생성했습니다.");
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
        <div><h1>작업지시서</h1><div className="sub">수주 건의 시공팀 지시서 · {list.length}건</div></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} />작업지시서 생성</button>
      </div>

      {list.length === 0 ? (
        <div className="card"><div className="empty"><div className="big"><Wrench size={40} strokeWidth={1.5} /></div><div className="ttl">작업지시서가 없습니다</div></div></div>
      ) : (
        list.map((w) => (
          <div className="card" key={w.id}>
            <div className="row">
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <Link className="link" to={`/quotes/${w.quote_id}`} style={{ fontWeight: 700 }}>{w.quote_no}</Link>
                  <span className="chip blue">{STATUS_LABEL[w.status]}</span>
                </div>
                <div className="dim" style={{ marginTop: 4 }}>현장: {w.site?.floor || "-"} / 높이 {w.site?.height || "-"} / {w.site?.road || "-"}</div>
              </div>
              <div className="spacer" />
              <select value={w.status} onChange={(e) => update(w, { status: e.target.value as WorkOrder["status"] })} style={{ width: 120 }}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn sm danger" onClick={() => del(w)}>삭제</button>
            </div>

            <div className="grid cols-2" style={{ marginTop: 14 }}>
              <div>
                <div className="card-sub" style={{ margin: 0 }}>품목</div>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {w.items.map((it, i) => <li key={i}>{it.type} · {it.spec} · {it.qty}개</li>)}
                </ul>
                {w.constructions.length > 0 && (
                  <>
                    <div className="card-sub" style={{ margin: "12px 0 0" }}>시공항목</div>
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                      {w.constructions.map((c) => <span key={c} className="chip">{c}</span>)}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="field"><span>설치 예정일</span>
                  <input type="date" value={w.schedule.installDate} onChange={(e) => update(w, { schedule: { installDate: e.target.value } })} />
                </label>
                <label className="field"><span>시공팀/담당</span>
                  <input value={w.crew} onChange={(e) => update(w, { crew: e.target.value })} placeholder="예: 1팀 김반장" />
                </label>
                {w.schedule.installDate && (
                  <a className="btn sm soft" href={calendarEventUrl(`설치: ${w.quote_no}`, w.schedule.installDate, w.crew)} target="_blank" rel="noreferrer">
                    <CalendarPlus size={15} />구글 캘린더 추가
                  </a>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {creating && (
        <Modal title="작업지시서 생성" onClose={() => setCreating(false)}
          footer={<><button className="btn primary" onClick={create}>생성</button><button className="btn" onClick={() => setCreating(false)}>취소</button></>}>
          <label className="field"><span>수주(수락) 견적 선택</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">선택…</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_no} · {q.customer}</option>)}
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}
