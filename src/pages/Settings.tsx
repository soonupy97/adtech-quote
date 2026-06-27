import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { Auth } from "@/lib/auth";
import { uuid } from "@/lib/quote";
import { DIM_UNITS, DEFAULT_QTY_UNITS } from "@/lib/units";
import type { AdjMode, DiscountRule, PromoCode, Role, Settings as SettingsT } from "@/types";
import { useToast } from "@/components/Toast";
import { Button, Field, Input, Modal, PageTitle, Select, Textarea } from "@/components/ui";
import { AlertTriangle, Check, Plus, X, Trash2 } from "lucide-react";
import { MENU_TOGGLES, MENU_EVENT } from "@/components/AppShell";

type Tab = "company" | "quote" | "terms" | "rules" | "approval" | "menus";
const TABS: { key: Tab; label: string }[] = [
  { key: "company", label: "회사" },
  { key: "quote", label: "견적 기본값" },
  { key: "terms", label: "약관·인사말" },
  { key: "rules", label: "할인" },
  { key: "approval", label: "승인" },
  { key: "menus", label: "메뉴 표시" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
}

export default function Settings() {
  const toast = useToast();
  const [s, setS] = useState<SettingsT | null>(null);
  const [saved, setSaved] = useState<SettingsT | null>(null); // 마지막 저장 시점 스냅샷
  const [tab, setTab] = useState<Tab>("company");
  const [saving, setSaving] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const navigate = useNavigate();
  // 계정 삭제(회원 탈퇴)
  const [myEmail, setMyEmail] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { store.getSettings().then((v) => { setS(v); setSaved(v); }); }, []);
  useEffect(() => { Auth.current().then((u) => setMyEmail(u?.email || "")); }, []);

  // 확인 문구(이메일)를 정확히 입력해야 활성화
  const delConfirmed = !!myEmail && delText.trim().toLowerCase() === myEmail.toLowerCase();
  const deleteAccount = async () => {
    if (!delConfirmed || deleting) return;
    setDeleting(true);
    try {
      const res = await Auth.deleteAccount();
      if (!res.ok) { toast(res.msg || "계정 삭제에 실패했습니다.", "error"); return; }
      toast("계정이 삭제되었습니다.", "success");
      navigate("/login", { replace: true });
    } finally { setDeleting(false); }
  };

  // 현재 값이 마지막 저장본과 다른지(미저장 변경 존재 여부)
  const dirty = useMemo(() => JSON.stringify(s) !== JSON.stringify(saved), [s, saved]);

  const save = async () => {
    if (!s || saving) return;
    setSaving(true);
    try {
      await store.saveSettings(s);
      setSaved(s); // 스냅샷 갱신 → dirty 해제
      window.dispatchEvent(new Event(MENU_EVENT)); // 사이드바 메뉴 표시 갱신
      toast("설정을 저장했습니다.", "success");
    } finally { setSaving(false); }
  };
  const revert = () => { if (saved) setS(saved); }; // 마지막 저장본으로 되돌리기

  // 변경분이 있을 때 새로고침·창닫기 시 이탈 경고
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Ctrl/Cmd+S 로 저장
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!s) return <div className="empty" style={{ paddingTop: 64 }}>불러오는 중…</div>;
  const sup = s.supplier, def = s.defaults;
  const hiddenMenus = s.menuHidden || [];
  const toggleMenu = (to: string) =>
    setS({ ...s, menuHidden: hiddenMenus.includes(to) ? hiddenMenus.filter((x) => x !== to) : [...hiddenMenus, to] });
  const branding = s.branding || {}, tax = s.tax || {}, numbering = s.numbering || {}, terms = s.terms || {};
  const rules = s.discountRules || [], promos = s.promoCodes || [];
  const units = s.units || {}, qtyUnits = units.quantityUnits ?? DEFAULT_QTY_UNITS;
  const addUnit = () => {
    const u = newUnit.trim();
    if (!u || qtyUnits.includes(u)) { setNewUnit(""); return; }
    setS({ ...s, units: { ...units, quantityUnits: [...qtyUnits, u] } });
    setNewUnit("");
  };
  const delUnit = (i: number) => setS({ ...s, units: { ...units, quantityUnits: qtyUnits.filter((_, x) => x !== i) } });

  const upload = async (key: "logoUrl" | "sealUrl", file?: File) => {
    if (!file) return;
    const url = await fileToDataUrl(file);
    setS({ ...s, branding: { ...branding, [key]: url } });
  };

  const addRule = () => setS({ ...s, discountRules: [...rules, { id: uuid(), label: "", when: {}, then: { mode: "pct", value: 0 }, stackable: false }] });
  const setRule = (i: number, r: DiscountRule) => { const n = rules.slice(); n[i] = r; setS({ ...s, discountRules: n }); };
  const delRule = (i: number) => setS({ ...s, discountRules: rules.filter((_, x) => x !== i) });

  const addPromo = () => setS({ ...s, promoCodes: [...promos, { code: "", label: "", mode: "pct", value: 0 }] });
  const setPromo = (i: number, p: PromoCode) => { const n = promos.slice(); n[i] = p; setS({ ...s, promoCodes: n }); };
  const delPromo = (i: number) => setS({ ...s, promoCodes: promos.filter((_, x) => x !== i) });

  return (
    <>
      <div className="page-head"><PageTitle title="설정" sub="회사정보·문서·자동화 규칙" /></div>

      <div className="tabs">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "secondary"} onClick={() => setTab(t.key)}>{t.label}</Button>
        ))}
      </div>

      {tab === "company" && (
        <>
          <div className="card">
            <div className="card-title">공급자 (우리 회사)</div>
            <div className="grid cols-2">
              <Field label="상호"><Input value={sup.name} onChange={(e) => setS({ ...s, supplier: { ...sup, name: e.target.value } })} /></Field>
              <Field label="사업자번호"><Input value={sup.bizno} onChange={(e) => setS({ ...s, supplier: { ...sup, bizno: e.target.value } })} /></Field>
              <Field label="대표"><Input value={sup.ceo} onChange={(e) => setS({ ...s, supplier: { ...sup, ceo: e.target.value } })} /></Field>
              <Field label="담당자"><Input value={sup.manager} onChange={(e) => setS({ ...s, supplier: { ...sup, manager: e.target.value } })} /></Field>
              <Field label="연락처"><Input value={sup.tel} onChange={(e) => setS({ ...s, supplier: { ...sup, tel: e.target.value } })} /></Field>
              <Field label="주소"><Input value={sup.addr} onChange={(e) => setS({ ...s, supplier: { ...sup, addr: e.target.value } })} /></Field>
            </div>
          </div>
          <div className="card">
            <div className="card-title">회사 브랜딩 (부록 A20)</div>
            <div className="grid cols-2">
              <Field label="로고 업로드"><Input type="file" accept="image/*" onChange={(e) => upload("logoUrl", e.target.files?.[0])} />
                {branding.logoUrl && <img src={branding.logoUrl} alt="logo" style={{ height: 48, marginTop: 8 }} />}
              </Field>
              <Field label="직인 업로드"><Input type="file" accept="image/*" onChange={(e) => upload("sealUrl", e.target.files?.[0])} />
                {branding.sealUrl && <img src={branding.sealUrl} alt="seal" style={{ height: 48, marginTop: 8 }} />}
              </Field>
            </div>
            <Field label="강조색(테마)" style={{ maxWidth: 200 }}>
              <Input type="color" value={branding.themeColor || "#3182f6"} onChange={(e) => setS({ ...s, branding: { ...branding, themeColor: e.target.value } })} style={{ height: 44 }} />
            </Field>
            <div className="dim">로고·직인·강조색은 견적서(PDF)/고객 화면에 반영됩니다.</div>
          </div>

          {/* 위험 구역 — 계정 삭제(회원 탈퇴) */}
          <div className="card danger-zone">
            <div className="card-title" style={{ color: "var(--danger)" }}>위험 구역</div>
            <div className="dz-row">
              <div>
                <div className="dz-title">계정 삭제 (회원 탈퇴)</div>
                <div className="dz-desc">
                  계정과 함께 견적·거래처·계약·정산 등 <b>모든 데이터가 영구 삭제</b>됩니다. 이 작업은 되돌릴 수 없습니다.
                </div>
              </div>
              <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => { setDelText(""); setDelOpen(true); }}>
                계정 삭제
              </Button>
            </div>
          </div>
        </>
      )}

      {tab === "quote" && (
        <>
          <div className="card">
            <div className="card-title">견적 기본값</div>
            <div className="grid cols-2">
              <Field label="유효기간"><Input value={def.validity} onChange={(e) => setS({ ...s, defaults: { ...def, validity: e.target.value } })} /></Field>
              <Field label="계약금"><Input value={def.deposit} onChange={(e) => setS({ ...s, defaults: { ...def, deposit: e.target.value } })} /></Field>
              <Field label="잔금"><Input value={def.balance} onChange={(e) => setS({ ...s, defaults: { ...def, balance: e.target.value } })} /></Field>
              <Field label="A/S"><Input value={def.as} onChange={(e) => setS({ ...s, defaults: { ...def, as: e.target.value } })} /></Field>
            </div>
          </div>

          <div className="card">
            <div className="card-title">치수 단위</div>
            <div className="card-sub" style={{ marginTop: 4 }}>견적 작성의 가로·세로 입력 단위입니다. 단가는 ㎡ 기준이라 면적은 항상 ㎡로 환산해 표시됩니다.</div>
            <Field label="가로·세로 입력 단위" style={{ maxWidth: 260, marginTop: 12 }}>
              <Select value={units.dimension || "mm"} onChange={(v) => setS({ ...s, units: { ...units, dimension: v as "m" | "cm" | "mm" | "㎡" } })}
                options={DIM_UNITS.map((u) => ({ value: u.value, label: u.label }))} />
            </Field>
            <div className="dim">예: 가로 3000{units.dimension || "mm"} × 세로 1000{units.dimension || "mm"} → 면적 자동 ㎡ 환산 (㎡ 선택 시 표시 라벨용)</div>
          </div>

          <div className="card">
            <div className="card-title">수량 단위 목록</div>
            <div className="card-sub" style={{ marginTop: 4 }}>품목·단가 화면에서 단위를 고를 때 제시되는 선택지입니다. (직접 입력도 가능)</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {qtyUnits.map((u, i) => (
                <span key={u + i} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--fill-2)", borderRadius: "var(--r-md)", fontWeight: 700, fontSize: 14 }}>
                  {u}
                  <X size={13} style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => delUnit(i)} />
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12, maxWidth: 320 }}>
              <Input placeholder="단위 추가 (예: 롤)" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUnit(); } }} />
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addUnit}>추가</Button>
            </div>
            <div className="dim" style={{ marginTop: 8 }}>변경 후 하단 <strong>저장</strong>을 눌러야 반영됩니다.</div>
          </div>

          <div className="card">
            <div className="card-title">세금 모드 (부록 A19)</div>
          <div className="grid cols-2">
            <Field label="과세 구분">
              <Select value={tax.mode || "taxable"} onChange={(v) => setS({ ...s, tax: { ...tax, mode: v as "taxable" | "free" | "zero" } })}
                options={[
                  { value: "taxable", label: "과세 (VAT 10%)" },
                  { value: "free", label: "면세" },
                  { value: "zero", label: "영세율" },
                ]} />
            </Field>
            <Field label="부가세 처리">
              <Select value={tax.vatIncluded ? "incl" : "excl"} onChange={(v) => setS({ ...s, tax: { ...tax, vatIncluded: v === "incl" } })}
                options={[
                  { value: "excl", label: "부가세 별도" },
                  { value: "incl", label: "부가세 포함" },
                ]} />
            </Field>
          </div>
          <div className="dim">기본값(과세·별도)은 블루프린트 §9 계산과 동일합니다.</div>
        </div>

          <div className="card">
            <div className="card-title">견적번호 채번 규칙 (부록 A19)</div>
          <div className="grid cols-3">
            <Field label="접두어"><Input value={numbering.prefix ?? "Q"} onChange={(e) => setS({ ...s, numbering: { ...numbering, prefix: e.target.value } })} /></Field>
            <Field label="날짜 형식">
              <Select value={numbering.dateFormat ?? "YYYYMMDD"} onChange={(v) => setS({ ...s, numbering: { ...numbering, dateFormat: v } })}
                options={[
                  { value: "YYYYMMDD", label: "YYYYMMDD" },
                  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                  { value: "YYMMDD", label: "YYMMDD" },
                ]} />
            </Field>
            <Field label="시퀀스 자릿수"><Input amount value={numbering.seqDigits ?? 3} onChange={(e) => setS({ ...s, numbering: { ...numbering, seqDigits: Number(e.target.value.replace(/[^0-9]/g, "")) || 3 } })} /></Field>
          </div>
          <div className="dim">예시: {`${numbering.prefix ?? "Q"}-${(numbering.dateFormat ?? "YYYYMMDD").replace("YYYY", "2026").replace("YY", "26").replace("MM", "06").replace("DD", "20")}-${"1".padStart(numbering.seqDigits ?? 3, "0")}`}</div>
        </div>
        </>
      )}

      {tab === "terms" && (
        <div className="card">
          <div className="card-title">표준 약관·인사말 (부록 A20)</div>
          <Field label="커버레터 / 인사말 (견적 상단)"><Textarea value={s.coverLetter || ""} onChange={(e) => setS({ ...s, coverLetter: e.target.value })} placeholder="안녕하세요, 견적을 보내드립니다…" /></Field>
          <Field label="표준 계약조건"><Textarea value={terms.standard || ""} onChange={(e) => setS({ ...s, terms: { ...terms, standard: e.target.value } })} /></Field>
          <Field label="A/S 조건"><Textarea value={terms.as || ""} onChange={(e) => setS({ ...s, terms: { ...terms, as: e.target.value } })} /></Field>
          <Field label="면책 문구"><Textarea value={terms.disclaimer || ""} onChange={(e) => setS({ ...s, terms: { ...terms, disclaimer: e.target.value } })} /></Field>
        </div>
      )}

      {tab === "rules" && (
        <>
          <div className="card">
            <div className="row"><div className="card-title" style={{ marginBottom: 0 }}>자동 할인 규칙 (부록 C)</div><div className="spacer" /><Button size="sm" variant="secondary" onClick={addRule}>+ 규칙</Button></div>
            <div className="card-sub" style={{ marginTop: 8 }}>조건 충족 시 견적 작성에서 “자동할인 적용”으로 주입됩니다.</div>
            {rules.length === 0 && <div className="dim">규칙 없음</div>}
            {rules.map((r, i) => (
              <div className="card" key={r.id} style={{ background: "var(--fill-2)", boxShadow: "none", marginTop: 12 }}>
                <div className="grid cols-2">
                  <Field label="이름"><Input value={r.label} onChange={(e) => setRule(i, { ...r, label: e.target.value })} placeholder="예: 대형계약 할인" /></Field>
                  <Field label="거래처 등급 조건">
                    <Select value={r.when.clientGrade || ""} onChange={(v) => setRule(i, { ...r, when: { ...r.when, clientGrade: (v || undefined) as "vip" | undefined } })}
                      options={[{ value: "", label: "무관" }, { value: "vip", label: "VIP" }]} />
                  </Field>
                  <Field label="소계 ≥ (원)"><Input amount value={r.when.subtotalGte || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, subtotalGte: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined } })} /></Field>
                  <Field label="총수량 ≥"><Input amount value={r.when.totalQtyGte || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, totalQtyGte: Number(e.target.value.replace(/[^0-9.]/g, "")) || undefined } })} /></Field>
                  <Field label="기간 시작"><Input type="date" value={r.when.dateFrom || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, dateFrom: e.target.value || undefined } })} /></Field>
                  <Field label="기간 종료"><Input type="date" value={r.when.dateTo || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, dateTo: e.target.value || undefined } })} /></Field>
                  <Field label="할인 방식">
                    <Select value={r.then.mode} onChange={(v) => setRule(i, { ...r, then: { ...r.then, mode: v as AdjMode } })}
                      options={[{ value: "pct", label: "정률 %" }, { value: "amt", label: "정액 원" }]} />
                  </Field>
                  <Field label="할인 값"><Input amount value={r.then.value} onChange={(e) => setRule(i, { ...r, then: { ...r.then, value: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } })} /></Field>
                </div>
                <div className="row">
                  <label className="row" style={{ gap: 8, cursor: "pointer" }} onClick={() => setRule(i, { ...r, stackable: !r.stackable })}>
                    <span className={`check ${r.stackable ? "on" : ""}`} style={{ width: 18, height: 18, borderRadius: 5, background: r.stackable ? "var(--toss-blue)" : "var(--canvas)", color: "#fff", display: "grid", placeItems: "center" }}>{r.stackable ? <Check size={12} strokeWidth={3} /> : ""}</span>
                    다른 규칙과 중복 적용
                  </label>
                  <div className="spacer" />
                  <Button size="sm" variant="danger" icon={<Trash2 size={14} />} title="삭제" aria-label="삭제" onClick={() => delRule(i)} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="row"><div className="card-title" style={{ marginBottom: 0 }}>프로모션 코드 (부록 A19)</div><div className="spacer" /><Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addPromo}>코드</Button></div>
            {promos.length === 0 && <div className="dim" style={{ marginTop: 8 }}>코드 없음</div>}
            {promos.map((p, i) => (
              <div className="row wrap" key={i} style={{ gap: 8, marginTop: 12 }}>
                <Input placeholder="코드" value={p.code} onChange={(e) => setPromo(i, { ...p, code: e.target.value.toUpperCase() })} style={{ width: 130 }} />
                <Input placeholder="설명" value={p.label} onChange={(e) => setPromo(i, { ...p, label: e.target.value })} style={{ maxWidth: 200 }} />
                <Select value={p.mode} onChange={(v) => setPromo(i, { ...p, mode: v as AdjMode })} style={{ width: 100 }}
                  options={[{ value: "pct", label: "정률 %" }, { value: "amt", label: "정액 원" }]} />
                <Input amount value={p.value} onChange={(e) => setPromo(i, { ...p, value: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} style={{ width: 90 }} />
                <Button size="sm" variant="danger" icon={<X size={14} />} onClick={() => delPromo(i)} />
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "menus" && (
        <div className="card">
          <div className="card-title">사이드바 메뉴 표시</div>
          <div className="card-sub" style={{ marginTop: 4 }}>
            안 쓰는 메뉴는 숨겨 사이드바를 간결하게 유지하세요. 대시보드·견적·설정은 항상 표시되며, 숨겨도 해당 주소로 직접 접근하면 열립니다.
          </div>
          {Array.from(new Set(MENU_TOGGLES.map((m) => m.section))).map((section) => (
            <div key={section} style={{ marginTop: 16 }}>
              <div className="card-sub" style={{ margin: "0 0 8px" }}>{section}</div>
              <div className="grid cols-2">
                {MENU_TOGGLES.filter((m) => m.section === section).map((m) => {
                  const on = !hiddenMenus.includes(m.to);
                  return (
                    <div key={m.to} className="row" style={{ gap: 12, cursor: "pointer", padding: "10px 12px", background: "var(--fill-2)", borderRadius: "var(--r-md)" }} onClick={() => toggleMenu(m.to)}>
                      <span className="check" style={{ width: 20, height: 20, borderRadius: 6, background: on ? "var(--toss-blue)" : "var(--canvas)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>{on && <Check size={13} strokeWidth={3} />}</span>
                      <span style={{ fontWeight: 700 }}>{m.label}</span>
                      <div className="spacer" />
                      <span className="dim" style={{ fontSize: 12 }}>{on ? "표시" : "숨김"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="dim" style={{ marginTop: 16 }}>변경 후 하단 <strong>저장</strong>을 눌러야 사이드바에 반영됩니다.</div>
        </div>
      )}

      {tab === "approval" && (
        <div className="card">
          <div className="card-title">고액·고할인 승인</div>
          <div className="card-sub" style={{ marginTop: 4 }}>
            기준을 넘는 견적은 발송 전 관리자 승인을 받도록 합니다. 내 역할이 관리자가 아니면 발송이 막히고, 관리자만 발송할 수 있습니다.
          </div>
          <div className={`toggle ${s.approval?.enabled ? "on" : ""}`} style={{ maxWidth: 360, display: "inline-flex", marginTop: 16 }}>
            <div className="head" onClick={() => setS({ ...s, approval: { ...s.approval, enabled: !s.approval?.enabled } })}>
              <span className="check"><Check /></span>
              고액·고할인 견적 관리자 승인 사용
            </div>
          </div>
          <div className="grid cols-2" style={{ marginTop: 12 }}>
            <Field label="승인 필요 금액(원) 이상">
              <Input amount value={s.approval?.amountGte || ""} onChange={(e) => setS({ ...s, approval: { ...s.approval, amountGte: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } })} placeholder="예: 10000000" />
            </Field>
            <Field label="승인 필요 할인율(%) 이상">
              <Input amount value={s.approval?.discountPctGte || ""} onChange={(e) => setS({ ...s, approval: { ...s.approval, discountPctGte: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } })} placeholder="예: 15" />
            </Field>
          </div>
          <Field label="내 역할" style={{ maxWidth: 240 }}>
            <Select value={s.myRole || "admin"} onChange={(v) => setS({ ...s, myRole: v as Role })}
              options={[{ value: "admin", label: "관리자" }, { value: "sales", label: "영업" }, { value: "viewer", label: "뷰어" }]} />
          </Field>
        </div>
      )}
      <div className={`actionbar${dirty ? "" : " is-flow"}`}>
        <span className="row" style={{ gap: 8, fontSize: 14, fontWeight: 500, color: dirty ? "var(--warn)" : "var(--text-2)" }}>
          {dirty ? (
            <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warn)", flexShrink: 0 }} />저장되지 않은 변경사항이 있습니다</>
          ) : (
            <><Check size={15} strokeWidth={3} />모든 변경사항이 저장됨</>
          )}
        </span>
        <div className="spacer" />
        {dirty && <Button variant="ghost" onClick={revert} disabled={saving}>되돌리기</Button>}
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>저장</Button>
      </div>

      {delOpen && (
        <Modal
          title="계정 삭제"
          onClose={() => !deleting && setDelOpen(false)}
          footer={
            <>
              <Button variant="danger" icon={<Trash2 size={15} />} loading={deleting} disabled={!delConfirmed} onClick={deleteAccount}>
                영구 삭제
              </Button>
              <Button variant="ghost" onClick={() => setDelOpen(false)} disabled={deleting}>취소</Button>
            </>
          }
        >
          <div className="banner no" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              계정과 <b>모든 데이터(견적·거래처·계약·정산·설정 등)</b>가 영구적으로 삭제되며 복구할 수 없습니다.
              <br />
              ※ 세금계산서·전자계약 등 법령상 보존 의무가 있는 기록은 관련 법에 따라 별도 보관될 수 있습니다.
            </span>
          </div>
          <Field label={<>확인을 위해 이메일 <b>{myEmail}</b> 을(를) 입력하세요</>}>
            <Input
              value={delText}
              onChange={(e) => setDelText(e.target.value)}
              placeholder={myEmail}
              autoComplete="off"
              aria-invalid={!!delText && !delConfirmed}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
