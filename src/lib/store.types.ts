// 블루프린트 §11 Store API 계약 — 모든 메서드 Promise 반환(네트워크 교체 가능)
import type {
  Activity,
  AppNotification,
  Attachment,
  CalendarEvent,
  CatalogItem,
  Client,
  Contract,
  Invoice,
  Lead,
  Payment,
  Quote,
  QuoteComment,
  QuoteStatus,
  QuoteSummary,
  QuoteVersion,
  Settings,
  Signage,
  Stats,
  Template,
  TeamUser,
  WorkOrder,
} from "@/types";

// 제네릭 컬렉션 (부록 B 엔티티 공통 CRUD)
export interface Coll<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  save(item: T): Promise<T>;
  remove(id: string): Promise<true>;
}

export interface Store {
  // 견적
  listQuotes(): Promise<QuoteSummary[]>;
  getQuote(id: string): Promise<Quote | null>;
  getQuoteByToken(token: string): Promise<Quote | null>; // draft면 null
  saveQuote(quote: Quote): Promise<Quote>;
  duplicateQuote(id: string): Promise<Quote>;
  markSent(id: string): Promise<{ token: string; url: string }>;
  // 운영자 수동 상태 변경(칸반 드래그 등). 고객 행동 없이 상태만 갱신.
  setStatus(id: string, status: QuoteStatus): Promise<true>;
  markViewed(token: string): Promise<true | null>;
  markResponse(
    token: string,
    accept: boolean,
    name: string,
    signature?: string,
  ): Promise<Quote | null>;
  removeQuote(id: string): Promise<true>;
  shareUrl(token: string): string;

  // 통계
  stats(): Promise<Stats>;

  // 거래처
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | null>;
  saveClient(c: Client): Promise<Client>;
  removeClient(id: string): Promise<true>;

  // 품목·단가
  listCatalog(): Promise<CatalogItem[]>;
  catalogMap(): Promise<Record<string, CatalogItem>>;
  saveCatalogItem(r: CatalogItem): Promise<CatalogItem>;
  removeCatalogItem(id: string): Promise<true>;

  // 설정
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;

  // 가입 시 입력한 회사 정보(user_metadata.company)를 첫 로그인 때 settings.supplier 로 채움.
  // 이미 회사명이 설정돼 있으면 건드리지 않는다(멱등).
  hydrateCompany(): Promise<void>;

  // 시드
  seedIfEmpty(): Promise<boolean>;
  seedCatalog(): Promise<number>; // 누락된 기본 단가표(샘플) 항목 채우기 — 추가된 행 수 반환

  // 부록 B 확장 컬렉션 (P1~P3)
  templates: Coll<Template>;
  leads: Coll<Lead>;
  contracts: Coll<Contract>;
  workorders: Coll<WorkOrder>;
  payments: Coll<Payment>;
  invoices: Coll<Invoice>;
  activities: Coll<Activity>;
  attachments: Coll<Attachment>;
  notifications: Coll<AppNotification>;
  comments: Coll<QuoteComment>;
  versions: Coll<QuoteVersion>;
  team: Coll<TeamUser>;
  signage: Coll<Signage>;
  events: Coll<CalendarEvent>;
}

export function shareUrlFor(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://example.com";
  return `${origin}/view?t=${token}`;
}
