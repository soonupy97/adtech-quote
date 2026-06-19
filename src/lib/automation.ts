// 부록 A19·C 자동화 규칙: 자동할인 엔진 · 세금모드 · 마진 · 유효기간 만료 · 옵션/구간단가
import type {
  CatalogItem,
  DiscountRule,
  Quote,
  QuoteItem,
  Settings,
  Totals,
} from "@/types";
import { calcTotals, num } from "./quote";

// ── 옵션/구간단가 반영 effective 단가 (부록 A19) ──────────────────
// 종류·등급으로 catalog 항목을 찾아 옵션 가산 + 수량 구간 단가를 적용한 단가를 계산
export function effectivePrice(
  item: QuoteItem,
  catalog: Record<string, CatalogItem>,
  selectedOptions: string[] = [],
): number {
  const c = catalog[`${item.type}|${item.grade}`];
  if (!c) return num(item.price);
  let base = c.price;
  // 수량 구간별 단가(볼륨 디스카운트): 충족하는 가장 큰 minQty 의 price
  const tiers = (c.priceTiers || []).filter((t) => num(item.qty) >= t.minQty).sort((a, b) => b.minQty - a.minQty);
  if (tiers.length) base = tiers[0].price;
  // 옵션 가산
  const add = (c.options || [])
    .filter((o) => selectedOptions.includes(o.name))
    .reduce((s, o) => s + o.add, 0);
  return base + add;
}

// ── 마진/원가 (부록 A19) ─────────────────────────────────────────
export interface MarginInfo {
  cost: number;
  margin: number; // 이익액
  marginRate: number; // 마진율 % (이익/판매)
  costRate: number; // 원가율 %
}
export function calcMargin(q: Quote, catalog: Record<string, CatalogItem>): MarginInfo {
  let cost = 0;
  let sales = 0;
  for (const it of q.items) {
    const c = catalog[`${it.type}|${it.grade}`];
    const unitCost = c?.cost ?? 0;
    cost += unitCost * num(it.qty);
    sales += num(it.price) * num(it.qty);
  }
  const margin = sales - cost;
  const marginRate = sales > 0 ? Math.round((margin / sales) * 100) : 0;
  const costRate = sales > 0 ? Math.round((cost / sales) * 100) : 0;
  return { cost, margin, marginRate, costRate };
}

// 목표 마진 역산 → 판매단가 (부록 A19)
export function priceForTargetMargin(unitCost: number, targetMarginPct: number): number {
  const m = Math.min(Math.max(targetMarginPct, 0), 99) / 100;
  if (m <= 0) return unitCost;
  return Math.round(unitCost / (1 - m));
}

// ── 세금 모드 (부록 A19) ─────────────────────────────────────────
// 과세(taxable)/면세(free)/영세(zero), 부가세 포함(vatIncluded)/별도
export function calcTotalsWithTax(q: Quote, settings?: Settings): Totals {
  const t = calcTotals(q); // §9 원본 (변경 없음)
  const tax = settings?.tax;
  if (!tax || (tax.mode ?? "taxable") === "taxable") {
    if (tax?.vatIncluded) {
      // 공급가에 VAT 포함되어 있다고 보고 분리 표시
      const supplyExVat = Math.round(t.supply / 1.1);
      const vat = t.supply - supplyExVat;
      return { ...t, supply: supplyExVat, vat, grand: t.supply };
    }
    return t; // 기본 = P0 동일 (회귀 보존)
  }
  // 면세/영세 → VAT 0
  return { ...t, vat: 0, grand: t.supply };
}

// ── 자동 할인 규칙 엔진 (부록 C) ─────────────────────────────────
export function evaluateDiscountRules(
  q: Quote,
  rules: DiscountRule[],
  clientGrade?: "vip" | "normal",
  today = new Date(),
): { rule: DiscountRule; amount: number }[] {
  const t = calcTotals(q);
  const totalQty = q.items.reduce((s, it) => s + num(it.qty), 0);
  const todayStr = today.toISOString().slice(0, 10);
  const matched: { rule: DiscountRule; amount: number }[] = [];
  for (const r of rules || []) {
    const w = r.when || {};
    if (w.subtotalGte != null && t.subtotal < w.subtotalGte) continue;
    if (w.totalQtyGte != null && totalQty < w.totalQtyGte) continue;
    if (w.clientGrade && clientGrade !== w.clientGrade) continue;
    if (w.dateFrom && todayStr < w.dateFrom) continue;
    if (w.dateTo && todayStr > w.dateTo) continue;
    const amount = r.then.mode === "pct" ? (t.subtotal * r.then.value) / 100 : r.then.value;
    matched.push({ rule: r, amount });
  }
  // 중복 불가(stackable=false) 규칙이 섞이면, 비중복 중 가장 큰 1개 + 중복가능 모두
  const stackable = matched.filter((m) => m.rule.stackable);
  const nonStackable = matched.filter((m) => !m.rule.stackable);
  const result = [...stackable];
  if (nonStackable.length) {
    nonStackable.sort((a, b) => b.amount - a.amount);
    result.push(nonStackable[0]);
  }
  return result;
}

// ── 유효기간 자동 만료 (부록 C) ──────────────────────────────────
// validity 문자열에서 "NN일" 추출 → sent_at + N일 경과 & 미수락 이면 expired(파생)
export function parseValidityDays(validity: string): number {
  const m = (validity || "").match(/(\d+)\s*일/);
  return m ? parseInt(m[1], 10) : 0;
}
export function isExpired(q: Quote, now = new Date()): boolean {
  if (q.status === "accepted" || q.status === "rejected" || q.status === "draft") return false;
  const days = parseValidityDays(q.validity);
  if (!days || !q.sent_at) return false;
  const exp = new Date(q.sent_at).getTime() + days * 86400000;
  return now.getTime() > exp;
}
export function expiryDate(q: Quote): string | null {
  const days = parseValidityDays(q.validity);
  if (!days || !q.sent_at) return null;
  return new Date(new Date(q.sent_at).getTime() + days * 86400000).toISOString();
}

// ── 팔로업 리마인더 (부록 A21/C) ─────────────────────────────────
// sent 후 N일 미열람, viewed 후 M일 미응답
export function reminderFor(q: Quote, sentDays = 3, viewedDays = 3, now = new Date()): string | null {
  const D = 86400000;
  if (q.status === "sent" && q.sent_at) {
    const days = Math.floor((now.getTime() - new Date(q.sent_at).getTime()) / D);
    if (days >= sentDays) return `발송 후 ${days}일째 미열람 — 후속 연락 필요`;
  }
  if (q.status === "viewed" && q.first_viewed_at) {
    const days = Math.floor((now.getTime() - new Date(q.first_viewed_at).getTime()) / D);
    if (days >= viewedDays) return `열람 후 ${days}일째 미응답 — 후속 연락 필요`;
  }
  return null;
}

// ── 승인 워크플로 (부록 D / A26) ─────────────────────────────────
export function needsApproval(q: Quote, settings?: Settings): boolean {
  const a = settings?.approval;
  if (!a?.enabled) return false;
  const t = calcTotals(q);
  if (a.amountGte != null && t.grand >= a.amountGte) return true;
  if (a.discountPctGte != null && t.subtotal > 0) {
    const pct = (t.discount / t.subtotal) * 100;
    if (pct >= a.discountPctGte) return true;
  }
  return false;
}
