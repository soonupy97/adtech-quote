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
  "전면간판(채널)",
  "채널레터",
  "후레임(파나플렉스)",
  "갈바간판",
  "LED 전광판",
  "아크릴 간판",
  "시트지 시공",
  "돌출간판(양면)",
  "입간판(스탠드)",
  "윈도우시트",
  "어닝(차양)",
  "현수막(일반)",
  "메쉬현수막",
  "배너(거치대)",
  "네온/플렉스네온",
  "기타",
] as const; // 16

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
  ["전면간판(채널)", "㎡", 150000, 200000, 280000],
  ["채널레터", "㎡", 250000, 350000, 500000],
  ["후레임(파나플렉스)", "㎡", 130000, 180000, 250000],
  ["갈바간판", "㎡", 90000, 120000, 160000],
  ["LED 전광판", "㎡", 600000, 900000, 1300000],
  ["아크릴 간판", "㎡", 80000, 120000, 180000],
  ["시트지 시공", "㎡", 30000, 45000, 70000],
  ["돌출간판(양면)", "개", 600000, 900000, 1400000],
  ["입간판(스탠드)", "개", 150000, 250000, 400000],
  ["윈도우시트", "㎡", 25000, 40000, 60000],
  ["어닝(차양)", "㎡", 120000, 180000, 250000],
  ["현수막(일반)", "㎡", 8000, 12000, 18000],
  ["메쉬현수막", "㎡", 12000, 18000, 25000],
  ["배너(거치대)", "개", 15000, 25000, 40000],
  ["네온/플렉스네온", "m", 50000, 80000, 120000],
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
