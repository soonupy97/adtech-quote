import { useEffect, useMemo, useRef, useState } from "react";
import { reseedCatalog, store, isSupabaseEnabled } from "@/lib/store";
import { GRADES, ITEM_TYPES, won } from "@/lib/quote";
import { downloadCSV, parseCSV, toCSV } from "@/lib/csv";
import type { CatalogItem, Grade } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Tags, X, Plus } from "lucide-react";

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

  const load = () => store.listCatalog().then(setList);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((it) => !kw || it.type.toLowerCase().includes(kw));
  }, [list, q]);

  const save = async () => { if (!edit) return; await store.saveCatalogItem(edit); setEdit(null); await load(); toast("저장되었습니다."); };
  const del = async (it: CatalogItem) => { if (!confirm(`${it.type}(${it.grade}) 삭제?`)) return; await store.removeCatalogItem(it.id); await load(); toast("삭제되었습니다."); };
  const reseed = async () => {
    if (!confirm("샘플 단가표 45행을 다시 채울까요?")) return;
    if (!isSupabaseEnabled) reseedCatalog();
    await store.seedIfEmpty(); await load(); toast("샘플 단가를 다시 채웠습니다.");
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

  return (
    <>
      <div className="page-head">
        <div><h1>품목·단가</h1><div className="sub">자동단가 키 = 종류 + 등급 · 전체 {list.length}행</div></div>
        <div className="spacer" />
        <button className="btn" onClick={exportCSV}>CSV 내보내기</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>CSV 가져오기</button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => importCSV(e.target.files?.[0])} />
        <button className="btn" onClick={reseed}>샘플 다시채우기</button>
        <button className="btn primary" onClick={() => setEdit({ ...empty })}><Plus size={15} />품목 추가</button>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <input placeholder="종류 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        </div>
        {filtered.length === 0 ? (
          <div className="empty"><div className="big"><Tags size={40} strokeWidth={1.5} /></div><div className="ttl">단가 항목이 없습니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>종류</th><th>등급</th><th>단위</th><th className="amt">단가</th><th className="amt">원가</th><th>옵션/구간</th><th>과세</th><th></th></tr></thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td style={{ fontWeight: 600 }}>{it.type}</td>
                    <td><span className="chip">{it.grade}</span></td>
                    <td>{it.unit}</td>
                    <td className="amt">{won(it.price)}</td>
                    <td className="amt dim">{it.cost ? won(it.cost) : "-"}</td>
                    <td className="dim">{(it.options?.length || 0) > 0 ? `옵션 ${it.options!.length}` : ""}{(it.priceTiers?.length || 0) > 0 ? ` 구간 ${it.priceTiers!.length}` : ""}{!(it.options?.length || it.priceTiers?.length) ? "-" : ""}</td>
                    <td>{it.taxable === false ? <span className="chip">면세</span> : <span className="chip blue">과세</span>}</td>
                    <td><div className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={() => setEdit({ ...empty, ...it })}>편집</button>
                      <button className="btn sm danger" onClick={() => del(it)}>삭제</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? "단가 편집" : "품목 추가"} onClose={() => setEdit(null)} wide
          footer={<><button className="btn primary" onClick={save}>저장</button><button className="btn" onClick={() => setEdit(null)}>취소</button></>}>
          <div className="grid cols-2">
            <label className="field"><span>종류</span>
              <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
            <label className="field"><span>등급</span>
              <select value={edit.grade} onChange={(e) => setEdit({ ...edit, grade: e.target.value as Grade })}>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select>
            </label>
            <label className="field"><span>단위</span><input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></label>
            <label className="field"><span>과세 구분</span>
              <select value={edit.taxable === false ? "n" : "y"} onChange={(e) => setEdit({ ...edit, taxable: e.target.value === "y" })}>
                <option value="y">과세</option><option value="n">면세</option>
              </select>
            </label>
            <label className="field"><span>단가 (원)</span><input className="amt" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></label>
            <label className="field"><span>원가 (원, 마진계산용)</span><input className="amt" value={edit.cost || ""} onChange={(e) => setEdit({ ...edit, cost: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></label>
          </div>

          <div className="row" style={{ marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>옵션/변형 (선택 시 가산)</span>
            <div className="spacer" />
            <button className="btn sm soft" onClick={() => setEdit({ ...edit, options: [...(edit.options || []), { name: "", add: 0 }] })}><Plus size={15} />옵션</button>
          </div>
          {(edit.options || []).map((o, i) => (
            <div className="row" key={i} style={{ gap: 6, marginTop: 8 }}>
              <input placeholder="옵션명 (예: 양면)" value={o.name} onChange={(e) => { const opts = (edit.options || []).slice(); opts[i] = { ...o, name: e.target.value }; setEdit({ ...edit, options: opts }); }} />
              <input className="amt" placeholder="가산액" value={o.add} onChange={(e) => { const opts = (edit.options || []).slice(); opts[i] = { ...o, add: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setEdit({ ...edit, options: opts }); }} style={{ width: 120 }} />
              <button className="btn sm danger" onClick={() => setEdit({ ...edit, options: (edit.options || []).filter((_, x) => x !== i) })}><X size={15} /></button>
            </div>
          ))}

          <div className="row" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>수량 구간별 단가 (볼륨 디스카운트)</span>
            <div className="spacer" />
            <button className="btn sm soft" onClick={() => setEdit({ ...edit, priceTiers: [...(edit.priceTiers || []), { minQty: 0, price: 0 }] })}><Plus size={15} />구간</button>
          </div>
          {(edit.priceTiers || []).map((t, i) => (
            <div className="row" key={i} style={{ gap: 6, marginTop: 8 }}>
              <span className="dim">수량 ≥</span>
              <input className="amt" value={t.minQty} onChange={(e) => { const ts = (edit.priceTiers || []).slice(); ts[i] = { ...t, minQty: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setEdit({ ...edit, priceTiers: ts }); }} style={{ width: 90 }} />
              <span className="dim">→ 단가</span>
              <input className="amt" value={t.price} onChange={(e) => { const ts = (edit.priceTiers || []).slice(); ts[i] = { ...t, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setEdit({ ...edit, priceTiers: ts }); }} style={{ width: 120 }} />
              <button className="btn sm danger" onClick={() => setEdit({ ...edit, priceTiers: (edit.priceTiers || []).filter((_, x) => x !== i) })}><X size={15} /></button>
            </div>
          ))}

          <label className="field" style={{ marginTop: 12 }}><span>메모</span><input value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} /></label>
        </Modal>
      )}
    </>
  );
}
