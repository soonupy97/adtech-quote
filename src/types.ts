// 블루프린트 §7 + 부록 B 데이터 모델

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected";
export type EventType = "created" | "sent" | "viewed" | "accepted" | "rejected";
export type Grade = "일반" | "고급" | "수입";
export type AdjMode = "pct" | "amt";

export interface Supplier {
  name: string;
  bizno: string;
  ceo: string;
  addr: string;
  tel: string;
  manager: string;
}

export interface Customer {
  name: string;
  tel: string;
  addr: string;
}

export interface Site {
  floor: string;
  height: string;
  road: string;
}

export interface QuoteItem {
  type: string;
  w: string; // 가로(m, 문자)
  h: string; // 세로(m, 문자)
  grade: Grade;
  price: number;
  qty: number;
  parts: Record<string, number>; // 부품 수량 메모(금액 비반영)
}

export interface CostRow {
  name: string;
  checked: boolean;
  cost: number;
}

export interface AdjustmentRow {
  label: string;
  mode: AdjMode;
  value: number;
}

export interface Adjustments {
  surcharge: AdjustmentRow[];
  discount: AdjustmentRow[];
}

export interface PaymentTerms {
  deposit: string;
  balance: string;
  as: string;
}

export interface QuoteEvent {
  type: EventType;
  at: string; // ISO
  meta?: Record<string, unknown>;
}

export interface CustomerResponse {
  name: string;
  accepted: boolean;
  at: string;
}

export interface Quote {
  id: string;
  public_token: string;
  quote_no: string;
  status: QuoteStatus;
  supplier: Supplier;
  customer: Customer;
  site: Site;
  items: QuoteItem[];
  constructions: CostRow[];
  permits: CostRow[];
  etcCosts: CostRow[];
  adjustments: Adjustments;
  paymentTerms: PaymentTerms;
  validity: string;
  notes: string;
  events: QuoteEvent[];
  customer_response?: CustomerResponse;
  signature?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  first_viewed_at?: string;
  responded_at?: string;
}

export interface QuoteSummary {
  id: string;
  quote_no: string;
  status: QuoteStatus;
  customer: string;
  customer_tel: string;
  grand: number;
  created_at: string;
  sent_at?: string;
  first_viewed_at?: string;
  responded_at?: string;
  title: string;
}

export interface Totals {
  items: number;
  construct: number;
  permit: number;
  etc: number;
  subtotal: number;
  surcharge: number;
  discount: number;
  supply: number;
  vat: number;
  grand: number;
}

export interface Stats {
  count: number;
  monthCount: number;
  monthAmt: number;
  sent: number;
  accepted: number;
  winRate: number;
  pipelineAmt: number;
  byStatus: Record<QuoteStatus, number>;
}

// 부록 B 확장: 여러 담당자/등급/태그 포함
export interface Contact {
  name: string;
  role: string;
  tel: string;
  email: string;
}

export interface Client {
  id: string;
  name: string;
  tel: string;
  addr: string;
  manager: string;
  memo: string;
  created_at: string;
  // 부록 B
  bizno?: string;
  grade?: "vip" | "normal";
  tags?: string[];
  contacts?: Contact[];
  history?: { at: string; type: string; memo: string }[];
}

export interface CatalogOption {
  name: string;
  add: number;
}
export interface PriceTier {
  minQty: number;
  price: number;
}

export interface CatalogItem {
  id: string;
  type: string;
  grade: Grade;
  unit: string;
  price: number;
  memo: string;
  // 부록 B
  cost?: number;
  options?: CatalogOption[];
  priceTiers?: PriceTier[];
  taxable?: boolean;
}

export interface Settings {
  supplier: Supplier;
  defaults: { validity: string; deposit: string; balance: string; as: string };
  // 부록 B 확장
  branding?: { logoUrl?: string; sealUrl?: string; themeColor?: string };
  tax?: { mode?: "taxable" | "free" | "zero"; vatIncluded?: boolean };
  numbering?: { prefix?: string; dateFormat?: string; seqDigits?: number };
  terms?: { standard?: string; as?: string; disclaimer?: string };
  discountRules?: DiscountRule[];
  promoCodes?: PromoCode[];
  approval?: { enabled?: boolean; amountGte?: number; discountPctGte?: number };
  integrations?: Integrations;
  myRole?: Role;
  coverLetter?: string;
  menuHidden?: string[]; // 사이드바에서 숨길 메뉴 경로(to) 목록
}

