// 블루프린트 §14.3 Store 계약의 Supabase 구현 (동일 시그니처)
import type {
  CatalogItem,
  Client,
  Quote,
  QuoteEvent,
  QuoteSummary,
  Settings,
} from "@/types";
import { CATALOG_SEED, calcTotals, quoteTitle, uuid } from "./quote";
import { DEFAULT_QTY_UNITS } from "./units";
import { shareUrlFor, type Store } from "./store.types";
import { supabase } from "./supabaseClient";

function sb() {
  if (!supabase) throw new Error("Supabase 가 설정되지 않았습니다.");
  return supabase;
}

// 부록 B 확장 엔티티: app_collections(jsonb) 기반 제네릭 CRUD
function makeColl<T extends { id: string; created_at?: string }>(collection: string) {
  return {
    async list(): Promise<T[]> {
      const { data, error } = await sb()
        .from("app_collections")
        .select("id, data, created_at")
        .eq("collection", collection)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r.data, id: r.id, created_at: r.created_at })) as T[];
    },
    async get(id: string): Promise<T | null> {
      const { data } = await sb()
        .from("app_collections")
        .select("id, data, created_at")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      return { ...(data as any).data, id: data.id, created_at: data.created_at } as T;
    },
    async save(item: T): Promise<T> {
      const { id, created_at, ...rest } = item as any;
      void created_at;
      if (!id) {
        const { data, error } = await sb()
          .from("app_collections")
          .insert({ collection, data: rest })
          .select("id, data, created_at")
          .single();
        if (error) throw error;
        return { ...data.data, id: data.id, created_at: data.created_at } as T;
      }
      const { error } = await sb().from("app_collections").update({ data: rest }).eq("id", id);
      if (error) throw error;
      return item;
    },
    async remove(id: string): Promise<true> {
      const { error } = await sb().from("app_collections").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
  };
}

// DB(snake) → 앱(Quote) 매핑
function rowToQuote(r: any, events: QuoteEvent[] = []): Quote {
  return {
    id: r.id,
    public_token: r.public_token,
    quote_no: r.quote_no || "",
    status: r.status,
    supplier: r.supplier || {},
    customer: r.customer || {},
    site: r.site || {},
    items: r.items || [],
    constructions: r.constructions || [],
    permits: r.permits || [],
    etcCosts: r.etc_costs || [],
    adjustments: r.adjustments || { surcharge: [], discount: [] },
    paymentTerms: r.payment_terms || { deposit: "", balance: "", as: "" },
    validity: r.validity || "",
    notes: r.notes || "",
    dimUnit: r.dim_unit || undefined,
    events,
    customer_response: r.customer_response || undefined,
    signature: r.signature || undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
    sent_at: r.sent_at || undefined,
    first_viewed_at: r.first_viewed_at || undefined,
    responded_at: r.responded_at || undefined,
  };
}

function quoteToRow(q: Quote) {
  return {
    quote_no: q.quote_no,
    status: q.status,
    supplier: q.supplier,
    customer: q.customer,
    site: q.site,
    items: q.items,
    constructions: q.constructions,
    permits: q.permits,
    etc_costs: q.etcCosts,
    adjustments: q.adjustments,
    totals: calcTotals(q),
    payment_terms: q.paymentTerms,
    validity: q.validity,
    notes: q.notes,
    dim_unit: q.dimUnit ?? null,
  };
}

