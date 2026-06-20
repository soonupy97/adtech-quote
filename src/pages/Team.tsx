import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import type { Role, Settings, TeamUser } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, Select, Table, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Check, Plus, Users } from "lucide-react";

const ROLE_LABEL: Record<Role, string> = { admin: "관리자", sales: "영업", viewer: "뷰어" };
const empty: TeamUser = { id: "", name: "", email: "", role: "sales", created_at: "" };

// 부록 A26 / 부록 D 다계정·권한 + 승인 워크플로
export default function Team({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [list, setList] = useState<TeamUser[]>([]);
  const [edit, setEdit] = useState<TeamUser | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => store.team.list().then(setList);
  useEffect(() => { load(); store.getSettings().then(setSettings); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("이름을 입력하세요.");
    setSaving(true);
    try {
      await store.team.save(edit);
      setEdit(null);
      await load();
      toast("저장되었습니다.");
    } finally { setSaving(false); }
  };
  const del = async (u: TeamUser) => { if (confirm(`${u.name} 삭제?`)) { await store.team.remove(u.id); await load(); } };

  const saveSettings = async (next: Settings) => {
    setSettings(next);
    await store.saveSettings(next);
  };

  const columns: Column<TeamUser>[] = [
    { key: "name", header: "이름", render: (u) => <span style={{ fontWeight: 700 }}>{u.name}</span> },
    { key: "email", header: "이메일", render: (u) => u.email || "-" },
    { key: "role", header: "역할", render: (u) => <Chip variant="blue">{ROLE_LABEL[u.role]}</Chip> },
    {
      key: "act",
      render: (u) => (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" onClick={() => setEdit(u)}>편집</Button>
          <Button size="sm" variant="danger" onClick={() => del(u)}>삭제</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {!embedded && (
        <div className="page-head"><div><h1>팀 · 권한</h1><div className="sub">직원 계정·역할과 승인 워크플로</div></div>
          <div className="spacer" /><Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ ...empty })}>직원 추가</Button>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>직원 계정</div>
          <div className="spacer" />
          {embedded && <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEdit({ ...empty })}>직원 추가</Button>}
        </div>
        <Table
          columns={columns}
          rows={list}
          rowKey={(u) => u.id}
          empty={<EmptyState icon={<Users size={40} strokeWidth={1.5} />} title="등록된 직원이 없습니다" />}
        />
        <div className="card-sub" style={{ margin: "14px 0 0" }}>권한 매트릭스(부록 D): 관리자=전체 / 영업=본인 견적·발송·거래처 / 뷰어=보기</div>
      </div>

      {settings && (
        <div className="card">
          <div className="card-title">승인 워크플로 (부록 D)</div>
          <div className={`toggle ${settings.approval?.enabled ? "on" : ""}`} style={{ maxWidth: 360, display: "inline-flex" }}>
            <div className="head" onClick={() => saveSettings({ ...settings, approval: { ...settings.approval, enabled: !settings.approval?.enabled } })}>
              <span className="check"><Check /></span>
              고액·고할인 견적 관리자 승인 사용
            </div>
          </div>
          <div className="grid cols-2" style={{ marginTop: 12 }}>
            <Field label="승인 필요 금액(원) 이상">
              <Input amount value={settings.approval?.amountGte || ""} onChange={(e) => saveSettings({ ...settings, approval: { ...settings.approval, amountGte: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } })} placeholder="예: 10000000" />
            </Field>
            <Field label="승인 필요 할인율(%) 이상">
              <Input amount value={settings.approval?.discountPctGte || ""} onChange={(e) => saveSettings({ ...settings, approval: { ...settings.approval, discountPctGte: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } })} placeholder="예: 15" />
            </Field>
          </div>
          <Field label="내 역할(데모)" style={{ maxWidth: 240 }}>
            <Select value={settings.myRole || "admin"} onChange={(v) => saveSettings({ ...settings, myRole: v as Role })}
              options={Object.entries(ROLE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Field>
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? "직원 편집" : "직원 추가"} onClose={() => setEdit(null)}
          footer={<><Button variant="primary" loading={saving} onClick={save}>저장</Button><Button disabled={saving} onClick={() => setEdit(null)}>취소</Button></>}>
          <Field label="이름"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="이메일"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label="역할">
            <Select value={edit.role} onChange={(v) => setEdit({ ...edit, role: v as Role })}
              options={Object.entries(ROLE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Field>
        </Modal>
      )}
    </>
  );
}
