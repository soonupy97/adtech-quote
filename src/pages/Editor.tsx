import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { store } from "@/lib/store";
import {
  GRADES,
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
  evaluateDiscountRules,
  expiryDate,
  needsApproval,
} from "@/lib/automation";
import SendActions from "@/components/SendActions";
import type {
  AdjMode,
  Attachment,
  CatalogItem,
  Client,
  Grade,
  Quote,
  QuoteItem,
  Settings,
} from "@/types";
import { useToast } from "@/components/Toast";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { AlertTriangle, Check, Plus, Settings2, X, Zap } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
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
  const [link, setLink] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const savedIdRef = useRef<string>("");
  const dirtyRef = useRef(false);

  useEffect(() => {
    store.listClients().then(setClients);
    store.catalogMap().then(setCatalog);
    store.getSettings().then(setSettings);
    (async () => {
      if (id) {
        const loaded = await store.getQuote(id);
        if (!loaded) { toast("견적을 찾을 수 없습니다."); navigate("/quotes"); return; }
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
          toast(`템플릿 '${tpl.name}' 적용`);
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

  // 자동저장 (부록 A28): 저장된 견적이 변경되면 2초 후 임시저장
  useEffect(() => {
    if (!q || !q.id || !dirtyRef.current) return;
    const t = setTimeout(async () => {
      await store.saveQuote(q);
      dirtyRef.current = false;
    }, 2000);
    return () => clearTimeout(t);
  }, [q]);

  const totals = useMemo(() => (q ? calcTotalsWithTax(q, settings || undefined) : null), [q, settings]);
  const margin = useMemo(() => (q ? calcMargin(q, catalog) : null), [q, catalog]);

  if (!q || !totals) return <div className="empty" style={{ paddingTop: 64 }}>불러오는 중…</div>;

  const isDraft = !q.id || q.status === "draft";
  const approval = needsApproval(q, settings || undefined);
  const dimUnit = dimLabel(q.dimUnit ?? settings?.units?.dimension); // 견적 단위 우선, 없으면 설정 기본값

  // ── 헬퍼 ──
  const patch = (p: Partial<Quote>) => { dirtyRef.current = true; setQ({ ...q, ...p }); };
  const setItem = (i: number, p: Partial<QuoteItem>) => { const items = q.items.slice(); items[i] = { ...items[i], ...p }; patch({ items }); };

  // 자동단가 + 옵션/구간단가 (부록 A19)
  const recalcPrice = (merged: QuoteItem) => {
    const c = catalog[`${merged.type}|${merged.grade}`];
    if (!c) return merged;
    const price = effectivePrice(merged, catalog, (merged as { _opts?: string[] })._opts || []);
    return { ...merged, price };
  };
  const onTypeOrGrade = (i: number, p: Partial<QuoteItem>) => {
    const merged = recalcPrice({ ...q.items[i], ...p });
    const items = q.items.slice(); items[i] = merged; patch({ items });
    if (catalog[`${merged.type}|${merged.grade}`]) toast(`자동단가 적용: ${won(merged.price)}`);
  };
  const onQty = (i: number, qty: number) => {
    const merged = recalcPrice({ ...q.items[i], qty });
    const items = q.items.slice(); items[i] = merged; patch({ items });
  };

  const addItem = () => patch({ items: [...q.items, makeItem()] });
  const delItem = (i: number) => patch({ items: q.items.filter((_, x) => x !== i) });

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

  // 자동 할인 규칙 적용 (부록 C)
  const applyAutoDiscounts = () => {
    const rules = settings?.discountRules || [];
    if (!rules.length) return toast("설정 > 자동할인 규칙이 없습니다.");
    const client = clients.find((c) => c.name === q.customer.name);
    const matched = evaluateDiscountRules(q, rules, client?.grade);
    if (!matched.length) return toast("충족하는 할인 규칙이 없습니다.");
    const existing = q.adjustments.discount.filter((d) => !d.label.startsWith("[자동]"));
    const auto = matched.map((m) => ({ label: `[자동] ${m.rule.label}`, mode: m.rule.then.mode, value: m.rule.then.value }));
    patch({ adjustments: { ...q.adjustments, discount: [...existing, ...auto] } });
    toast(`자동할인 ${auto.length}건 적용`);
  };

  // 프로모션 코드 적용 (부록 A19)
  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    const found = (settings?.promoCodes || []).find((p) => p.code === code);
    if (!found) return toast("유효하지 않은 코드입니다.");
    const existing = q.adjustments.discount.filter((d) => d.label !== `[코드] ${found.code}`);
    patch({ adjustments: { ...q.adjustments, discount: [...existing, { label: `[코드] ${found.code}`, mode: found.mode, value: found.value }] } });
    setPromo("");
    toast(`프로모션 '${found.label}' 적용`);
  };

  const loadClient = (cid: string) => {
    const c = clients.find((x) => x.id === cid); if (!c) return;
    patch({ customer: { name: c.name, tel: c.tel, addr: c.addr } });
    toast(`${c.name} 정보를 불러왔습니다.`);
  };
  const saveAsClient = async () => {
    if (!q.customer.name) return toast("고객 상호/성함을 입력하세요.");
    await store.saveClient({ id: "", name: q.customer.name, tel: q.customer.tel, addr: q.customer.addr, manager: "", memo: "", created_at: "" });
    setClients(await store.listClients());
    toast("거래처로 저장했습니다.");
  };

  // 템플릿으로 저장 (부록 A20)
  const saveAsTemplate = async () => {
    const name = prompt("템플릿 이름을 입력하세요");
    if (!name) return;
    await store.templates.save({
      id: "", name, memo: "", created_at: "",
      payload: { items: q.items, constructions: q.constructions, permits: q.permits, etcCosts: q.etcCosts, adjustments: q.adjustments, paymentTerms: q.paymentTerms },
    });
    toast("템플릿으로 저장했습니다.");
  };

  // 첨부 (부록 A20)
  const addAttachment = async (file?: File) => {
    if (!file || !q.id) { if (!q.id) toast("먼저 견적을 저장하세요."); return; }
    const url = await fileToDataUrl(file);
    await store.attachments.save({ id: "", quote_id: q.id, kind: "photo", url, name: file.name, created_at: "" });
    setAttachments(await store.attachments.list().then((l) => l.filter((a) => a.quote_id === q.id)));
    toast("첨부했습니다.");
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
      toast("저장되었습니다.");
      return saved;
    } finally { setBusy(false); }
  };

  const sendLink = async () => {
    if (approval && settings?.myRole && settings.myRole !== "admin") {
      return toast("관리자 승인이 필요한 견적입니다.");
    }
    const saved = q.id ? await store.saveQuote(q) : await doSave();
    const { url } = await store.markSent(saved.id);
    savedIdRef.current = saved.id;
    setLink(url);
    toast("발송 링크가 생성되었습니다.");
  };

  const exp = expiryDate(q);

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>{id ? "견적 수정" : "견적 작성"}</h1>
          <div className="sub">{q.quote_no || "저장 시 견적번호 발급"}{exp ? ` · 만료 ${fmtDate(exp)}` : ""}</div>
        </div>
      </div>

      {approval && <div className="banner info no-print"><AlertTriangle size={16} /> 고액/고할인 견적 — 발송 전 관리자 승인이 필요합니다 (부록 D).</div>}

      <div className={isDraft ? "watermark" : ""}>
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
        </div>
      </div>

      {/* 고객·현장 */}
      <div className="card">
        <div className="row wrap">
          <div className="card-title" style={{ marginBottom: 0 }}>고객 / 현장</div>
          <div className="spacer" />
          <Select
            style={{ maxWidth: 200 }}
            value=""
            placeholder="거래처 불러오기"
            onChange={(v) => v && loadClient(v)}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Button size="sm" variant="secondary" onClick={saveAsClient}>거래처 저장</Button>
        </div>
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
        <div className="row">
          <div className="card-title" style={{ marginBottom: 0 }}>광고물 품목</div>
          <div className="spacer" />
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addItem}>행 추가</Button>
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr><th style={{ minWidth: 150 }}>종류</th><th>{`가로(${dimUnit})`}</th><th>{`세로(${dimUnit})`}</th><th>면적</th><th>등급</th><th className="amt">단가</th><th>수량</th><th className="amt">금액</th><th></th></tr>
            </thead>
            <tbody>
              {q.items.map((it, i) => {
                const c = catalog[`${it.type}|${it.grade}`];
                const hasOpts = (c?.options?.length || 0) > 0;
                return (
                <Fragment key={i}>
                  <tr>
                    <td>
                      <Select value={it.type} onChange={(v) => onTypeOrGrade(i, { type: v })}
                        options={ITEM_TYPES.map((t) => ({ value: t, label: t }))} />
                    </td>
                    <td><Input value={it.w} onChange={(e) => setItem(i, { w: e.target.value })} placeholder="0" style={{ width: 70 }} /></td>
                    <td><Input value={it.h} onChange={(e) => setItem(i, { h: e.target.value })} placeholder="0" style={{ width: 70 }} /></td>
                    <td className="dim">{areaInSqm(it, dimUnit) ? `${areaInSqm(it, dimUnit)}㎡` : "-"}</td>
                    <td>
                      <Select value={it.grade} onChange={(v) => onTypeOrGrade(i, { grade: v as Grade })}
                        options={GRADES.map((g) => ({ value: g, label: g }))} />
                    </td>
                    <td><Input amount value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} style={{ width: 110 }} /></td>
                    <td><Input amount value={it.qty} onChange={(e) => onQty(i, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} style={{ width: 60 }} /></td>
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
                    <tr><td colSpan={9} style={{ background: "var(--fill-2)" }}>
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
                    <tr><td colSpan={9} style={{ background: "var(--fill-2)" }}>
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

      {/* 할증/할인 */}
      <div className="card">
        <div className="row no-print" style={{ marginBottom: 12 }}>
          <Button size="sm" variant="secondary" icon={<Zap size={14} />} onClick={applyAutoDiscounts}>자동할인 적용</Button>
          <div className="row" style={{ gap: 8 }}>
            <Input placeholder="프로모션 코드" value={promo} onChange={(e) => setPromo(e.target.value)} style={{ width: 150 }} />
            <Button size="sm" onClick={applyPromo}>적용</Button>
          </div>
        </div>
        <div className="grid cols-2">
          {(["surcharge", "discount"] as const).map((kind) => (
            <div key={kind}>
              <div className="row">
                <div className="card-title" style={{ marginBottom: 0 }}>{kind === "surcharge" ? "할증" : "할인"}</div>
                <div className="spacer" />
                <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => addAdj(kind)}>추가</Button>
              </div>
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
            </div>
          ))}
        </div>
      </div>

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
        <div className="row"><div className="card-title" style={{ marginBottom: 0 }}>첨부 (현장사진·도면·시안)</div><div className="spacer" />
          <label className="btn sm secondary" style={{ cursor: "pointer" }}><Plus size={14} />파일<input type="file" accept="image/*" hidden onChange={(e) => addAttachment(e.target.files?.[0])} /></label>
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
        ) : <div className="dim" style={{ marginTop: 8 }}>{q.id ? "첨부 없음" : "저장 후 첨부할 수 있습니다."}</div>}
      </div>

      {/* 결제조건·비고 */}
      <div className="card">
        <div className="card-title">결제 조건 / 비고</div>
        <div className="grid cols-3">
          <Field label="계약금"><Input value={q.paymentTerms.deposit} onChange={(e) => patch({ paymentTerms: { ...q.paymentTerms, deposit: e.target.value } })} /></Field>
          <Field label="잔금"><Input value={q.paymentTerms.balance} onChange={(e) => patch({ paymentTerms: { ...q.paymentTerms, balance: e.target.value } })} /></Field>
          <Field label="A/S"><Input value={q.paymentTerms.as} onChange={(e) => patch({ paymentTerms: { ...q.paymentTerms, as: e.target.value } })} /></Field>
        </div>
        <div className="grid cols-2">
          <Field label="유효기간"><Input value={q.validity} onChange={(e) => patch({ validity: e.target.value })} /></Field>
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
            <Button variant="primary" onClick={() => { navigator.clipboard?.writeText(link); toast("복사했습니다."); }}>링크 복사</Button>
            <a className="btn secondary" href={link} target="_blank" rel="noreferrer">미리보기</a>
            <div className="spacer" />
            <Button onClick={() => navigate(`/quotes/${savedIdRef.current}`)}>상세로 →</Button>
          </>}
        >
          <div className="dim" style={{ marginBottom: 12 }}>고객에게 링크를 전달하세요.</div>
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="row wrap no-print" style={{ marginTop: 16, gap: 8 }}>
            <SendActions url={link} tel={q.customer.tel} customer={q.customer.name} quoteNo={q.quote_no} />
          </div>
        </Modal>
      )}
    </>
  );
}
