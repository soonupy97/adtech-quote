import { useEffect, useMemo, useRef, useState } from "react";
import { store } from "@/lib/store";
import { GRADES, ITEM_TYPES, won } from "@/lib/quote";
import { quantityUnits } from "@/lib/units";
import { downloadCSV, parseCSV, toCSV } from "@/lib/csv";
import type { CatalogItem, Grade } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, Select, Table, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Tags, X, Plus, Trash2 } from "lucide-react";

const empty: CatalogItem = {
  id: "", type: ITEM_TYPES[0], grade: "일반", unit: "㎡", price: 0, memo: "",
  cost: 0, options: [], priceTiers: [], taxable: true,
};

export default function Catalog() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [unitOpts, setUnitOpts] = useState<string[]>([]);

  const load = () => store.listCatalog().then(setList);
  useEffect(() => {
    load();
    store.getSettings().then((s) => setUnitOpts(quantityUnits(s.units?.quantityUnits)));
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((it) => !kw || it.type.toLowerCase().includes(kw));
  }, [list, q]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try { await store.saveCatalogItem(edit); setEdit(null); await load(); toast("저장되었습니다."); }
    finally { setSaving(false); }
  };
  const del = async (it: CatalogItem) => { if (!confirm(`${it.type}(${it.grade}) 삭제?`)) return; await store.removeCatalogItem(it.id); await load(); toast("삭제되었습니다."); };
  const seed = async () => {
    if (!confirm("기존 단가표를 모두 비우고 기본 샘플(종류당 1행)로 다시 채웁니다.\n계속할까요?")) return;
    const n = await store.seedCatalog();
    await load();
    toast(`샘플 ${n}건으로 초기화했습니다.`);
  };

  const exportCSV = () => downloadCSV("단가표.csv", toCSV(list.map((it) => ({
    종류: it.type, 등급: it.grade, 단위: it.unit, 단가: it.price, 원가: it.cost || 0, 과세: it.taxable === false ? "N" : "Y", 메모: it.memo,
  }))));
  const importCSV = async (file?: File) => {
    if (!file) return;
    const rows = parseCSV(await file.text());
    let n = 0;
    for (const r of rows) {
      if (!r["종류"]) continue;
      await store.saveCatalogItem({ id: "", type: r["종류"], grade: (r["등급"] as Grade) || "일반", unit: r["단위"] || "㎡", price: Number((r["단가"] || "0").replace(/[^0-9]/g, "")) || 0, cost: Number((r["원가"] || "0").replace(/[^0-9]/g, "")) || 0, taxable: r["과세"] !== "N", memo: r["메모"] || "", options: [], priceTiers: [] });
      n++;
    }
    await load(); toast(`${n}건을 가져왔습니다.`);
  };

  const columns: Column<CatalogItem>[] = [
    { key: "type", header: "종류", render: (it) => <span style={{ fontWeight: 700 }}>{it.type}</span> },
    { key: "grade", header: "등급", render: (it) => <Chip>{it.grade}</Chip> },
    { key: "unit", header: "단위" },
    { key: "price", header: "단가", align: "right", render: (it) => won(it.price) },
    { key: "cost", header: "원가", align: "right", className: "dim", render: (it) => (it.cost ? won(it.cost) : "-") },
    { key: "opt", header: "옵션/구간", className: "dim", render: (it) => <>{(it.options?.length || 0) > 0 ? `옵션 ${it.options!.length}` : ""}{(it.priceTiers?.length || 0) > 0 ? ` 구간 ${it.priceTiers!.length}` : ""}{!(it.options?.length || it.priceTiers?.length) ? "-" : ""}</> },
    { key: "taxable", header: "과세", render: (it) => (it.taxable === false ? <Chip>면세</Chip> : <Chip variant="blue">과세</Chip>) },
    {
      key: "act",
      header: "관리",
      render: (it) => (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" onClick={() => setEdit({ ...empty, ...it })}>편집</Button>
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} title="삭제" aria-label="삭제" onClick={() => del(it)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>품목·단가</h1><div className="sub">자동단가 키 = 종류 + 등급 · 전체 {list.length}행</div></div>
        <div className="spacer" />
        <Button onClick={seed}>샘플 단가표 생성</Button>
        <Button onClick={exportCSV}>CSV 내보내기</Button>
        <Button onClick={() => fileRef.current?.click()}>CSV 가져오기</Button>
        <Input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => importCSV(e.target.files?.[0])} />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEdit({ ...empty })}>품목 추가</Button>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <Input placeholder="종류 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        </div>
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(it) => it.id}
          empty={<EmptyState icon={<Tags size={40} strokeWidth={1.5} />} title="단가 항목이 없습니다" action={<Button variant="primary" onClick={seed}>샘플 단가표 생성</Button>} />}
        />
      </div>

      {edit && (
        <Modal title={edit.id ? "단가 편집" : "품목 추가"} onClose={() => setEdit(null)} wide
          footer={<><Button variant="primary" loading={saving} onClick={save}>저장</Button><Button disabled={saving} onClick={() => setEdit(null)}>취소</Button></>}>
          <div className="grid cols-2">
            <Field label="종류">
              <Select value={edit.type} onChange={(v) => setEdit({ ...edit, type: v })} options={ITEM_TYPES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="등급">
              <Select value={edit.grade} onChange={(v) => setEdit({ ...edit, grade: v as Grade })} options={GRADES.map((g) => ({ value: g, label: g }))} />
            </Field>
            <Field label="단위">
              <Input list="qty-units" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="㎡ / 개 / m / 식 …" />
              <datalist id="qty-units">{unitOpts.map((u) => <option key={u} value={u} />)}</datalist>
            </Field>
            <Field label="과세 구분">
              <Select value={edit.taxable === false ? "n" : "y"} onChange={(v) => setEdit({ ...edit, taxable: v === "y" })}
                options={[{ value: "y", label: "과세" }, { value: "n", label: "면세" }]} />
            </Field>
            <Field label="단가 (원)"><Input amount value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></Field>
            <Field label="원가 (원, 마진계산용)"><Input amount value={edit.cost || ""} onChange={(e) => setEdit({ ...edit, cost: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></Field>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>옵션/변형 (선택 시 가산)</span>
            <div className="spacer" />
            <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setEdit({ ...edit, options: [...(edit.options || []), { name: "", add: 0 }] })}>옵션</Button>
          </div>
          {(edit.options || []).map((o, i) => (
            <div className="row" key={i} style={{ gap: 8, marginTop: 8 }}>
              <Input placeholder="옵션명 (예: 양면)" value={o.name} onChange={(e) => { const opts = (edit.options || []).slice(); opts[i] = { ...o, name: e.target.value }; setEdit({ ...edit, options: opts }); }} />
              <Input amount placeholder="가산액" value={o.add} onChange={(e) => { const opts = (edit.options || []).slice(); opts[i] = { ...o, add: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setEdit({ ...edit, options: opts }); }} style={{ width: 120 }} />
              <Button size="sm" variant="danger" icon={<X size={15} />} onClick={() => setEdit({ ...edit, options: (edit.options || []).filter((_, x) => x !== i) })} />
            </div>
          ))}

          <div className="row" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>수량 구간별 단가 (볼륨 디스카운트)</span>
            <div className="spacer" />
            <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setEdit({ ...edit, priceTiers: [...(edit.priceTiers || []), { minQty: 0, price: 0 }] })}>구간</Button>
          </div>
          {(edit.priceTiers || []).map((t, i) => (
            <div className="row" key={i} style={{ gap: 8, marginTop: 8 }}>
              <span className="dim">수량 ≥</span>
              <Input amount value={t.minQty} onChange={(e) => { const ts = (edit.priceTiers || []).slice(); ts[i] = { ...t, minQty: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setEdit({ ...edit, priceTiers: ts }); }} style={{ width: 90 }} />
              <span className="dim">→ 단가</span>
              <Input amount value={t.price} onChange={(e) => { const ts = (edit.priceTiers || []).slice(); ts[i] = { ...t, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setEdit({ ...edit, priceTiers: ts }); }} style={{ width: 120 }} />
              <Button size="sm" variant="danger" icon={<X size={15} />} onClick={() => setEdit({ ...edit, priceTiers: (edit.priceTiers || []).filter((_, x) => x !== i) })} />
            </div>
          ))}

          <Field label="메모" style={{ marginTop: 12 }}><Input value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
