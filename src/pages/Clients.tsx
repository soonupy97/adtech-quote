import { useRef, useEffect, useState } from "react";
import { store } from "@/lib/store";
import { downloadCSV, parseCSV, toCSV } from "@/lib/csv";
import type { Client, Contact } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Plus, Building2, X } from "lucide-react";

const empty: Client = {
  id: "", name: "", tel: "", addr: "", manager: "", memo: "", created_at: "",
  bizno: "", grade: "normal", tags: [], contacts: [], history: [],
};

export default function Clients() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<Client[]>([]);
  const [edit, setEdit] = useState<Client | null>(null);

  const load = () => store.listClients().then(setList);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("상호를 입력하세요.");
    await store.saveClient(edit);
    setEdit(null);
    await load();
    toast("저장되었습니다.");
  };
  const del = async (c: Client) => {
    if (!confirm(`${c.name} 거래처를 삭제할까요?`)) return;
    await store.removeClient(c.id);
    await load();
    toast("삭제되었습니다.");
  };

  const setContact = (i: number, p: Partial<Contact>) => {
    if (!edit) return;
    const contacts = (edit.contacts || []).slice();
    contacts[i] = { ...contacts[i], ...p };
    setEdit({ ...edit, contacts });
  };

  const exportCSV = () => {
    downloadCSV("거래처.csv", toCSV(list.map((c) => ({
      상호: c.name, 연락처: c.tel, 담당: c.manager, 주소: c.addr, 사업자번호: c.bizno || "", 등급: c.grade || "", 태그: (c.tags || []).join("|"), 메모: c.memo,
    }))));
  };
  const importCSV = async (file?: File) => {
    if (!file) return;
    const rows = parseCSV(await file.text());
    let n = 0;
    for (const r of rows) {
      if (!r["상호"]) continue;
      await store.saveClient({ id: "", created_at: "", name: r["상호"], tel: r["연락처"] || "", manager: r["담당"] || "", addr: r["주소"] || "", bizno: r["사업자번호"] || "", grade: (r["등급"] as "vip" | "normal") || "normal", tags: r["태그"] ? r["태그"].split("|") : [], memo: r["메모"] || "", contacts: [], history: [] });
      n++;
    }
    await load();
    toast(`${n}건을 가져왔습니다.`);
  };

  return (
    <>
      <div className="page-head">
        <div><h1>거래처</h1><div className="sub">전체 {list.length}곳</div></div>
        <div className="spacer" />
        <button className="btn" onClick={exportCSV}>CSV 내보내기</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>CSV 가져오기</button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => importCSV(e.target.files?.[0])} />
        <button className="btn primary" onClick={() => setEdit({ ...empty })}><Plus size={15} />거래처 추가</button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><div className="big"><Building2 size={40} strokeWidth={1.5} /></div><div className="ttl">등록된 거래처가 없습니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>상호</th><th>등급</th><th>연락처</th><th>담당</th><th>태그</th><th>주소</th><th></th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.grade === "vip" ? <span className="chip blue">VIP</span> : <span className="chip">일반</span>}</td>
                    <td>{c.tel || "-"}</td>
                    <td>{c.manager || "-"}</td>
                    <td>{(c.tags || []).map((t) => <span key={t} className="chip" style={{ marginRight: 4 }}>{t}</span>)}</td>
                    <td className="dim">{c.addr || "-"}</td>
                    <td><div className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={() => setEdit({ ...empty, ...c })}>편집</button>
                      <button className="btn sm danger" onClick={() => del(c)}>삭제</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? "거래처 편집" : "거래처 추가"} onClose={() => setEdit(null)} wide
          footer={<><button className="btn primary" onClick={save}>저장</button><button className="btn" onClick={() => setEdit(null)}>취소</button></>}>
          <div className="grid cols-2">
            <label className="field"><span>상호</span><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="field"><span>사업자번호</span><input value={edit.bizno || ""} onChange={(e) => setEdit({ ...edit, bizno: e.target.value })} /></label>
            <label className="field"><span>연락처</span><input value={edit.tel} onChange={(e) => setEdit({ ...edit, tel: e.target.value })} /></label>
            <label className="field"><span>담당자</span><input value={edit.manager} onChange={(e) => setEdit({ ...edit, manager: e.target.value })} /></label>
            <label className="field"><span>등급</span>
              <select value={edit.grade || "normal"} onChange={(e) => setEdit({ ...edit, grade: e.target.value as "vip" | "normal" })}>
                <option value="normal">일반</option><option value="vip">VIP</option>
              </select>
            </label>
            <label className="field"><span>태그(쉼표 구분)</span><input value={(edit.tags || []).join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></label>
          </div>
          <label className="field"><span>주소</span><input value={edit.addr} onChange={(e) => setEdit({ ...edit, addr: e.target.value })} /></label>

          <div className="row" style={{ marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>담당자 연락처(여러 명)</span>
            <div className="spacer" />
            <button className="btn sm soft" onClick={() => setEdit({ ...edit, contacts: [...(edit.contacts || []), { name: "", role: "", tel: "", email: "" }] })}><Plus size={15} />추가</button>
          </div>
          {(edit.contacts || []).map((ct, i) => (
            <div className="row" key={i} style={{ gap: 6, marginTop: 8 }}>
              <input placeholder="이름" value={ct.name} onChange={(e) => setContact(i, { name: e.target.value })} />
              <input placeholder="직책" value={ct.role} onChange={(e) => setContact(i, { role: e.target.value })} />
              <input placeholder="연락처" value={ct.tel} onChange={(e) => setContact(i, { tel: e.target.value })} />
              <button className="btn sm danger" onClick={() => setEdit({ ...edit, contacts: (edit.contacts || []).filter((_, x) => x !== i) })}><X size={15} /></button>
            </div>
          ))}

          <label className="field" style={{ marginTop: 12 }}><span>메모</span><textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></label>
        </Modal>
      )}
    </>
  );
}
