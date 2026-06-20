// 블루프린트 §11 Store 계약의 localStorage 구현 (프로토타입/목업 모드)
import type {
  CatalogItem,
  Client,
  Quote,
  QuoteSummary,
  Settings,
} from "@/types";
import { CATALOG_SEED, calcTotals, quoteTitle, uuid } from "./quote";
import { DEFAULT_QTY_UNITS } from "./units";
import { shareUrlFor, type Store } from "./store.types";

const K = {
  quotes: "oad_quotes_v1",
  clients: "oad_clients_v1",
  catalog: "oad_catalog_v1",
  settings: "oad_settings_v1",
  seq: "oad_seq_v1",
  seeded: "oad_seeded_v1",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

// 부록 A19/C 견적번호 채번 규칙 커스텀 (prefix·dateFormat·seqDigits)
function fmtDateToken(format: string, d = new Date()): string {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return (format || "YYYYMMDD")
    .replace(/YYYY/g, String(Y))
    .replace(/MM/g, M)
    .replace(/DD/g, D);
}

function nextQuoteNo(): string {
  const settings = read<Settings>(K.settings, DEFAULT_SETTINGS);
  const numbering = settings.numbering || {};
  const prefix = numbering.prefix || "Q";
  const dateFormat = numbering.dateFormat || "YYYYMMDD";
  const seqDigits = numbering.seqDigits || 3;
  const dateTok = fmtDateToken(dateFormat);
  const seqKey = `${prefix}-${dateTok}`;
  const seq = read<Record<string, number>>(K.seq, {});
  const n = (seq[seqKey] || 0) + 1;
  seq[seqKey] = n;
  write(K.seq, seq);
  return `${prefix}-${dateTok}-${String(n).padStart(seqDigits, "0")}`;
}

// 알림센터 푸시 (부록 A22)
function pushNotification(n: {
  type: string;
  title: string;
  body: string;
  quote_id?: string;
}): void {
  const key = "oad_notifications_v1";
  const list = read<any[]>(key, []);
  list.push({
    id: uuid(),
    read: false,
    created_at: new Date().toISOString(),
    ...n,
  });
  write(key, list);
}

// 활동 로그 (부록 A26)
function logActivity(action: string, target_type: string, target_id: string, meta?: Record<string, unknown>): void {
  const key = "oad_activities_v1";
  const list = read<any[]>(key, []);
  let actor = "직원";
  try {
    const s = JSON.parse(localStorage.getItem("oad_session_v1") || "null");
    if (s?.name) actor = s.name;
  } catch {
    /* noop */
  }
  list.push({ id: uuid(), actor, action, target_type, target_id, meta: meta || {}, created_at: new Date().toISOString() });
  write(key, list);
}

// 제네릭 컬렉션 팩토리 (부록 B 엔티티)
function makeColl<T extends { id: string; created_at?: string }>(storageKey: string) {
  return {
    async list(): Promise<T[]> {
      return read<T[]>(storageKey, [])
        .slice()
        .sort((a, b) => ((b as any).created_at || "").localeCompare((a as any).created_at || ""));
    },
    async get(id: string): Promise<T | null> {
      return read<T[]>(storageKey, []).find((x) => x.id === id) || null;
    },
    async save(item: T): Promise<T> {
      const list = read<T[]>(storageKey, []);
      if (!item.id) {
        const created = { ...item, id: uuid(), created_at: item.created_at || new Date().toISOString() };
        list.push(created);
        write(storageKey, list);
        return created;
      }
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx < 0) list.push(item);
      else list[idx] = { ...list[idx], ...item };
      write(storageKey, list);
      return item;
    },
    async remove(id: string): Promise<true> {
      write(storageKey, read<T[]>(storageKey, []).filter((x) => x.id !== id));
      return true;
    },
  };
}

function quotesAll(): Quote[] {
  return read<Quote[]>(K.quotes, []);
}
function quotesSave(list: Quote[]): void {
  write(K.quotes, list);
}

const DEFAULT_SETTINGS: Settings = {
  supplier: { name: "", bizno: "", ceo: "", addr: "", tel: "", manager: "" },
  defaults: {
    validity: "발행일로부터 15일",
    deposit: "계약 시 50%",
    balance: "설치 완료 후 50%",
    as: "시공 후 1년 무상 A/S",
  },
  units: { dimension: "mm", quantityUnits: DEFAULT_QTY_UNITS },
};

function summarize(q: Quote): QuoteSummary {
  return {
    id: q.id,
    quote_no: q.quote_no,
    status: q.status,
    customer: q.customer?.name || "",
    customer_tel: q.customer?.tel || "",
    grand: calcTotals(q).grand,
    created_at: q.created_at,
    sent_at: q.sent_at,
    first_viewed_at: q.first_viewed_at,
    responded_at: q.responded_at,
    title: quoteTitle(q),
  };
}

