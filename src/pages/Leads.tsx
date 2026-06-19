import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate } from "@/lib/quote";
import type { Lead, LeadStage } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Plus, Inbox } from "lucide-react";

const SOURCE_LABEL: Record<Lead["source"], string> = {
  phone: "전화", form: "폼", kakao: "카카오", "walk-in": "방문",
};
const STAGE_LABEL: Record<LeadStage, string> = {
  new: "신규", consult: "상담", quoted: "견적발송", won: "수주", lost: "실주",
};
const STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "문의" },
  { key: "consult", label: "상담" },
  { key: "quoted", label: "견적발송" },
  { key: "won", label: "수주" },
  { key: "lost", label: "실주" },
];

const empty: Lead = {
  id: "", source: "phone", customerName: "", tel: "", memo: "", stage: "new", created_at: "",
};

// 부록 A21 리드/문의 인박스 + 영업 파이프라인 칸반(통합)
export default function Leads() {
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<Lead[]>([]);
  const [edit, setEdit] = useState<Lead | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [over, setOver] = useState<LeadStage | null>(null);

  const load = () => store.leads.list().then(setList);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.customerName.trim()) return toast("고객명을 입력하세요.");
    await store.leads.save(edit);
    setEdit(null);
    await load();
    toast("저장되었습니다.");
  };
  const del = async (l: Lead) => {
    if (!confirm(`'${l.customerName}' 문의를 삭제할까요?`)) return;
    await store.leads.remove(l.id);
    await load();
  };
  // 견적으로 전환 (부록 A21)
  const convert = async (l: Lead) => {
    await store.leads.save({ ...l, stage: "quoted" });
    navigate(`/editor?lead=${l.id}`);
  };
  // 칸반 드래그 이동
  const move = async (id: string, stage: LeadStage) => {
    const lead = list.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    await store.leads.save({ ...lead, stage });
    await load();
    toast(`'${lead.customerName}' → ${STAGES.find((s) => s.key === stage)?.label}`);
  };

  return (
    <>
      <div className="page-head">
        <div><h1>리드 · 영업</h1><div className="sub">외부 문의 등록·견적 전환과 파이프라인 · {list.length}건</div></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEdit({ ...empty })}><Plus size={15} />문의 등록</button>
      </div>

      <div className="tabs">
        <button className={`btn sm ${view === "list" ? "primary" : ""}`} onClick={() => setView("list")}>리스트</button>
        <button className={`btn sm ${view === "board" ? "primary" : ""}`} onClick={() => setView("board")}>파이프라인</button>
      </div>

      {view === "list" ? (
        <div className="card">
          {list.length === 0 ? (
            <div className="empty"><div className="big"><Inbox size={40} strokeWidth={1.5} /></div><div className="ttl">등록된 문의가 없습니다</div></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>고객</th><th>연락처</th><th>경로</th><th>단계</th><th>메모</th><th>등록일</th><th></th></tr></thead>
                <tbody>
                  {list.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.customerName}</td>
                      <td>{l.tel || "-"}</td>
                      <td><span className="chip">{SOURCE_LABEL[l.source]}</span></td>
                      <td><span className="chip blue">{STAGE_LABEL[l.stage]}</span></td>
                      <td className="dim">{l.memo || "-"}</td>
                      <td className="dim">{fmtDate(l.created_at)}</td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="btn sm soft" onClick={() => convert(l)}>견적전환</button>
                          <button className="btn sm" onClick={() => setEdit(l)}>편집</button>
                          <button className="btn sm danger" onClick={() => del(l)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="kanban">
          {STAGES.map((s) => {
            const items = list.filter((l) => l.stage === s.key);
            return (
              <div
                key={s.key}
                className={`col ${over === s.key ? "drop" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
                onDragLeave={() => setOver((v) => (v === s.key ? null : v))}
                onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData("id"), s.key); }}
              >
                <h4><span>{s.label}</span><span className="dim">{items.length}</span></h4>
                {items.map((l) => (
                  <div
                    key={l.id}
                    className="lead"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("id", l.id)}
                    onClick={() => setEdit(l)}
                  >
                    <div className="n">{l.customerName}</div>
                    <div className="m">{l.tel || "연락처 없음"}</div>
                    {l.memo && <div className="m">{l.memo}</div>}
                  </div>
                ))}
                {items.length === 0 && <div className="dim" style={{ fontSize: 12, textAlign: "center", padding: 12 }}>비어 있음</div>}
              </div>
            );
          })}
        </div>
      )}

      {edit && (
        <Modal
          title={edit.id ? "문의 편집" : "문의 등록"}
          onClose={() => setEdit(null)}
          footer={<><button className="btn primary" onClick={save}>저장</button><button className="btn" onClick={() => setEdit(null)}>취소</button></>}
        >
          <label className="field"><span>고객명</span><input value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} /></label>
          <label className="field"><span>연락처</span><input value={edit.tel} onChange={(e) => setEdit({ ...edit, tel: e.target.value })} /></label>
          <label className="field"><span>유입 경로</span>
            <select value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value as Lead["source"] })}>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span>단계</span>
            <select value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value as LeadStage })}>
              {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span>메모</span><textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></label>
        </Modal>
      )}
    </>
  );
}
