import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { uuid } from "@/lib/quote";
import type { AdjMode, DiscountRule, PromoCode, Settings as SettingsT } from "@/types";
import { useToast } from "@/components/Toast";
import { Check, Plus, X } from "lucide-react";
import Team from "./Team";
import IntegrationsPage from "./IntegrationsPage";
import Activities from "./Activities";
import { MENU_TOGGLES, MENU_EVENT } from "@/components/AppShell";

type Tab = "company" | "branding" | "tax" | "numbering" | "terms" | "rules" | "menus" | "team" | "integrations" | "activities";
const TABS: { key: Tab; label: string }[] = [
  { key: "company", label: "회사·기본값" },
  { key: "branding", label: "브랜딩" },
  { key: "tax", label: "세금" },
  { key: "numbering", label: "견적번호" },
  { key: "terms", label: "약관·인사말" },
  { key: "rules", label: "자동할인·프로모션" },
  { key: "menus", label: "메뉴 표시" },
  { key: "team", label: "팀·권한" },
  { key: "integrations", label: "연동" },
  { key: "activities", label: "활동로그" },
];
// 자체 저장/별도 화면을 갖는 탭 — 설정 공통 저장바 숨김
const SELF_MANAGED: Tab[] = ["team", "integrations", "activities"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
}

