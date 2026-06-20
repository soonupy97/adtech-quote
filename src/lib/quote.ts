// 블루프린트 §8 마스터데이터 · §9 계산 로직 (절대 변경 금지)
import type {
  Adjustments,
  CostRow,
  Grade,
  Quote,
  QuoteItem,
  Totals,
} from "@/types";

// ── §8 마스터 데이터 ───────────────────────────────────────────────
export const ITEM_TYPES = [
  // 채널·전면 간판류
  "전면간판(채널)",
  "채널레터(LED)",
  "파나플렉스(후레임)",
  "갈바간판",
  "아크릴간판",
  "알루미늄복합판(ACP)",
  // LED·전광·네온
  "LED 전광판",
  "네온사인/플렉스네온",
  // 돌출·입체·지주
  "돌출간판(양면)",
  "입간판(스탠드)",
  "지주간판",
  // 시트·필름
  "시트지 시공",
  "윈도우시트(시선차단)",
  "차량 랩핑",
  // 현수막·배너
  "현수막(일반)",
  "메쉬현수막",
  "실사출력(배너)",
  "배너거치대(X배너)",
  // 기타
  "어닝(차양)",
  "기타",
] as const; // 20

export const GRADES: Grade[] = ["일반", "고급", "수입"];

export const PARTS = [
  "LED모듈",
  "SMPS",
  "컨트롤러",
  "전선(m)",
  "커넥터",
  "아크릴/플렉스",
  "시트지(㎡)",
  "각관/프레임",
  "앙카/피스",
  "브라켓",
] as const; // 10

export const CONSTRUCT = [
  "기존간판 철거",
  "폐기물 처리",
  "고소작업(스카이차)",
  "비계/아시바",
  "전기 인입·증설",
  "누전차단기/배선",
  "벽체 보강·타공",
  "도색/페인트",
  "방수·코킹",
  "운반·상하차",
  "야간/휴일 할증",
  "크레인(대형물)",
] as const; // 12

export const PERMIT = [
  "옥외광고물 허가/신고 대행",
  "면허세/허가수수료",
  "광고물 보증보험",
  "구조안전 확인",
  "전기 사용전 점검",
  "도로점용 허가",
] as const; // 6

export const ETC = ["디자인비", "출장비", "감리/현장조사", "기타"] as const; // 4

export const STATUS_LABEL: Record<string, string> = {
  draft: "작성",
  sent: "발송",
  viewed: "열람",
  accepted: "수락",
  rejected: "거절",
};

// §8.1 기본 단가표 시드: [종류, 단위, 일반, 고급, 수입]
export const CATALOG_SEED: [string, string, number, number, number][] = [
  // 채널·전면 간판류 (㎡)
  ["전면간판(채널)", "㎡", 160000, 220000, 300000],
  ["채널레터(LED)", "㎡", 280000, 380000, 520000],
  ["파나플렉스(후레임)", "㎡", 140000, 190000, 260000],
  ["갈바간판", "㎡", 95000, 130000, 170000],
  ["아크릴간판", "㎡", 85000, 130000, 190000],
  ["알루미늄복합판(ACP)", "㎡", 70000, 100000, 150000],
  // LED·전광·네온
  ["LED 전광판", "㎡", 700000, 1000000, 1500000],
  ["네온사인/플렉스네온", "m", 55000, 85000, 130000],
  // 돌출·입체·지주 (개)
  ["돌출간판(양면)", "개", 650000, 950000, 1500000],
  ["입간판(스탠드)", "개", 160000, 270000, 420000],
  ["지주간판", "개", 1200000, 1800000, 2800000],
  // 시트·필름 (㎡)
  ["시트지 시공", "㎡", 30000, 48000, 75000],
  ["윈도우시트(시선차단)", "㎡", 28000, 45000, 65000],
  ["차량 랩핑", "㎡", 45000, 70000, 110000],
  // 현수막·배너
  ["현수막(일반)", "㎡", 9000, 13000, 20000],
  ["메쉬현수막", "㎡", 13000, 19000, 28000],
  ["실사출력(배너)", "㎡", 15000, 22000, 33000],
  ["배너거치대(X배너)", "조", 18000, 30000, 50000],
  // 기타 (㎡)
  ["어닝(차양)", "㎡", 130000, 190000, 270000],
];