// 부록 C 자동 할인 규칙
export interface DiscountRule {
  id: string;
  label: string;
  when: {
    subtotalGte?: number;
    totalQtyGte?: number;
    clientGrade?: "vip";
    dateFrom?: string;
    dateTo?: string;
  };
  then: { mode: AdjMode; value: number };
  stackable: boolean;
}

export interface Session {
  name: string;
  email: string;
  provider: string;
  at: string;
}

// ─────────────────────────────────────────────────────────────
// 부록 A~E 확장 엔티티 (P1~P3)
// ─────────────────────────────────────────────────────────────

// 부록 B 견적 템플릿
export interface Template {
  id: string;
  name: string;
  memo: string;
  payload: {
    items: QuoteItem[];
    constructions: CostRow[];
    permits: CostRow[];
    etcCosts: CostRow[];
    adjustments: Adjustments;
    paymentTerms: PaymentTerms;
  };
  created_at: string;
}

// 부록 B 리드(문의)
export type LeadStage = "new" | "consult" | "quoted" | "won" | "lost";
export interface Lead {
  id: string;
  source: "phone" | "form" | "kakao" | "walk-in";
  customerName: string;
  tel: string;
  memo: string;
  stage: LeadStage;
  assignee_id?: string;
  quote_id?: string;
  created_at: string;
}

// 부록 B 계약
export interface ContractParty {
  role: "갑" | "을";
  name: string;
  signature?: string;
  signed_at?: string;
}
export interface Contract {
  id: string;
  quote_id: string;
  quote_no: string;
  customer: string;
  amount: number;
  terms: string;
  parties: ContractParty[];
  status: "draft" | "signed" | "void";
  created_at: string;
}

// 부록 B 작업지시서
export interface WorkOrder {
  id: string;
  quote_id: string;
  quote_no: string;
  site: Site;
  items: { type: string; spec: string; qty: number }[];
  constructions: string[];
  schedule: { installDate: string };
  crew: string;
  status: "ready" | "in_progress" | "done";
  created_at: string;
}

// 부록 B 입금/정산
export type PaymentKind = "deposit" | "interim" | "balance";
export interface Payment {
  id: string;
  quote_id: string;
  quote_no: string;
  customer: string;
  kind: PaymentKind;
  amount: number;
  due_date: string;
  paid_at?: string;
  paid: boolean;
  created_at: string;
}

// 부록 B 세금계산서
export interface Invoice {
  id: string;
  quote_id: string;
  quote_no: string;
  customer: string;
  supplyAmount: number;
  vat: number;
  total: number;
  issued_at?: string;
  status: "draft" | "issued" | "void";
  provider: "popbill" | "barobill" | "manual";
  created_at: string;
}

// 부록 B 사용자/권한
export type Role = "admin" | "sales" | "viewer";
export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

// 부록 B 활동 로그(감사)
export interface Activity {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

// 부록 B 첨부
export interface Attachment {
  id: string;
  quote_id: string;
  kind: "photo" | "drawing" | "mockup";
  url: string; // dataURL
  name: string;
  created_at: string;
}

// 광고물(설치자산) 관리 — 수주된 간판/현수막의 게시기간·허가 갱신 추적
export interface Signage {
  id: string;
  name: string; // 광고물명/간판명
  customer: string; // 고객/거래처
  address: string; // 설치 위치
  type: string; // 광고물 종류(ITEM_TYPES)
  installDate: string; // 설치일
  permitExpiry: string; // 표시기간/허가 만료일
  quote_id?: string; // 연결 견적(선택)
  status: "active" | "removed"; // 게시중/철거됨 (만료 임박은 permitExpiry로 파생)
  memo: string;
  created_at: string;
}

// 알림센터
export type NotiType = "viewed" | "accepted" | "rejected" | "comment" | "expiring" | "reminder";
export interface AppNotification {
  id: string;
  type: NotiType;
  title: string;
  body: string;
  quote_id?: string;
  read: boolean;
  created_at: string;
}

// 고객 코멘트/재협상 스레드
export interface QuoteComment {
  id: string;
  quote_id: string;
  author: "customer" | "staff";
  name: string;
  body: string;
  created_at: string;
}

// 견적 버전 스냅샷
export interface QuoteVersion {
  id: string;
  quote_id: string;
  version: number;
  snapshot: Quote;
  created_at: string;
}

// 프로모션 코드 (부록 A19)
export interface PromoCode {
  code: string;
  label: string;
  mode: AdjMode;
  value: number;
}

// 연동 설정 (부록 A27)
export interface Integrations {
  slackWebhook?: string;
  emailFrom?: string;
  kakaoSenderKey?: string;
  calendarUrl?: string;
  zapierWebhook?: string;
  apiKey?: string;
}
