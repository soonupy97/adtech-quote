import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate } from "@/lib/quote";
import type { Lead, LeadStage } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, PageTitle, Select, Table, Textarea, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Plus, Inbox, Trash2, Pencil, FileText } from "lucide-react";
import RowMenu from "@/components/RowMenu";

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
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [over, setOver] = useState<LeadStage | null>(null);

  const load = () => store.leads.list().then(setList);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.customerName.trim()) return toast("고객명을 입력하세요.", "warning");
    setSaving(true);
    try {
      await store.leads.save(edit);
      setEdit(null);
      await load();
      toast("저장되었습니다.", "success");
    } finally { setSaving(false); }
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
    toast(`'${lead.customerName}' → ${STAGES.find((s) => s.key === stage)?.label}`, "success");
  };

  const columns: Column<Lead>[] = [
    { key: "customerName", header: "고객", render: (l) => <span style={{ fontWeight: 700 }}>{l.customerName}</span> },
    { key: "tel", header: "연락처", render: (l) => l.tel || "-" },
    { key: "source", header: "경로", render: (l) => <Chip>{SOURCE_LABEL[l.source]}</Chip> },
    { key: "stage", header: "단계", render: (l) => <Chip variant="blue">{STAGE_LABEL[l.stage]}</Chip> },
    { key: "memo", header: "메모", className: "dim", render: (l) => l.memo || "-" },
    { key: "created_at", header: "등록일", className: "dim", render: (l) => fmtDate(l.created_at) },
    {
      key: "act",
      header: "관리",
      render: (l) => (
        <RowMenu actions={[
          { label: "견적전환", icon: <FileText size={16} />, onClick: () => convert(l) },
          { label: "편집", icon: <Pencil size={16} />, onClick: () => setEdit(l) },
          { label: "삭제", icon: <Trash2 size={16} />, danger: true, onClick: () => del(l) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <PageTitle title="리드 · 영업" sub={`외부 문의 등록·견적 전환과 파이프라인 · ${list.length}건`} />
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setEdit({ ...empty })}>문의 등록</Button>
      </div>

      <div className="tabs">
        <button className="btn" data-size="sm" data-variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>리스트</button>
        <button className="btn" data-size="sm" data-variant={view === "board" ? "primary" : "secondary"} onClick={() => setView("board")}>파이프라인</button>
      </div>

      {view === "list" ? (
        <div className="card">
          <Table
            columns={columns}
            rows={list}
            rowKey={(l) => l.id}
            empty={<EmptyState icon={<Inbox size={40} strokeWidth={1.5} />} title="등록된 문의가 없습니다" />}
          />
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
          footer={<><Button variant="primary" loading={saving} onClick={save}>저장</Button><Button variant="outline" disabled={saving} onClick={() => setEdit(null)}>취소</Button></>}
        >
          <Field label="고객명"><Input value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} /></Field>
          <Field label="연락처"><Input value={edit.tel} onChange={(e) => setEdit({ ...edit, tel: e.target.value })} /></Field>
          <Field label="유입 경로">
            <Select value={edit.source} onChange={(val) => setEdit({ ...edit, source: val as Lead["source"] })}
              options={Object.entries(SOURCE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Field>
          <Field label="단계">
            <Select value={edit.stage} onChange={(val) => setEdit({ ...edit, stage: val as LeadStage })}
              options={Object.entries(STAGE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Field>
          <Field label="메모"><Textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
