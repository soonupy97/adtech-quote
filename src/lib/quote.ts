// 블루프린트 §8 마스터데이터 · §9 계산 로직 (절대 변경 금지)
import type {
  Adjustments,
  CostRow,
  Quote,
  QuoteItem,
  Template,
  Totals,
} from "@/types";

// ── §8 마스터 데이터 ───────────────────────────────────────────────
// 가장 많이 쓰는 핵심 품목만. 나머지는 종류 칸에서 검색/직접입력으로 추가 가능.
export const ITEM_TYPES = [
  "전면간판(채널)",
  "채널레터(LED)",
  "LED 전광판",
  "돌출간판(양면)",
  "입간판(스탠드)",
  "현수막(일반)",
  "실사출력(배너)",
  "시트지 시공",
  "기타",
] as const; // 9

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

// §8.1 기본 단가표 시드: [종류, 단위, 일반, 고급, 수입] — ITEM_TYPES 핵심 품목과 동일하게 유지
export const CATALOG_SEED: [string, string, number, number, number][] = [
  ["전면간판(채널)", "㎡", 160000, 220000, 300000],
  ["채널레터(LED)", "㎡", 280000, 380000, 520000],
  ["LED 전광판", "㎡", 700000, 1000000, 1500000],
  ["돌출간판(양면)", "개", 650000, 950000, 1500000],
  ["입간판(스탠드)", "개", 160000, 270000, 420000],
  ["현수막(일반)", "㎡", 9000, 13000, 20000],
  ["실사출력(배너)", "㎡", 15000, 22000, 33000],
  ["시트지 시공", "㎡", 30000, 48000, 75000],
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

// ── 견적번호 채번 규칙(부록 A19) ─────────────────────────────────
// 설정(접두어·날짜형식·자릿수)을 실제 채번과 미리보기에서 공유하기 위한 순수 헬퍼.
export interface NumberingRule { prefix?: string; dateFormat?: string; seqDigits?: number }

// 날짜형식 토큰(YYYY·YY·MM·DD)을 날짜로 치환. YYYY를 YY보다 먼저 바꿔야 함.
export function formatDateKey(fmt: string, d = new Date()): string {
  const YYYY = String(d.getFullYear());
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  return fmt
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YYYY.slice(-2))
    .replace(/MM/g, MM)
    .replace(/DD/g, DD);
}

export function quoteNoDigits(n?: NumberingRule): number {
  return Math.min(Math.max(Math.floor(Number(n?.seqDigits)) || 3, 1), 10);
}

// 시퀀스를 제외한 접두부(예: "Q-20260702-"). 날짜형식이 비면 접두어만.
export function quoteNoPrefix(n?: NumberingRule, d = new Date()): string {
  const pfx = (n?.prefix ?? "Q").trim() || "Q";
  const dateKey = formatDateKey(n?.dateFormat ?? "YYYYMMDD", d);
  return dateKey ? `${pfx}-${dateKey}-` : `${pfx}-`;
}

export function previewQuoteNo(n?: NumberingRule, seq = 1, d = new Date()): string {
  return `${quoteNoPrefix(n, d)}${String(seq).padStart(quoteNoDigits(n), "0")}`;
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
  return { type: ITEM_TYPES[0], w: "", h: "", price: 0, qty: 1, parts: {} };
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
    supplier: { name: "", bizno: "", ceo: "", uptae: "", upjong: "", addr: "", tel: "", manager: "" },
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
    { type: "전면간판(채널)", w: "4", h: "0.9", price: 790000, qty: 1, parts: {} },
    { type: "현수막(일반)", w: "5", h: "0.9", price: 45000, qty: 4, parts: {} },
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

// 온보딩용 샘플 템플릿(빈 상태에서 1클릭 체험). 매장 전면간판 표준 시공 세트.
// 고객·현장 정보는 템플릿에 담기지 않으므로 sampleQuote 의 품목·시공·비용 세트만 재사용한다.
export function sampleTemplate(): Template {
  const q = sampleQuote();
  return {
    id: "",
    name: "[샘플] 매장 전면간판 표준 세트",
    memo: "전면간판(채널)+현수막 품목에 표준 시공·인허가·부대비용을 묶은 예시입니다. 자유롭게 수정·삭제하세요.",
    created_at: "",
    payload: {
      items: q.items,
      constructions: q.constructions,
      permits: q.permits,
      etcCosts: q.etcCosts,
      adjustments: q.adjustments,
      paymentTerms: q.paymentTerms,
    },
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

// 상대 시간("방금 전" / "3시간 전" / "어제") — 알림 피드 등 좁은 영역용.
// 7일을 넘어가면 절대 날짜(fmtDate)로 폴백한다.
export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  return fmtDate(iso);
}

// 대표 품목 제목
export function quoteTitle(q: Quote): string {
  const first = q.items?.find((it) => it.type);
  if (!first) return "(품목 없음)";
  const extra = (q.items?.length || 0) - 1;
  return extra > 0 ? `${first.type} 외 ${extra}건` : first.type;
}