export default function Settings() {
  const toast = useToast();
  const [s, setS] = useState<SettingsT | null>(null);
  const [tab, setTab] = useState<Tab>("company");

  useEffect(() => { store.getSettings().then(setS); }, []);
  if (!s) return <div className="empty" style={{ paddingTop: 80 }}>불러오는 중…</div>;

  const save = async () => {
    await store.saveSettings(s);
    window.dispatchEvent(new Event(MENU_EVENT)); // 사이드바 메뉴 표시 갱신
    toast("설정을 저장했습니다.");
  };
  const sup = s.supplier, def = s.defaults;
  const hiddenMenus = s.menuHidden || [];
  const toggleMenu = (to: string) =>
    setS({ ...s, menuHidden: hiddenMenus.includes(to) ? hiddenMenus.filter((x) => x !== to) : [...hiddenMenus, to] });
  const branding = s.branding || {}, tax = s.tax || {}, numbering = s.numbering || {}, terms = s.terms || {};
  const rules = s.discountRules || [], promos = s.promoCodes || [];

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
      <div className="page-head"><div><h1>설정</h1><div className="sub">회사정보·문서·자동화 규칙</div></div></div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`btn sm ${tab === t.key ? "primary" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "company" && (
        <>
          <div className="card">
            <div className="card-title">공급자 (우리 회사)</div>
            <div className="grid cols-2">
              <label className="field"><span>상호</span><input value={sup.name} onChange={(e) => setS({ ...s, supplier: { ...sup, name: e.target.value } })} /></label>
              <label className="field"><span>사업자번호</span><input value={sup.bizno} onChange={(e) => setS({ ...s, supplier: { ...sup, bizno: e.target.value } })} /></label>
              <label className="field"><span>대표</span><input value={sup.ceo} onChange={(e) => setS({ ...s, supplier: { ...sup, ceo: e.target.value } })} /></label>
              <label className="field"><span>담당자</span><input value={sup.manager} onChange={(e) => setS({ ...s, supplier: { ...sup, manager: e.target.value } })} /></label>
              <label className="field"><span>연락처</span><input value={sup.tel} onChange={(e) => setS({ ...s, supplier: { ...sup, tel: e.target.value } })} /></label>
              <label className="field"><span>주소</span><input value={sup.addr} onChange={(e) => setS({ ...s, supplier: { ...sup, addr: e.target.value } })} /></label>
            </div>
          </div>
          <div className="card">
            <div className="card-title">견적 기본값</div>
            <div className="grid cols-2">
              <label className="field"><span>유효기간</span><input value={def.validity} onChange={(e) => setS({ ...s, defaults: { ...def, validity: e.target.value } })} /></label>
              <label className="field"><span>계약금</span><input value={def.deposit} onChange={(e) => setS({ ...s, defaults: { ...def, deposit: e.target.value } })} /></label>
              <label className="field"><span>잔금</span><input value={def.balance} onChange={(e) => setS({ ...s, defaults: { ...def, balance: e.target.value } })} /></label>
              <label className="field"><span>A/S</span><input value={def.as} onChange={(e) => setS({ ...s, defaults: { ...def, as: e.target.value } })} /></label>
            </div>
          </div>
        </>
      )}

      {tab === "branding" && (
        <div className="card">
          <div className="card-title">회사 브랜딩 (부록 A20)</div>
          <div className="grid cols-2">
            <label className="field"><span>로고 업로드</span><input type="file" accept="image/*" onChange={(e) => upload("logoUrl", e.target.files?.[0])} />
              {branding.logoUrl && <img src={branding.logoUrl} alt="logo" style={{ height: 48, marginTop: 8 }} />}
            </label>
            <label className="field"><span>직인 업로드</span><input type="file" accept="image/*" onChange={(e) => upload("sealUrl", e.target.files?.[0])} />
              {branding.sealUrl && <img src={branding.sealUrl} alt="seal" style={{ height: 48, marginTop: 8 }} />}
            </label>
          </div>
          <label className="field" style={{ maxWidth: 200 }}><span>강조색(테마)</span>
            <input type="color" value={branding.themeColor || "#3182f6"} onChange={(e) => setS({ ...s, branding: { ...branding, themeColor: e.target.value } })} style={{ height: 44 }} />
          </label>
          <div className="dim">로고·직인·강조색은 견적서(PDF)/고객 화면에 반영됩니다.</div>
        </div>
      )}

      {tab === "tax" && (
        <div className="card">
          <div className="card-title">세금 모드 (부록 A19)</div>
          <div className="grid cols-2">
            <label className="field"><span>과세 구분</span>
              <select value={tax.mode || "taxable"} onChange={(e) => setS({ ...s, tax: { ...tax, mode: e.target.value as "taxable" | "free" | "zero" } })}>
                <option value="taxable">과세 (VAT 10%)</option>
                <option value="free">면세</option>
                <option value="zero">영세율</option>
              </select>
            </label>
            <label className="field"><span>부가세 처리</span>
              <select value={tax.vatIncluded ? "incl" : "excl"} onChange={(e) => setS({ ...s, tax: { ...tax, vatIncluded: e.target.value === "incl" } })}>
                <option value="excl">부가세 별도</option>
                <option value="incl">부가세 포함</option>
              </select>
            </label>
          </div>
          <div className="dim">기본값(과세·별도)은 블루프린트 §9 계산과 동일합니다.</div>
        </div>
      )}

      {tab === "numbering" && (
        <div className="card">
          <div className="card-title">견적번호 채번 규칙 (부록 A19)</div>
          <div className="grid cols-3">
            <label className="field"><span>접두어</span><input value={numbering.prefix ?? "Q"} onChange={(e) => setS({ ...s, numbering: { ...numbering, prefix: e.target.value } })} /></label>
            <label className="field"><span>날짜 형식</span>
              <select value={numbering.dateFormat ?? "YYYYMMDD"} onChange={(e) => setS({ ...s, numbering: { ...numbering, dateFormat: e.target.value } })}>
                <option value="YYYYMMDD">YYYYMMDD</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="YYMMDD">YYMMDD</option>
              </select>
            </label>
            <label className="field"><span>시퀀스 자릿수</span><input className="amt" value={numbering.seqDigits ?? 3} onChange={(e) => setS({ ...s, numbering: { ...numbering, seqDigits: Number(e.target.value.replace(/[^0-9]/g, "")) || 3 } })} /></label>
          </div>
          <div className="dim">예시: {`${numbering.prefix ?? "Q"}-${(numbering.dateFormat ?? "YYYYMMDD").replace("YYYY", "2026").replace("YY", "26").replace("MM", "06").replace("DD", "20")}-${"1".padStart(numbering.seqDigits ?? 3, "0")}`}</div>
        </div>
      )}

      {tab === "terms" && (
        <div className="card">
          <div className="card-title">표준 약관·인사말 (부록 A20)</div>
          <label className="field"><span>커버레터 / 인사말 (견적 상단)</span><textarea value={s.coverLetter || ""} onChange={(e) => setS({ ...s, coverLetter: e.target.value })} placeholder="안녕하세요, 견적을 보내드립니다…" /></label>
          <label className="field"><span>표준 계약조건</span><textarea value={terms.standard || ""} onChange={(e) => setS({ ...s, terms: { ...terms, standard: e.target.value } })} /></label>
          <label className="field"><span>A/S 조건</span><textarea value={terms.as || ""} onChange={(e) => setS({ ...s, terms: { ...terms, as: e.target.value } })} /></label>
          <label className="field"><span>면책 문구</span><textarea value={terms.disclaimer || ""} onChange={(e) => setS({ ...s, terms: { ...terms, disclaimer: e.target.value } })} /></label>
        </div>
      )}

      {tab === "rules" && (
        <>
          <div className="card">
            <div className="row"><div className="card-title" style={{ marginBottom: 0 }}>자동 할인 규칙 (부록 C)</div><div className="spacer" /><button className="btn sm soft" onClick={addRule}>+ 규칙</button></div>
            <div className="card-sub" style={{ marginTop: 8 }}>조건 충족 시 견적 작성에서 “자동할인 적용”으로 주입됩니다.</div>
            {rules.length === 0 && <div className="dim">규칙 없음</div>}
            {rules.map((r, i) => (
              <div className="card" key={r.id} style={{ background: "var(--fill-2)", boxShadow: "none", marginTop: 10 }}>
                <div className="grid cols-2">
                  <label className="field"><span>이름</span><input value={r.label} onChange={(e) => setRule(i, { ...r, label: e.target.value })} placeholder="예: 대형계약 할인" /></label>
                  <label className="field"><span>거래처 등급 조건</span>
                    <select value={r.when.clientGrade || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, clientGrade: (e.target.value || undefined) as "vip" | undefined } })}>
                      <option value="">무관</option><option value="vip">VIP</option>
                    </select>
                  </label>
                  <label className="field"><span>소계 ≥ (원)</span><input className="amt" value={r.when.subtotalGte || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, subtotalGte: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined } })} /></label>
                  <label className="field"><span>총수량 ≥</span><input className="amt" value={r.when.totalQtyGte || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, totalQtyGte: Number(e.target.value.replace(/[^0-9.]/g, "")) || undefined } })} /></label>
                  <label className="field"><span>기간 시작</span><input type="date" value={r.when.dateFrom || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, dateFrom: e.target.value || undefined } })} /></label>
                  <label className="field"><span>기간 종료</span><input type="date" value={r.when.dateTo || ""} onChange={(e) => setRule(i, { ...r, when: { ...r.when, dateTo: e.target.value || undefined } })} /></label>
                  <label className="field"><span>할인 방식</span>
                    <select value={r.then.mode} onChange={(e) => setRule(i, { ...r, then: { ...r.then, mode: e.target.value as AdjMode } })}>
                      <option value="pct">정률 %</option><option value="amt">정액 원</option>
                    </select>
                  </label>
                  <label className="field"><span>할인 값</span><input className="amt" value={r.then.value} onChange={(e) => setRule(i, { ...r, then: { ...r.then, value: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } })} /></label>
                </div>
                <div className="row">
                  <label className="row" style={{ gap: 6, cursor: "pointer" }} onClick={() => setRule(i, { ...r, stackable: !r.stackable })}>
                    <span className={`check ${r.stackable ? "on" : ""}`} style={{ width: 18, height: 18, borderRadius: 5, background: r.stackable ? "var(--toss-blue)" : "var(--fill)", color: "#fff", display: "grid", placeItems: "center" }}>{r.stackable ? <Check size={12} strokeWidth={3} /> : ""}</span>
                    다른 규칙과 중복 적용
                  </label>
                  <div className="spacer" />
                  <button className="btn sm danger" onClick={() => delRule(i)}>삭제</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="row"><div className="card-title" style={{ marginBottom: 0 }}>프로모션 코드 (부록 A19)</div><div className="spacer" /><button className="btn sm soft" onClick={addPromo}><Plus size={14} />코드</button></div>
            {promos.length === 0 && <div className="dim" style={{ marginTop: 8 }}>코드 없음</div>}
            {promos.map((p, i) => (
              <div className="row wrap" key={i} style={{ gap: 6, marginTop: 10 }}>
                <input placeholder="코드" value={p.code} onChange={(e) => setPromo(i, { ...p, code: e.target.value.toUpperCase() })} style={{ width: 130 }} />
                <input placeholder="설명" value={p.label} onChange={(e) => setPromo(i, { ...p, label: e.target.value })} style={{ maxWidth: 200 }} />
                <select value={p.mode} onChange={(e) => setPromo(i, { ...p, mode: e.target.value as AdjMode })} style={{ width: 100 }}>
                  <option value="pct">정률 %</option><option value="amt">정액 원</option>
                </select>
                <input className="amt" value={p.value} onChange={(e) => setPromo(i, { ...p, value: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} style={{ width: 90 }} />
                <button className="btn sm danger" onClick={() => delPromo(i)}><X size={14} /></button>
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
                    <div key={m.to} className="row" style={{ gap: 10, cursor: "pointer", padding: "10px 12px", background: "var(--fill-2)", borderRadius: "var(--r-md)" }} onClick={() => toggleMenu(m.to)}>
                      <span className="check" style={{ width: 20, height: 20, borderRadius: 6, background: on ? "var(--toss-blue)" : "var(--fill)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>{on && <Check size={13} strokeWidth={3} />}</span>
                      <span style={{ fontWeight: 600 }}>{m.label}</span>
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

      {tab === "team" && <Team embedded />}
      {tab === "integrations" && <IntegrationsPage embedded />}
      {tab === "activities" && <Activities embedded />}

      {!SELF_MANAGED.includes(tab) && (
        <div className="actionbar"><button className="btn primary" onClick={save}>저장</button></div>
      )}
    </>
  );
}