function ymd(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

async function nextQuoteNo(): Promise<string> {
  const key = ymd();
  const prefix = `Q-${key}-`;
  const { data } = await sb()
    .from("quotes")
    .select("quote_no")
    .like("quote_no", `${prefix}%`);
  let max = 0;
  for (const row of data || []) {
    const n = parseInt(String(row.quote_no).slice(prefix.length), 10);
    if (n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function loadEvents(quoteId: string): Promise<QuoteEvent[]> {
  const { data } = await sb()
    .from("quote_events")
    .select("event_type, created_at, meta")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });
  return (data || []).map((e: any) => ({
    type: e.event_type,
    at: e.created_at,
    meta: e.meta || {},
  }));
}

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

const DEFAULT_SETTINGS: Settings = {
  supplier: { name: "", bizno: "", ceo: "", addr: "", tel: "", manager: "" },
  defaults: {
    validity: "발행일로부터 15일",
    deposit: "계약 시 50%",
    balance: "설치 완료 후 50%",
    as: "시공 후 1년 무상 A/S",
  },
  units: { dimension: "mm", quantityUnits: DEFAULT_QTY_UNITS },
  // 기본적으로 견적서와 무관한 메뉴는 숨김(견적·템플릿·품목단가·거래처 + 핵심메뉴만 노출)
  menuHidden: ["/leads", "/contracts", "/workorders", "/signage", "/calendar", "/payments", "/invoices", "/reports"],
};

export const supabaseStore: Store = {
  async listQuotes() {
    const { data, error } = await sb()
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => summarize(rowToQuote(r)));
  },

  async getQuote(id) {
    const { data, error } = await sb().from("quotes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToQuote(data, await loadEvents(id));
  },

  async getQuoteByToken(token) {
    // 익명 허용 RPC (draft 차단)
    const { data, error } = await sb().rpc("get_quote_by_token", { p_token: token });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return rowToQuote(row);
  },

  async saveQuote(input) {
    if (!input.id) {
      const quote_no = input.quote_no || (await nextQuoteNo());
      const { data, error } = await sb()
        .from("quotes")
        .insert({ ...quoteToRow({ ...input, quote_no }), status: "draft" })
        .select()
        .single();
      if (error) throw error;
      await sb()
        .from("quote_events")
        .insert({ quote_id: data.id, event_type: "created" });
      return rowToQuote(data, await loadEvents(data.id));
    }
    const { data, error } = await sb()
      .from("quotes")
      .update({ ...quoteToRow(input), updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return rowToQuote(data, await loadEvents(data.id));
  },

  async duplicateQuote(id) {
    const src = await this.getQuote(id);
    if (!src) throw new Error("원본 견적을 찾을 수 없습니다.");
    const quote_no = await nextQuoteNo();
    const { data, error } = await sb()
      .from("quotes")
      .insert({ ...quoteToRow({ ...src, quote_no }), status: "draft" })
      .select()
      .single();
    if (error) throw error;
    await sb().from("quote_events").insert({ quote_id: data.id, event_type: "created" });
    return rowToQuote(data, await loadEvents(data.id));
  },

  async markSent(id) {
    const now = new Date().toISOString();
    const { data, error } = await sb()
      .from("quotes")
      .update({ status: "sent", sent_at: now, updated_at: now })
      .eq("id", id)
      .eq("status", "draft")
      .select()
      .maybeSingle();
    if (error) throw error;
    let token: string;
    if (data) {
      token = data.public_token;
      await sb().from("quote_events").insert({ quote_id: id, event_type: "sent" });
    } else {
      // 이미 발송 이상 → 토큰만 조회
      const { data: cur } = await sb()
        .from("quotes")
        .select("public_token")
        .eq("id", id)
        .single();
      token = cur!.public_token;
    }
    return { token, url: shareUrlFor(token) };
  },

  // 운영자 수동 상태 변경(칸반 드래그). 고객 응답 RPC와 달리 상태/타임스탬프만 갱신.
  async setStatus(id, status) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (status === "accepted" || status === "rejected") patch.responded_at = now;
    if (status === "draft") { patch.responded_at = null; patch.first_viewed_at = null; }
    const { error } = await sb().from("quotes").update(patch).eq("id", id);
    if (error) throw error;
    if (status === "accepted" || status === "rejected") {
      await sb().from("quote_events").insert({ quote_id: id, event_type: status });
    }
    return true;
  },

  async markViewed(token) {
    const { error } = await sb().rpc("mark_viewed", { p_token: token });
    if (error) return null;
    return true;
  },

  async markResponse(token, accept, name, signature) {
    const { data, error } = await sb().rpc("mark_response", {
      p_token: token,
      p_accept: accept,
      p_name: name,
      p_signature: signature || null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return rowToQuote(row);
  },

  async removeQuote(id) {
    const { error } = await sb().from("quotes").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  shareUrl(token) {
    return shareUrlFor(token);
  },

  async stats() {
    const quotes = await this.listQuotes();
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const byStatus = { draft: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0 };
    let monthCount = 0,
      monthAmt = 0,
      sent = 0,
      accepted = 0,
      pipelineAmt = 0;
    for (const q of quotes) {
      byStatus[q.status]++;
      if ((q.created_at || "").slice(0, 7) === ym) {
        monthCount++;
        monthAmt += q.grand;
      }
      if (q.status !== "draft") sent++;
      if (q.status === "accepted") accepted++;
      if (q.status === "sent" || q.status === "viewed") pipelineAmt += q.grand;
    }
    const winRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;
    return { count: quotes.length, monthCount, monthAmt, sent, accepted, winRate, pipelineAmt, byStatus };
  },

  async listClients() {
    const { data, error } = await sb()
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Client[];
  },
  async getClient(id) {
    const { data } = await sb().from("clients").select("*").eq("id", id).maybeSingle();
    return (data as Client) || null;
  },
  async saveClient(c) {
    if (!c.id) {
      const { id: _omit, ...rest } = c;
      void _omit;
      const { data, error } = await sb().from("clients").insert(rest).select().single();
      if (error) throw error;
      return data as Client;
    }
    const { id, created_at: _ca, ...rest } = c;
    void _ca;
    const { data, error } = await sb()
      .from("clients")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  },
  async removeClient(id) {
    const { error } = await sb().from("clients").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async listCatalog() {
    const { data, error } = await sb()
      .from("catalog_items")
      .select("*")
      .order("type", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      type: r.type,
      grade: r.grade,
      unit: r.unit,
      price: Number(r.price) || 0,
      memo: r.memo || "",
      cost: r.cost != null ? Number(r.cost) : undefined,
      options: r.options || [],
      priceTiers: r.price_tiers || [],
      taxable: r.taxable ?? true,
    })) as CatalogItem[];
  },
  async catalogMap() {
    const list = await this.listCatalog();
    const map: Record<string, CatalogItem> = {};
    for (const it of list) map[`${it.type}|${it.grade}`] = it;
    return map;
  },
  async saveCatalogItem(r) {
    const row = {
      type: r.type,
      grade: r.grade,
      unit: r.unit,
      price: r.price,
      memo: r.memo,
      cost: r.cost ?? null,
      taxable: r.taxable ?? true,
    };
    if (!r.id) {
      const { data, error } = await sb()
        .from("catalog_items")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return { ...r, id: data.id };
    }
    const { error } = await sb().from("catalog_items").update(row).eq("id", r.id);
    if (error) throw error;
    return r;
  },
  async removeCatalogItem(id) {
    const { error } = await sb().from("catalog_items").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async getSettings() {
    const { data } = await sb().from("settings").select("*").maybeSingle();
    if (!data) return DEFAULT_SETTINGS;
    return {
      supplier: data.supplier || DEFAULT_SETTINGS.supplier,
      defaults: data.defaults || DEFAULT_SETTINGS.defaults,
      branding: data.branding || {},
      tax: data.tax || {},
      numbering: data.numbering || {},
      terms: data.terms || {},
      discountRules: data.discount_rules || [],
      promoCodes: data.promo_codes || [],
      approval: data.approval || {},
      coverLetter: data.cover_letter ?? "",
      units: data.units || DEFAULT_SETTINGS.units,
      menuHidden: data.menu_hidden ?? DEFAULT_SETTINGS.menuHidden,
    } as Settings;
  },
  async saveSettings(s) {
    const { data: user } = await sb().auth.getUser();
    const owner_id = user.user?.id;
    const { error } = await sb().from("settings").upsert({
      owner_id,
      supplier: s.supplier,
      defaults: s.defaults,
      branding: s.branding || {},
      tax: s.tax || {},
      numbering: s.numbering || {},
      terms: s.terms || {},
      discount_rules: s.discountRules || [],
      promo_codes: s.promoCodes || [],
      approval: s.approval || {},
      cover_letter: s.coverLetter ?? "",
      units: s.units || {},
      menu_hidden: s.menuHidden || [],
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return s;
  },

  templates: makeColl("templates"),
  leads: makeColl("leads"),
  contracts: makeColl("contracts"),
  workorders: makeColl("workorders"),
  payments: makeColl("payments"),
  invoices: makeColl("invoices"),
  activities: makeColl("activities"),
  attachments: makeColl("attachments"),
  notifications: makeColl("notifications"),
  comments: makeColl("comments"),
  versions: makeColl("versions"),
  team: makeColl("team"),
  signage: makeColl("signage"),
  events: makeColl("events"),

  async seedIfEmpty() {
    const { count } = await sb()
      .from("catalog_items")
      .select("id", { count: "exact", head: true });
    if ((count || 0) > 0) return false;
    const added = await this.seedCatalog();
    return added > 0;
  },
  async seedCatalog() {
    // 샘플이므로 한 종류당 1행(일반 등급)만. 기존 단가표를 모두 비우고 새로 채운다(이름 중복 제거).
    const { data: user } = await sb().auth.getUser();
    const owner_id = user.user?.id;
    const { error: delErr } = await sb()
      .from("catalog_items")
      .delete()
      .not("id", "is", null);
    if (delErr) throw delErr;
    const rows = CATALOG_SEED.map(([type, unit, normal]) => ({
      id: uuid(), type, grade: "일반", unit, price: normal, memo: "", owner_id,
    }));
    const { error } = await sb().from("catalog_items").insert(rows);
    if (error) throw error;
    return rows.length;
  },
};