// ── §9 유틸 ───────────────────────────────────────────────────────
export function num(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[^0-9.-]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

export function won(n: number): string {
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function itemArea(it: QuoteItem): number {
  return round2(num(it.w) * num(it.h));
}

export function itemAmount(it: QuoteItem): number {
  return num(it.price) * num(it.qty);
}

// ── §9 합계 calcTotals ────────────────────────────────────────────
function sumChecked(rows: CostRow[]): number {
  return rows.filter((r) => r.checked).reduce((s, r) => s + num(r.cost), 0);
}

function sumAdj(rows: { mode: string; value: number }[], subtotal: number): number {
  return rows.reduce(
    (s, r) => s + (r.mode === "pct" ? (subtotal * num(r.value)) / 100 : num(r.value)),
    0,
  );
}

export function calcTotals(q: Quote): Totals {
  const items = (q.items || []).reduce((s, it) => s + itemAmount(it), 0);
  const construct = sumChecked(q.constructions || []);
  const permit = sumChecked(q.permits || []);
  const etc = sumChecked(q.etcCosts || []);
  const subtotal = items + construct + permit + etc;
  const adj: Adjustments = q.adjustments || { surcharge: [], discount: [] };
  // 할증/할인의 pct는 항상 subtotal 기준
  const surcharge = sumAdj(adj.surcharge || [], subtotal);
  const discount = sumAdj(adj.discount || [], subtotal);
  const supply = subtotal + surcharge - discount;
  const vat = supply * 0.1;
  const grand = supply + vat;
  return { items, construct, permit, etc, subtotal, surcharge, discount, supply, vat, grand };
}

// ── 팩토리: 고정 항목 행 생성 ────────────────────────────────────
export function makeConstructions(): CostRow[] {
  return CONSTRUCT.map((name) => ({ name, checked: false, cost: 0 }));
}
export function makePermits(): CostRow[] {
  return PERMIT.map((name) => ({ name, checked: false, cost: 0 }));
}
export function makeEtc(): CostRow[] {
  return ETC.map((name) => ({ name, checked: false, cost: 0 }));
}
export function makeItem(): QuoteItem {
  return { type: ITEM_TYPES[0], w: "", h: "", grade: "일반", price: 0, qty: 1, parts: {} };
}

// ── UUID (crypto.randomUUID 폴리필 포함) ──────────────────────────
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 신규 빈 견적 생성(설정의 공급자/기본값 주입은 호출부에서)
export function newQuote(): Quote {
  const now = new Date().toISOString();
  return {
    id: "",
    public_token: "",
    quote_no: "",
    status: "draft",
    supplier: { name: "", bizno: "", ceo: "", addr: "", tel: "", manager: "" },
    customer: { name: "", tel: "", addr: "" },
    site: { floor: "", height: "", road: "" },
    items: [makeItem()],
    constructions: makeConstructions(),
    permits: makePermits(),
    etcCosts: makeEtc(),
    adjustments: { surcharge: [], discount: [] },
    paymentTerms: { deposit: "", balance: "", as: "" },
    validity: "발행일로부터 15일",
    notes: "",
    events: [],
    created_at: now,
    updated_at: now,
  };
}

// 온보딩용 샘플 견적(빈 상태에서 1클릭 체험). 고객명 [샘플] 표식으로 식별·삭제가 쉽다.
export function sampleQuote(): Quote {
  const q = newQuote();
  q.customer = { name: "[샘플] 한빛상사", tel: "010-1234-5678", addr: "서울특별시 강남구 테헤란로 123" };
  q.site = { floor: "1층", height: "3.5", road: "대로변(왕복 4차선)" };
  q.items = [
    { type: "전면간판(채널)", w: "4", h: "0.9", grade: "고급", price: 790000, qty: 1, parts: {} },
    { type: "현수막(일반)", w: "5", h: "0.9", grade: "일반", price: 45000, qty: 4, parts: {} },
  ];
  // 시공·인허가·부대비용 — 매장 전면간판 설치 기준의 현실적 예시 금액
  const pick = (rows: CostRow[], costs: Record<string, number>): CostRow[] =>
    rows.map((r) => (r.name in costs ? { ...r, checked: true, cost: costs[r.name] } : r));
  q.constructions = pick(q.constructions, {
    "기존간판 철거": 150000,
    "고소작업(스카이차)": 250000,
    "전기 인입·증설": 120000,
    "운반·상하차": 80000,
  });
  q.permits = pick(q.permits, {
    "옥외광고물 허가/신고 대행": 200000,
    "면허세/허가수수료": 90000,
  });
  q.etcCosts = pick(q.etcCosts, {
    "디자인비": 150000,
    "출장비": 50000,
  });
  q.paymentTerms = { deposit: "계약금 50%", balance: "잔금 50% (설치 완료 후)", as: "1년 무상 A/S" };
  q.notes = "※ 앱 둘러보기용 샘플 견적입니다. 자유롭게 수정하거나 삭제하세요.";
  return q;
}

export function fmtDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

// 대표 품목 제목
export function quoteTitle(q: Quote): string {
  const first = q.items?.find((it) => it.type);
  if (!first) return "(품목 없음)";
  const extra = (q.items?.length || 0) - 1;
  return extra > 0 ? `${first.type} 외 ${extra}건` : first.type;
}
