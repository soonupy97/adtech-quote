import { useRef, useEffect, useState } from "react";
import { store } from "@/lib/store";
import { downloadCSV, parseCSV, toCSV } from "@/lib/csv";
import type { Client, Contact } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, Select, Table, Textarea, type Column } from "@/components/ui";
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
  const [saving, setSaving] = useState(false);

  const load = () => store.listClients().then(setList);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("상호를 입력하세요.");
    setSaving(true);
    try {
      await store.saveClient(edit);
      setEdit(null);
      await load();
      toast("저장되었습니다.");
    } finally { setSaving(false); }
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

  const columns: Column<Client>[] = [
    { key: "name", header: "상호", render: (c) => <span style={{ fontWeight: 700 }}>{c.name}</span> },
    { key: "grade", header: "등급", render: (c) => (c.grade === "vip" ? <Chip variant="blue">VIP</Chip> : <Chip>일반</Chip>) },
    { key: "tel", header: "연락처", render: (c) => c.tel || "-" },
    { key: "manager", header: "담당", render: (c) => c.manager || "-" },
    { key: "tags", header: "태그", render: (c) => (c.tags || []).map((t) => <Chip key={t} style={{ marginRight: 4 }}>{t}</Chip>) },
    { key: "addr", header: "주소", className: "dim", render: (c) => c.addr || "-" },
    {
      key: "act",
      render: (c) => (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" onClick={() => setEdit({ ...empty, ...c })}>편집</Button>
          <Button size="sm" variant="danger" onClick={() => del(c)}>삭제</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>거래처</h1><div className="sub">전체 {list.length}곳</div></div>
        <div className="spacer" />
        <Button onClick={exportCSV}>CSV 내보내기</Button>
        <Button onClick={() => fileRef.current?.click()}>CSV 가져오기</Button>
        <Input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => importCSV(e.target.files?.[0])} />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEdit({ ...empty })}>거래처 추가</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          rows={list}
          rowKey={(c) => c.id}
          empty={<EmptyState icon={<Building2 size={40} strokeWidth={1.5} />} title="등록된 거래처가 없습니다" />}
        />
      </div>

      {edit && (
        <Modal title={edit.id ? "거래처 편집" : "거래처 추가"} onClose={() => setEdit(null)} wide
          footer={<><Button variant="primary" loading={saving} onClick={save}>저장</Button><Button disabled={saving} onClick={() => setEdit(null)}>취소</Button></>}>
          <div className="grid cols-2">
            <Field label="상호"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="사업자번호"><Input value={edit.bizno || ""} onChange={(e) => setEdit({ ...edit, bizno: e.target.value })} /></Field>
            <Field label="연락처"><Input value={edit.tel} onChange={(e) => setEdit({ ...edit, tel: e.target.value })} /></Field>
            <Field label="담당자"><Input value={edit.manager} onChange={(e) => setEdit({ ...edit, manager: e.target.value })} /></Field>
            <Field label="등급">
              <Select value={edit.grade || "normal"} onChange={(v) => setEdit({ ...edit, grade: v as "vip" | "normal" })}
                options={[{ value: "normal", label: "일반" }, { value: "vip", label: "VIP" }]} />
            </Field>
            <Field label="태그(쉼표 구분)"><Input value={(edit.tags || []).join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></Field>
          </div>
          <Field label="주소"><Input value={edit.addr} onChange={(e) => setEdit({ ...edit, addr: e.target.value })} /></Field>

          <div className="row" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>담당자 연락처(여러 명)</span>
            <div className="spacer" />
            <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setEdit({ ...edit, contacts: [...(edit.contacts || []), { name: "", role: "", tel: "", email: "" }] })}>추가</Button>
          </div>
          {(edit.contacts || []).map((ct, i) => (
            <div className="row" key={i} style={{ gap: 8, marginTop: 8 }}>
              <Input placeholder="이름" value={ct.name} onChange={(e) => setContact(i, { name: e.target.value })} />
              <Input placeholder="직책" value={ct.role} onChange={(e) => setContact(i, { role: e.target.value })} />
              <Input placeholder="연락처" value={ct.tel} onChange={(e) => setContact(i, { tel: e.target.value })} />
              <Button size="sm" variant="danger" icon={<X size={15} />} onClick={() => setEdit({ ...edit, contacts: (edit.contacts || []).filter((_, x) => x !== i) })} />
            </div>
          ))}

          <Field label="메모" style={{ marginTop: 12 }}><Textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