export const localStore: Store = {
  async listQuotes() {
    return quotesAll()
      .slice()
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .map(summarize);
  },

  async getQuote(id) {
    return quotesAll().find((q) => q.id === id) || null;
  },

  async getQuoteByToken(token) {
    const q = quotesAll().find((x) => x.public_token === token);
    if (!q || q.status === "draft") return null; // §13 보안
    return q;
  },

  async saveQuote(input) {
    const list = quotesAll();
    const now = new Date().toISOString();
    if (!input.id) {
      // 신규 → draft, id·token·quote_no 생성, event created
      const created: Quote = {
        ...input,
        id: uuid(),
        public_token: uuid(),
        quote_no: input.quote_no || nextQuoteNo(),
        status: "draft",
        events: [{ type: "created", at: now }],
        created_at: now,
        updated_at: now,
      };
      list.push(created);
      quotesSave(list);
      logActivity("견적 작성", "quote", created.id, { quote_no: created.quote_no });
      return created;
    }
    // 수정 → 보존필드 유지
    const idx = list.findIndex((q) => q.id === input.id);
    if (idx < 0) throw new Error("견적을 찾을 수 없습니다.");
    const prev = list[idx];
    const merged: Quote = {
      ...input,
      public_token: prev.public_token,
      quote_no: prev.quote_no,
      status: prev.status,
      events: prev.events,
      customer_response: prev.customer_response,
      signature: prev.signature,
      created_at: prev.created_at,
      sent_at: prev.sent_at,
      first_viewed_at: prev.first_viewed_at,
      responded_at: prev.responded_at,
      updated_at: now,
    };
    list[idx] = merged;
    quotesSave(list);
    return merged;
  },

  async duplicateQuote(id) {
    const src = await this.getQuote(id);
    if (!src) throw new Error("원본 견적을 찾을 수 없습니다.");
    const now = new Date().toISOString();
    const copy: Quote = {
      ...src,
      id: uuid(),
      public_token: uuid(),
      quote_no: nextQuoteNo(),
      status: "draft",
      events: [{ type: "created", at: now }],
      customer_response: undefined,
      signature: undefined,
      sent_at: undefined,
      first_viewed_at: undefined,
      responded_at: undefined,
      created_at: now,
      updated_at: now,
    };
    const list = quotesAll();
    list.push(copy);
    quotesSave(list);
    return copy;
  },

  async markSent(id) {
    const list = quotesAll();
    const idx = list.findIndex((q) => q.id === id);
    if (idx < 0) throw new Error("견적을 찾을 수 없습니다.");
    const q = list[idx];
    const now = new Date().toISOString();
    if (!q.public_token) q.public_token = uuid();
    if (q.status === "draft") {
      q.status = "sent";
      q.sent_at = now;
      q.events = [...(q.events || []), { type: "sent", at: now }];
    } else if (!q.sent_at) {
      q.sent_at = now;
    }
    q.updated_at = now;
    list[idx] = q;
    quotesSave(list);
    logActivity("견적 발송", "quote", q.id, { quote_no: q.quote_no });
    return { token: q.public_token, url: shareUrlFor(q.public_token) };
  },

  async markViewed(token) {
    const list = quotesAll();
    const idx = list.findIndex((q) => q.public_token === token);
    if (idx < 0) return null;
    const q = list[idx];
    if (q.status === "draft") return null; // 무시
    const now = new Date().toISOString();
    const firstView = !q.first_viewed_at;
    if (q.status === "sent") q.status = "viewed";
    if (!q.first_viewed_at) q.first_viewed_at = now;
    q.events = [...(q.events || []), { type: "viewed", at: now }];
    q.updated_at = now;
    list[idx] = q;
    quotesSave(list);
    if (firstView) {
      pushNotification({
        type: "viewed",
        title: "고객이 견적을 열람했습니다",
        body: `${q.quote_no} · ${q.customer?.name || "고객"}`,
        quote_id: q.id,
      });
    }
    return true;
  },

  async markResponse(token, accept, name, signature) {
    const list = quotesAll();
    const idx = list.findIndex((q) => q.public_token === token);
    if (idx < 0) return null;
    const q = list[idx];
    if (q.status === "draft") return null;
    const now = new Date().toISOString();
    q.status = accept ? "accepted" : "rejected";
    q.responded_at = now;
    q.customer_response = { name, accepted: accept, at: now };
    if (accept && signature) q.signature = signature;
    q.events = [
      ...(q.events || []),
      { type: accept ? "accepted" : "rejected", at: now, meta: { name } },
    ];
    q.updated_at = now;
    list[idx] = q;
    quotesSave(list);
    pushNotification({
      type: accept ? "accepted" : "rejected",
      title: accept ? "고객이 견적을 수락했습니다 🎉" : "고객이 견적을 거절했습니다",
      body: `${q.quote_no} · ${name}`,
      quote_id: q.id,
    });
    return q;
  },

  async removeQuote(id) {
    quotesSave(quotesAll().filter((q) => q.id !== id));
    return true;
  },

  shareUrl(token) {
    return shareUrlFor(token);
  },

  async stats() {
    const list = quotesAll();
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const byStatus = { draft: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0 };
    let monthCount = 0,
      monthAmt = 0,
      sent = 0,
      accepted = 0,
      pipelineAmt = 0;
    for (const q of list) {
      byStatus[q.status]++;
      const grand = calcTotals(q).grand;
      if ((q.created_at || "").slice(0, 7) === ym) {
        monthCount++;
        monthAmt += grand;
      }
      if (q.status !== "draft") sent++; // 발송 이상
      if (q.status === "accepted") accepted++;
      if (q.status === "sent" || q.status === "viewed") pipelineAmt += grand;
    }
    const winRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;
    return {
      count: list.length,
      monthCount,
      monthAmt,
      sent,
      accepted,
      winRate,
      pipelineAmt,
      byStatus,
    };
  },

  async listClients() {
    return read<Client[]>(K.clients, [])
      .slice()
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },
  async getClient(id) {
    return read<Client[]>(K.clients, []).find((c) => c.id === id) || null;
  },
  async saveClient(c) {
    const list = read<Client[]>(K.clients, []);
    if (!c.id) {
      const created = { ...c, id: uuid(), created_at: new Date().toISOString() };
      list.push(created);
      write(K.clients, list);
      return created;
    }
    const idx = list.findIndex((x) => x.id === c.id);
    if (idx < 0) {
      list.push(c);
    } else {
      list[idx] = { ...list[idx], ...c };
    }
    write(K.clients, list);
    return c;
  },
  async removeClient(id) {
    write(
      K.clients,
      read<Client[]>(K.clients, []).filter((c) => c.id !== id),
    );
    return true;
  },

  async listCatalog() {
    return read<CatalogItem[]>(K.catalog, []);
  },
  async catalogMap() {
    const map: Record<string, CatalogItem> = {};
    for (const it of read<CatalogItem[]>(K.catalog, [])) {
      map[`${it.type}|${it.grade}`] = it;
    }
    return map;
  },
  async saveCatalogItem(r) {
    const list = read<CatalogItem[]>(K.catalog, []);
    if (!r.id) {
      const created = { ...r, id: uuid() };
      list.push(created);
      write(K.catalog, list);
      return created;
    }
    const idx = list.findIndex((x) => x.id === r.id);
    if (idx < 0) list.push(r);
    else list[idx] = { ...list[idx], ...r };
    write(K.catalog, list);
    return r;
  },
  async removeCatalogItem(id) {
    write(
      K.catalog,
      read<CatalogItem[]>(K.catalog, []).filter((c) => c.id !== id),
    );
    return true;
  },

  async getSettings() {
    return read<Settings>(K.settings, DEFAULT_SETTINGS);
  },
  async saveSettings(s) {
    write(K.settings, s);
    return s;
  },

  async seedIfEmpty() {
    if (localStorage.getItem(K.seeded)) return false;
    const list = read<CatalogItem[]>(K.catalog, []);
    for (const [type, unit, normal, premium, imported] of CATALOG_SEED) {
      list.push({ id: uuid(), type, grade: "일반", unit, price: normal, memo: "" });
      list.push({ id: uuid(), type, grade: "고급", unit, price: premium, memo: "" });
      list.push({ id: uuid(), type, grade: "수입", unit, price: imported, memo: "" });
    }
    write(K.catalog, list);
    localStorage.setItem(K.seeded, "1");
    return true;
  },

  // 부록 B 확장 컬렉션
  templates: makeColl("oad_templates_v1"),
  leads: makeColl("oad_leads_v1"),
  contracts: makeColl("oad_contracts_v1"),
  workorders: makeColl("oad_workorders_v1"),
  payments: makeColl("oad_payments_v1"),
  invoices: makeColl("oad_invoices_v1"),
  activities: makeColl("oad_activities_v1"),
  attachments: makeColl("oad_attachments_v1"),
  notifications: makeColl("oad_notifications_v1"),
  comments: makeColl("oad_comments_v1"),
  versions: makeColl("oad_versions_v1"),
  team: makeColl("oad_team_v1"),
  signage: makeColl("oad_signage_v1"),
  events: makeColl("oad_events_v1"),
};

// catalog.html "샘플 단가 다시 채우기": seeded 플래그 제거 후 재시드
export function reseedCatalog(): void {
  localStorage.removeItem(K.seeded);
}
