import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import type { Role, Settings, TeamUser } from "@/types";
import Modal from "@/components/Modal";
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

  const load = () => store.team.list().then(setList);
  useEffect(() => { load(); store.getSettings().then(setSettings); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("이름을 입력하세요.");
    await store.team.save(edit);
    setEdit(null);
    await load();
    toast("저장되었습니다.");
  };
  const del = async (u: TeamUser) => { if (confirm(`${u.name} 삭제?`)) { await store.team.remove(u.id); await load(); } };

  const saveSettings = async (next: Settings) => {
    setSettings(next);
    await store.saveSettings(next);
  };

  return (
    <>
      {!embedded && (
        <div className="page-head"><div><h1>팀 · 권한</h1><div className="sub">직원 계정·역할과 승인 워크플로</div></div>
          <div className="spacer" /><button className="btn primary" onClick={() => setEdit({ ...empty })}><Plus size={16} />직원 추가</button>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>직원 계정</div>
          <div className="spacer" />
          {embedded && <button className="btn sm primary" onClick={() => setEdit({ ...empty })}><Plus size={15} />직원 추가</button>}
        </div>
        {list.length === 0 ? (
          <div className="empty"><div className="big"><Users size={40} strokeWidth={1.5} /></div><div className="ttl">등록된 직원이 없습니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th></th></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.email || "-"}</td>
                    <td><span className="chip blue">{ROLE_LABEL[u.role]}</span></td>
                    <td><div className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={() => setEdit(u)}>편집</button>
                      <button className="btn sm danger" onClick={() => del(u)}>삭제</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <label className="field"><span>승인 필요 금액(원) 이상</span>
              <input className="amt" value={settings.approval?.amountGte || ""} onChange={(e) => saveSettings({ ...settings, approval: { ...settings.approval, amountGte: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } })} placeholder="예: 10000000" />
            </label>
            <label className="field"><span>승인 필요 할인율(%) 이상</span>
              <input className="amt" value={settings.approval?.discountPctGte || ""} onChange={(e) => saveSettings({ ...settings, approval: { ...settings.approval, discountPctGte: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } })} placeholder="예: 15" />
            </label>
          </div>
          <label className="field" style={{ maxWidth: 240 }}><span>내 역할(데모)</span>
            <select value={settings.myRole || "admin"} onChange={(e) => saveSettings({ ...settings, myRole: e.target.value as Role })}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? "직원 편집" : "직원 추가"} onClose={() => setEdit(null)}
          footer={<><button className="btn primary" onClick={save}>저장</button><button className="btn" onClick={() => setEdit(null)}>취소</button></>}>
          <label className="field"><span>이름</span><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label className="field"><span>이메일</span><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
          <label className="field"><span>역할</span>
            <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}
