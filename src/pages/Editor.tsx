import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { store } from "@/lib/store";
import {
  ITEM_TYPES,
  PARTS,
  fmtDate,
  itemAmount,
  makeItem,
  newQuote,
  won,
} from "@/lib/quote";
import { areaInSqm, dimLabel } from "@/lib/units";
import {
  calcMargin,
  calcTotalsWithTax,
  effectivePrice,
  expiryDate,
} from "@/lib/automation";
import CopyLinkField from "@/components/CopyLinkField";
import type {
  AdjMode,
  Attachment,
  CatalogItem,
  Client,
  Quote,
  QuoteItem,
  Settings,
} from "@/types";
import { useToast } from "@/components/Toast";
import { Button, CardHeader, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { Check, Plus, Settings2, X } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
}

// 새 견적 자동저장 트리거: 의미있는 입력(고객명·비고·품목 내용)이 생겼는지
function hasContent(x: Quote): boolean {
  return (
    !!x.customer?.name?.trim() ||
    !!x.notes?.trim() ||
    x.items.length > 1 ||
    x.items.some((it) => it.price > 0 || !!it.w?.trim() || !!it.h?.trim() || it.qty > 1)
  );
}

export default function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [q, setQ] = useState<Quote | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [partsOpen, setPartsOpen] = useState<number | null>(null);
  const [optsOpen, setOptsOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const savedIdRef = useRef<string>("");
  const dirtyRef = useRef(false);

  useEffect(() => {
    store.listClients().then(setClients);
    store.catalogMap().then(setCatalog);
    store.getSettings().then(setSettings);
    (async () => {
      if (id) {
        // 자동저장으로 막 id가 붙었거나 이미 보유한 견적이면 재로딩 생략(편집 중 내용 보존)
        if (savedIdRef.current === id) return;
        const loaded = await store.getQuote(id);
        if (!loaded) { toast("견적을 찾을 수 없습니다.", "error"); navigate("/quotes"); return; }
        savedIdRef.current = loaded.id;
        setQ(loaded);
        setAttachments(await store.attachments.list().then((l) => l.filter((a) => a.quote_id === loaded.id)));
        return;
      }
      // 신규: 설정 기본값 적용
      const s = await store.getSettings();
      const fresh = newQuote();
      fresh.dimUnit = s.units?.dimension || "mm"; // 생성 시점 치수 단위 고정(기본 mm)
      fresh.supplier = { ...s.supplier };
      fresh.validity = s.defaults.validity || fresh.validity;
      fresh.paymentTerms = { deposit: s.defaults.deposit || "", balance: s.defaults.balance || "", as: s.defaults.as || "" };
      // 템플릿 적용 (부록 A20)
      const tplId = params.get("tpl");
      if (tplId) {
        const tpl = await store.templates.get(tplId);
        if (tpl) {
          fresh.items = tpl.payload.items.map((it) => ({ ...it, parts: { ...it.parts } }));
          fresh.constructions = tpl.payload.constructions.map((c) => ({ ...c }));
          fresh.permits = tpl.payload.permits.map((c) => ({ ...c }));
          fresh.etcCosts = tpl.payload.etcCosts.map((c) => ({ ...c }));
          fresh.adjustments = { surcharge: [...tpl.payload.adjustments.surcharge], discount: [...tpl.payload.adjustments.discount] };
          fresh.paymentTerms = { ...tpl.payload.paymentTerms };
          toast(`템플릿 '${tpl.name}' 적용`, "success");
        }
      }
      // 리드 전환 (부록 A21)
      const leadId = params.get("lead");
      if (leadId) {
        const lead = await store.leads.get(leadId);
        if (lead) fresh.customer = { name: lead.customerName, tel: lead.tel, addr: "" };
      }
      setQ(fresh);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 자동저장 (부록 A28): 변경 2초 후 임시저장. 새 견적도 의미있는 입력이 생기면 자동으로 draft 첫 저장.
  useEffect(() => {
    if (!q || !dirtyRef.current) return;
    if (!q.id && !hasContent(q)) return; // 빈 새 견적은 저장 안 함(빈 draft 양산 방지)
    const t = setTimeout(async () => {
      const wasNew = !q.id;
      const saved = await store.saveQuote(q);
      dirtyRef.current = false;
      if (wasNew) {
        savedIdRef.current = saved.id;
        // 편집 중 내용은 보존하고 id 계열 필드만 주입
        setQ((cur) =>
          cur && !cur.id
            ? { ...cur, id: saved.id, public_token: saved.public_token, quote_no: saved.quote_no, created_at: saved.created_at, status: saved.status }
            : cur,
        );
        navigate(`/editor/${saved.id}`, { replace: true });
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [q, navigate]);

  // 최신 q 참조(언마운트 플러시용)
  const qRef = useRef<Quote | null>(q);
  qRef.current = q;

  // 새로고침/탭 닫기 경고 — 저장 안 된 변경이 있을 때
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 화면 이탈(언마운트) 시 디바운스 대기 중인 미저장분 즉시 플러시
  useEffect(() => {
    return () => {
      const cur = qRef.current;
      if (dirtyRef.current && cur && (cur.id || hasContent(cur))) void store.saveQuote(cur);
    };
  }, []);

  const totals = useMemo(() => (q ? calcTotalsWithTax(q, settings || undefined) : null), [q, settings]);
  const margin = useMemo(() => (q ? calcMargin(q, catalog) : null), [q, catalog]);
  // 종류 옵션 = 기본 ITEM_TYPES + 품목·단가에 등록된 커스텀 종류(중복 제거, 기본이 앞)
  const typeOptions = useMemo(() => {
    const base = ITEM_TYPES as readonly string[];
    const extra = Object.keys(catalog).filter((t) => t && !base.includes(t));
    return [...base, ...extra];
  }, [catalog]);

  if (!q || !totals) return <Spinner label="불러오는 중…" style={{ paddingTop: 64 }} />;

  const dimUnit = dimLabel(q.dimUnit ?? settings?.units?.dimension); // 견적 단위 우선, 없으면 설정 기본값

  // ── 헬퍼 ──
  const patch = (p: Partial<Quote>) => { dirtyRef.current = true; setQ({ ...q, ...p }); };
  const setItem = (i: number, p: Partial<QuoteItem>) => { const items = q.items.slice(); items[i] = { ...items[i], ...p }; patch({ items }); };

  // 자동단가 + 옵션/구간단가 (부록 A19)
  const recalcPrice = (merged: QuoteItem) => {
    const c = catalog[merged.type];
    if (!c) return merged;
    const price = effectivePrice(merged, catalog, (merged as { _opts?: string[] })._opts || []);
    return { ...merged, price };
  };
  const onType = (i: number, p: Partial<QuoteItem>) => {
    const merged = recalcPrice({ ...q.items[i], ...p });
    const items = q.items.slice(); items[i] = merged; patch({ items });
    if (catalog[merged.type]) toast(`자동단가 적용: ${won(merged.price)}`, "success");
  };
  const onQty = (i: number, qty: number) => {
    const merged = recalcPrice({ ...q.items[i], qty });
    const items = q.items.slice(); items[i] = merged; patch({ items });
  };

  const addItem = () => patch({ items: [...q.items, makeItem()] });
  const delItem = (i: number) => {
    // 행이 삭제되면 인덱스가 당겨지므로, 인덱스로 추적하는 열린 패널을 닫아 다른 행에 잘못 붙는 걸 방지
    setOptsOpen(null);
    setPartsOpen(null);
    patch({ items: q.items.filter((_, x) => x !== i) });
  };

  const toggleCost = (field: "constructions" | "permits" | "etcCosts", i: number) => {
    const rows = q[field].slice(); rows[i] = { ...rows[i], checked: !rows[i].checked }; patch({ [field]: rows } as Partial<Quote>);
  };
  const setCost = (field: "constructions" | "permits" | "etcCosts", i: number, cost: number) => {
    const rows = q[field].slice(); rows[i] = { ...rows[i], cost }; patch({ [field]: rows } as Partial<Quote>);
  };

  const addAdj = (kind: "surcharge" | "discount") => {
    const adj = { ...q.adjustments }; adj[kind] = [...adj[kind], { label: "", mode: "pct" as AdjMode, value: 0 }]; patch({ adjustments: adj });
  };
  const setAdj = (kind: "surcharge" | "discount", i: number, p: Partial<{ label: string; mode: AdjMode; value: number }>) => {
    const adj = { ...q.adjustments }; const rows = adj[kind].slice(); rows[i] = { ...rows[i], ...p }; adj[kind] = rows; patch({ adjustments: adj });
  };
  const delAdj = (kind: "surcharge" | "discount", i: number) => {
    const adj = { ...q.adjustments }; adj[kind] = adj[kind].filter((_, x) => x !== i); patch({ adjustments: adj });
  };

  const loadClient = (cid: string) => {
    const c = clients.find((x) => x.id === cid); if (!c) return;
    patch({ customer: { name: c.name, tel: c.tel, addr: c.addr } });
    toast(`${c.name} 정보를 불러왔습니다.`, "success");
  };
  const saveAsClient = async () => {
    if (!q.customer.name) return toast("고객 상호/성함을 입력하세요.", "warning");
    await store.saveClient({ id: "", name: q.customer.name, tel: q.customer.tel, addr: q.customer.addr, manager: "", memo: "", created_at: "" });
    setClients(await store.listClients());
    toast("거래처로 저장했습니다.", "success");
  };

  // 템플릿으로 저장 (부록 A20)
  const saveAsTemplate = async () => {
    const name = prompt("템플릿 이름을 입력하세요");
    if (!name) return;
    await store.templates.save({
      id: "", name, memo: "", created_at: "",
      payload: { items: q.items, constructions: q.constructions, permits: q.permits, etcCosts: q.etcCosts, adjustments: q.adjustments, paymentTerms: q.paymentTerms },
    });
    toast("템플릿으로 저장했습니다.", "success");
  };

  // 첨부 (부록 A20) — 여러 파일 동시 선택 지원.
  // 저장 안 된 새 견적이면 먼저 draft 로 자동저장해 id 를 확보한 뒤 첨부한다(자동저장 패턴과 동일).
  const addAttachment = async (files?: FileList | null) => {
    const arr = files ? Array.from(files) : [];
    if (arr.length === 0) return;
    setAttaching(true);
    try {
      let quoteId = q.id;
      if (!quoteId) {
        const saved = await store.saveQuote(q);
        quoteId = saved.id;
        savedIdRef.current = saved.id;
        dirtyRef.current = false;
        setQ((cur) =>
          cur && !cur.id
            ? { ...cur, id: saved.id, public_token: saved.public_token, quote_no: saved.quote_no, created_at: saved.created_at, status: saved.status }
            : cur,
        );
        navigate(`/editor/${saved.id}`, { replace: true });
      }
      for (const file of arr) {
        const url = await fileToDataUrl(file);
        await store.attachments.save({ id: "", quote_id: quoteId, kind: "photo", url, name: file.name, created_at: "" });
      }
      setAttachments(await store.attachments.list().then((l) => l.filter((a) => a.quote_id === quoteId)));
      toast(arr.length > 1 ? `${arr.length}개 첨부했습니다.` : "첨부했습니다.", "success");
    } catch {
      toast("첨부에 실패했습니다.", "error");
    } finally {
      setAttaching(false);
    }
  };
  const delAttachment = async (aid: string) => {
    await store.attachments.remove(aid);
    setAttachments(await store.attachments.list().then((l) => l.filter((a) => a.quote_id === q.id)));
  };

  const doSave = async (): Promise<Quote> => {
    setBusy(true);
    try {
      const saved = await store.saveQuote(q);
      savedIdRef.current = saved.id;
      // 버전 스냅샷 (부록 A19 버전관리)
      const prev = await store.versions.list().then((l) => l.filter((v) => v.quote_id === saved.id));
      await store.versions.save({ id: "", quote_id: saved.id, version: prev.length + 1, snapshot: saved, created_at: "" } as never);
      dirtyRef.current = false;
      setQ(saved);
      if (!id) navigate(`/editor/${saved.id}`, { replace: true });
      toast("저장되었습니다.", "success");
      return saved;
    } finally { setBusy(false); }
  };

  const sendLink = async () => {
    const saved = q.id ? await store.saveQuote(q) : await doSave();
    const { url } = await store.markSent(saved.id);
    savedIdRef.current = saved.id;
    setLink(url);
    toast("발송 링크가 생성되었습니다.", "success");
  };

  const exp = expiryDate(q);

  return (
    <>
      <PageHeader
        className="no-print"
        title={id ? "견적 수정" : "견적 작성"}
        sub={`${q.quote_no || "저장 시 견적번호 발급"}${exp ? ` · 만료 ${fmtDate(exp)}` : ""}`}
      />

      <div>
      {/* 공급자 */}
      <div className="card">
        <div className="card-title">공급자 (우리 회사)</div>
        <div className="card-sub">설정에서 자동 입력됩니다. 필요 시 수정하세요.</div>
        <div className="grid cols-3">
          <Field label="상호"><Input value={q.supplier.name} onChange={(e) => patch({ supplier: { ...q.supplier, name: e.target.value } })} /></Field>
          <Field label="사업자번호"><Input value={q.supplier.bizno} onChange={(e) => patch({ supplier: { ...q.supplier, bizno: e.target.value } })} /></Field>
          <Field label="대표"><Input value={q.supplier.ceo} onChange={(e) => patch({ supplier: { ...q.supplier, ceo: e.target.value } })} /></Field>
          <Field label="주소"><Input value={q.supplier.addr} onChange={(e) => patch({ supplier: { ...q.supplier, addr: e.target.value } })} /></Field>
          <Field label="연락처"><Input value={q.supplier.tel} onChange={(e) => patch({ supplier: { ...q.supplier, tel: e.target.value } })} /></Field>
          <Field label="담당자"><Input value={q.supplier.manager} onChange={(e) => patch({ supplier: { ...q.supplier, manager: e.target.value } })} /></Field>
          <Field label="업종"><Input value={q.supplier.upjong || ""} onChange={(e) => patch({ supplier: { ...q.supplier, upjong: e.target.value } })} /></Field>
          <Field label="업태"><Input value={q.supplier.uptae || ""} onChange={(e) => patch({ supplier: { ...q.supplier, uptae: e.target.value } })} /></Field>
        </div>
      </div>

      {/* 고객·현장 */}
      <div className="card">
        <CardHeader
          className="wrap"
          title="고객 / 현장"
          action={
            <>
              <Select
                style={{ maxWidth: 200 }}
                value=""
                placeholder="거래처 불러오기"
                onChange={(v) => v && loadClient(v)}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Button size="sm" variant="secondary" onClick={saveAsClient}>거래처 저장</Button>
            </>
          }
        />
        <div className="grid cols-3" style={{ marginTop: 16 }}>
          <Field label="고객 상호/성함"><Input value={q.customer.name} onChange={(e) => patch({ customer: { ...q.customer, name: e.target.value } })} /></Field>
          <Field label="연락처"><Input value={q.customer.tel} onChange={(e) => patch({ customer: { ...q.customer, tel: e.target.value } })} /></Field>
          <Field label="주소"><Input value={q.customer.addr} onChange={(e) => patch({ customer: { ...q.customer, addr: e.target.value } })} /></Field>
          <Field label="층/위치"><Input value={q.site.floor} onChange={(e) => patch({ site: { ...q.site, floor: e.target.value } })} placeholder="예: 2층 정면" /></Field>
          <Field label="설치높이"><Input value={q.site.height} onChange={(e) => patch({ site: { ...q.site, height: e.target.value } })} placeholder="예: 4m" /></Field>
          <Field label="도로/접면"><Input value={q.site.road} onChange={(e) => patch({ site: { ...q.site, road: e.target.value } })} placeholder="예: 8m 도로" /></Field>
        </div>
      </div>

      {/* 품목 */}
      <div className="card">
        <CardHeader
          title="광고물 품목"
          action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addItem}>행 추가</Button>}
        />
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr><th style={{ minWidth: 150 }}>종류</th><th>{`가로(${dimUnit})`}</th><th>{`세로(${dimUnit})`}</th><th>면적</th><th className="amt">단가</th><th>수량</th><th className="amt">금액</th><th></th></tr>
            </thead>
            <tbody>
              {q.items.map((it, i) => {
                const c = catalog[it.type];
                const hasOpts = (c?.options?.length || 0) > 0;
                const rowTypes = it.type && !typeOptions.includes(it.type) ? [...typeOptions, it.type] : typeOptions;
                return (
                <Fragment key={i}>
                  <tr>
                    <td>
                      <Select className="field-type" value={it.type} onChange={(v) => onType(i, { type: v })}
                        options={rowTypes.map((t) => ({ value: t, label: t }))} />
                    </td>
                    <td><Input className="field-dim" value={it.w} onChange={(e) => setItem(i, { w: e.target.value })} placeholder="0" /></td>
                    <td><Input className="field-dim" value={it.h} onChange={(e) => setItem(i, { h: e.target.value })} placeholder="0" /></td>
                    <td className="dim">{areaInSqm(it, dimUnit) ? `${areaInSqm(it, dimUnit)}㎡` : "-"}</td>
                    <td><Input className="field-price" amount value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></td>
                    <td><Input className="field-qty" amount value={it.qty} onChange={(e) => onQty(i, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} /></td>
                    <td className="amt">{won(itemAmount(it))}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {hasOpts && <Button size="sm" title="옵션" icon={<Plus size={14} />} onClick={() => setOptsOpen(optsOpen === i ? null : i)}>옵션</Button>}
                        <Button size="sm" title="부품" icon={<Settings2 size={14} />} onClick={() => setPartsOpen(partsOpen === i ? null : i)} />
                        <Button size="sm" variant="danger" icon={<X size={14} />} onClick={() => delItem(i)} />
                      </div>
                    </td>
                  </tr>
                  {optsOpen === i && hasOpts && (
                    <tr><td colSpan={8} style={{ background: "var(--fill-2)" }}>
                      <div className="dim" style={{ marginBottom: 8 }}>옵션/변형 (선택 시 단가 가산)</div>
                      <div className="row wrap" style={{ gap: 8 }}>
                        {c!.options!.map((o) => {
                          const sel = ((it as { _opts?: string[] })._opts || []).includes(o.name);
                          return (
                            <Button key={o.name} size="sm" variant={sel ? "primary" : "secondary"} onClick={() => {
                              const cur = (it as { _opts?: string[] })._opts || [];
                              const next = sel ? cur.filter((x) => x !== o.name) : [...cur, o.name];
                              const merged = recalcPrice({ ...it, ...({ _opts: next } as object) } as QuoteItem);
                              const items = q.items.slice(); items[i] = merged; patch({ items });
                            }}>{o.name} (+{won(o.add)})</Button>
                          );
                        })}
                      </div>
                    </td></tr>
                  )}
                  {partsOpen === i && (
                    <tr><td colSpan={8} style={{ background: "var(--fill-2)" }}>
                      <div className="dim" style={{ marginBottom: 8 }}>부품 수량 메모 (금액 미반영)</div>
                      <div className="toggle-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
                        {PARTS.map((part) => (
                          <Field label={part} key={part} style={{ marginBottom: 0 }}>
                            <Input amount value={it.parts[part] || ""} onChange={(e) => { const parts = { ...it.parts, [part]: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setItem(i, { parts }); }} placeholder="0" />
                          </Field>
                        ))}
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {/* 시공·인허가·부대 */}
      {([["constructions", "시공·설치비"], ["permits", "인허가·행정비"], ["etcCosts", "부대비용"]] as const).map(([field, title]) => (
        <div className="card" key={field}>
          <div className="card-title">{title}</div>
          <div className="toggle-grid">
            {q[field].map((row, i) => (
              <div className={`toggle ${row.checked ? "on" : ""}`} key={row.name}>
                <div className="head" onClick={() => toggleCost(field, i)}><span className="check"><Check /></span>{row.name}</div>
                {row.checked && <Input className="cost" amount value={row.cost || ""} onChange={(e) => setCost(field, i, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder="금액(원)" />}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 할증 / 할인 (각각 별도 카드) */}
      {(["surcharge", "discount"] as const).map((kind) => {
        // 할증·할인 모두 "필요할 때만 체크" — 체크 시(=행 존재) 작성 가능, 해제 시 항목 비움.
        const title = kind === "surcharge" ? "할증" : "할인";
        const on = q.adjustments[kind].length > 0;
        return (
          <div className="card" key={kind}>
            <div className="row">
              <label className="chk row" style={{ gap: 8, marginBottom: 0, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    if (e.target.checked) addAdj(kind);
                    else patch({ adjustments: { ...q.adjustments, [kind]: [] } });
                  }}
                />
                <span className="card-title" style={{ marginBottom: 0 }}>{title}</span>
              </label>
              <div className="spacer" />
              {on && <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => addAdj(kind)}>추가</Button>}
            </div>
            {on ? (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {q.adjustments[kind].length === 0 && <div className="dim">항목 없음</div>}
                {q.adjustments[kind].map((r, i) => (
                  <div className="row" key={i} style={{ gap: 8 }}>
                    <Input placeholder="사유" value={r.label} onChange={(e) => setAdj(kind, i, { label: e.target.value })} />
                    <Select style={{ width: 90 }} value={r.mode} onChange={(v) => setAdj(kind, i, { mode: v as AdjMode })}
                      options={[{ value: "pct", label: "정률%" }, { value: "amt", label: "정액원" }]} />
                    <Input amount style={{ width: 90 }} value={r.value} onChange={(e) => setAdj(kind, i, { value: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} />
                    <Button size="sm" variant="danger" icon={<X size={14} />} onClick={() => delAdj(kind, i)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="dim" style={{ marginTop: 12 }}>필요 시 체크하여 {title} 항목을 추가하세요.</div>
            )}
          </div>
        );
      })}

      {/* 합계 */}
      <div className="card">
        <div className="card-title">합계</div>
        <div className="totals">
          <div className="line"><span>품목 합계</span><span className="v">{won(totals.items)}</span></div>
          <div className="line"><span>시공·설치비</span><span className="v">{won(totals.construct)}</span></div>
          <div className="line"><span>인허가·행정비</span><span className="v">{won(totals.permit)}</span></div>
          <div className="line"><span>부대비용</span><span className="v">{won(totals.etc)}</span></div>
          <div className="line sep"><span>소계</span><span className="v">{won(totals.subtotal)}</span></div>
          <div className="line"><span>할증</span><span className="v">{won(totals.surcharge)}</span></div>
          <div className="line"><span>할인</span><span className="v">-{won(totals.discount)}</span></div>
          <div className="line sep"><span>공급가액</span><span className="v">{won(totals.supply)}</span></div>
          <div className="line"><span>부가세 {settings?.tax?.mode && settings.tax.mode !== "taxable" ? "(면/영세)" : "(10%)"}</span><span className="v">{won(totals.vat)}</span></div>
          <div className="grand"><span className="label">총 견적금액</span><span className="v">{won(totals.grand)}</span></div>
        </div>
      </div>

      {/* 원가·마진 (부록 A19) */}
      {margin && margin.cost > 0 && (
        <div className="card no-print">
          <div className="card-title">원가 · 마진</div>
          <div className="margin-box">
            <div className="mi"><div className="k">원가 합계</div><div className="v">{won(margin.cost)}</div></div>
            <div className="mi"><div className="k">이익</div><div className="v" style={{ color: "var(--success)" }}>{won(margin.margin)}</div></div>
            <div className="mi"><div className="k">마진율</div><div className="v">{margin.marginRate}%</div></div>
            <div className="mi"><div className="k">원가율</div><div className="v">{margin.costRate}%</div></div>
          </div>
          <div className="dim" style={{ marginTop: 8 }}>품목·단가에 원가(cost)를 입력하면 자동 계산됩니다.</div>
        </div>
      )}

      {/* 첨부 (부록 A20) */}
      <div className="card no-print">
        <div className="row"><div className="card-title" style={{ marginBottom: 0 }}>첨부 (현장사진·도면·시안)</div>
          {attaching && <Spinner size={15} label="업로드 중…" style={{ marginLeft: 10 }} />}
          <div className="spacer" />
          <label className="btn" data-size="sm" aria-disabled={attaching || undefined} style={{ cursor: attaching ? "wait" : "pointer", opacity: attaching ? 0.6 : 1, pointerEvents: attaching ? "none" : undefined }}><Plus size={14} />파일<input type="file" accept="image/*" multiple hidden disabled={attaching} onChange={(e) => { addAttachment(e.target.files); e.target.value = ""; }} /></label>
        </div>
        {attachments.length > 0 ? (
          <div className="gallery" style={{ marginTop: 12 }}>
            {attachments.map((a) => (
              <div className="thumb" key={a.id}>
                <img src={a.url} alt={a.name} />
                <Button className="del" size="sm" variant="danger" icon={<X size={14} />} onClick={() => delAttachment(a.id)} />
              </div>
            ))}
          </div>
        ) : !attaching && <div className="dim" style={{ marginTop: 8 }}>{q.id ? "첨부 없음" : "파일을 추가하면 자동으로 임시저장됩니다."}</div>}
      </div>

      {/* 결제조건·비고 */}
      <div className="card">
        <div className="card-title">결제 조건 / 비고</div>
        <div className="grid cols-2">
          <Field label="계약금"><Input value={q.paymentTerms.deposit} onChange={(e) => patch({ paymentTerms: { ...q.paymentTerms, deposit: e.target.value } })} /></Field>
          <Field label="잔금"><Input value={q.paymentTerms.balance} onChange={(e) => patch({ paymentTerms: { ...q.paymentTerms, balance: e.target.value } })} /></Field>
        </div>
        <div className="grid cols-2">
          <Field label="유효기간"><Input value={q.validity} onChange={(e) => patch({ validity: e.target.value })} /></Field>
          <Field label="A/S"><Input value={q.paymentTerms.as} onChange={(e) => patch({ paymentTerms: { ...q.paymentTerms, as: e.target.value } })} /></Field>
        </div>
        <Field label="비고"><Textarea value={q.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="추가 안내사항" /></Field>
      </div>
      </div>{/* /watermark */}

      <div className="dim no-print" style={{ marginTop: 8 }}>발행일 {fmtDate(q.created_at)}{q.id ? " · 변경 시 자동저장" : ""}</div>

      {/* 액션바 */}
      <div className="actionbar no-print">
        <Button variant="primary" loading={busy} onClick={doSave}>저장</Button>
        <Button variant="secondary" disabled={busy} onClick={sendLink}>발송 링크 생성</Button>
        <Button onClick={saveAsTemplate}>템플릿으로 저장</Button>
        <Button onClick={() => window.print()}>PDF</Button>
        <div className="spacer" />
        <Button onClick={() => navigate("/quotes")}>목록</Button>
      </div>

      {link && (
        <Modal
          title="고객 발송"
          onClose={() => setLink(null)}
          footer={<>
            <Button variant="primary" onClick={() => { navigator.clipboard?.writeText(link); toast("링크를 복사했습니다.", "success"); }}>링크 복사</Button>
            <a className="btn" href={link} target="_blank" rel="noreferrer">미리보기</a>
            <div className="spacer" />
            <Button onClick={() => navigate(`/quotes/${savedIdRef.current}`)}>상세로 →</Button>
          </>}
        >
          <div className="dim" style={{ marginBottom: 12 }}>고객에게 링크를 전달하세요.</div>
          <CopyLinkField url={link} customer={q.customer.name} quoteNo={q.quote_no} />
        </Modal>
      )}
    </>
  );
}
