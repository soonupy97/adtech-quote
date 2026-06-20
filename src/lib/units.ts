// 단위 정의 · 환산 (§9 계산 로직은 변경하지 않고, 표시용 환산만 담당)
import type { QuoteItem } from "@/types";
import { num, round2 } from "./quote";

export type DimUnit = "m" | "cm" | "mm" | "㎡";

// 치수 입력 단위 → 미터 환산 계수 (㎡는 면적 단위라 환산 없이 표시 라벨용)
export const DIM_UNITS: { value: DimUnit; label: string; toMeter: number }[] = [
  { value: "mm", label: "mm (밀리미터)", toMeter: 0.001 },
  { value: "cm", label: "cm (센티미터)", toMeter: 0.01 },
  { value: "m", label: "m (미터)", toMeter: 1 },
  { value: "㎡", label: "㎡ (제곱미터)", toMeter: 1 },
];

// 신규 견적·설정 생성 시 기본 단위
export const DEFAULT_DIM_UNIT: DimUnit = "mm";
// 단위 미지정(레거시) 견적의 해석값 — 과거엔 m 기준이었으므로 면적 회귀 방지를 위해 m 유지
const LEGACY_DIM_UNIT: DimUnit = "m";

// 옥외광고에서 통용되는 수량 단위 기본 프리셋
export const DEFAULT_QTY_UNITS = ["㎡", "개", "m", "식", "조", "롤", "장", "본", "세트"];

export function dimFactor(unit?: DimUnit): number {
  return DIM_UNITS.find((u) => u.value === unit)?.toMeter ?? 1;
}

// 미지정 단위는 레거시(m)로 해석 — 저장된 값이 있으면 그대로 사용
export function dimLabel(unit?: DimUnit): DimUnit {
  return unit && DIM_UNITS.some((u) => u.value === unit) ? unit : LEGACY_DIM_UNIT;
}

// 가로·세로(입력 단위)를 ㎡ 면적으로 환산. 단가는 ㎡ 기준이므로 면적 표시는 항상 ㎡로 통일.
export function areaInSqm(it: Pick<QuoteItem, "w" | "h">, unit?: DimUnit): number {
  const f = dimFactor(unit);
  return round2(num(it.w) * f * (num(it.h) * f));
}

// 설정에서 수량 단위 목록을 안전하게 가져오기(빈 값이면 기본 프리셋)
export function quantityUnits(list?: string[]): string[] {
  const cleaned = (list || []).map((u) => u.trim()).filter(Boolean);
  return cleaned.length ? cleaned : DEFAULT_QTY_UNITS;
}
