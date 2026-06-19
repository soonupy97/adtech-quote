import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = "http://localhost:5173";
const out = "C:/Project/adtech-quote/.shots";
mkdirSync(out, { recursive: true });

const now = Date.now();
const iso = (offDays = 0) => new Date(now - offDays * 86400000).toISOString();

function quote(o) {
  return {
    id: o.id, public_token: o.id + "-tok", quote_no: o.no, status: o.status,
    supplier: { name: "캐디안 광고", bizno: "123-45-67890", ceo: "대표", addr: "서울시 강남구", tel: "02-000-0000", manager: "홍길동" },
    customer: { name: o.cust, tel: o.tel || "010-1234-5678", addr: "서울시" },
    site: { floor: "2층 정면", height: "4m", road: "8m 도로" },
    items: o.items,
    constructions: (o.constructions || []).map((c) => ({ name: c[0], checked: true, cost: c[1] })),
    permits: [], etcCosts: [],
    adjustments: { surcharge: o.sur || [], discount: o.dis || [] },
    paymentTerms: { deposit: "계약 시 50%", balance: "설치 완료 후 50%", as: "1년 무상" },
    validity: "발행일로부터 15일", notes: "",
    events: o.events || [{ type: "created", at: iso(5) }],
    customer_response: o.resp, signature: o.sig,
    created_at: iso(o.age || 1), updated_at: iso(0), sent_at: o.sent_at, first_viewed_at: o.viewed_at, responded_at: o.responded_at,
  };
}

const seed = {
  oad_session_v1: { name: "홍길동", email: "demo@cadian.com", provider: "local", at: iso(0) },
  oad_quotes_v1: [
    quote({ id: "q1", no: "Q-20260618-001", status: "draft", cust: "김철수", age: 1,
      items: [{ type: "채널레터", w: "4", h: "0.7", grade: "고급", price: 350000, qty: 1, parts: {} }] }),
    quote({ id: "q2", no: "Q-20260616-002", status: "sent", cust: "이영희", age: 4, sent_at: iso(4),
      items: [{ type: "전면간판(채널)", w: "5", h: "1", grade: "일반", price: 200000, qty: 2, parts: {} }],
      events: [{ type: "created", at: iso(4) }, { type: "sent", at: iso(4) }] }),
    quote({ id: "q3", no: "Q-20260610-003", status: "accepted", cust: "박민수", age: 10, sent_at: iso(9), viewed_at: iso(8), responded_at: iso(7),
      items: [{ type: "LED 전광판", w: "3", h: "2", grade: "고급", price: 900000, qty: 1, parts: { "LED모듈": 24 } }],
      constructions: [["고소작업(스카이차)", 300000]], dis: [{ label: "단골 할인", mode: "pct", value: 5 }],
      resp: { name: "박민수", accepted: true, at: iso(7) },
      sig: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      events: [{ type: "created", at: iso(10) }, { type: "sent", at: iso(9) }, { type: "viewed", at: iso(8) }, { type: "accepted", at: iso(7), meta: { name: "박민수" } }] }),
    quote({ id: "q4", no: "Q-20260614-004", status: "viewed", cust: "정수진", age: 6, sent_at: iso(6), viewed_at: iso(5),
      items: [{ type: "돌출간판(양면)", w: "1", h: "1", grade: "수입", price: 1400000, qty: 1, parts: {} }],
      events: [{ type: "created", at: iso(6) }, { type: "sent", at: iso(6) }, { type: "viewed", at: iso(5) }] }),
  ],
  oad_clients_v1: [
    { id: "c1", name: "김철수 상회", tel: "010-1111-2222", addr: "서울 강남", manager: "김철수", memo: "단골", created_at: iso(30), grade: "vip", tags: ["프랜차이즈"], contacts: [], history: [] },
    { id: "c2", name: "이영희 카페", tel: "010-3333-4444", addr: "서울 마포", manager: "이영희", memo: "", created_at: iso(20), grade: "normal", tags: [], contacts: [], history: [] },
  ],
  oad_leads_v1: [
    { id: "l1", source: "phone", customerName: "최영업", tel: "010-5555-6666", memo: "간판 문의", stage: "new", created_at: iso(2) },
    { id: "l2", source: "kakao", customerName: "한상담", tel: "010-7777-8888", memo: "현수막", stage: "consult", created_at: iso(3) },
    { id: "l3", source: "form", customerName: "오견적", tel: "010-9999-0000", memo: "LED", stage: "quoted", created_at: iso(4) },
  ],
  oad_contracts_v1: [
    { id: "ct1", quote_id: "q3", quote_no: "Q-20260610-003", customer: "박민수", amount: 1188000, terms: "표준", parties: [{ role: "갑", name: "캐디안 광고", signature: "x", signed_at: iso(6) }, { role: "을", name: "박민수" }], status: "draft", created_at: iso(6) },
  ],
  oad_payments_v1: [
    { id: "p1", quote_id: "q3", quote_no: "Q-20260610-003", customer: "박민수", kind: "deposit", amount: 594000, due_date: "2026-06-25", paid: true, paid_at: iso(5), created_at: iso(6) },
    { id: "p2", quote_id: "q3", quote_no: "Q-20260610-003", customer: "박민수", kind: "balance", amount: 594000, due_date: "2026-07-10", paid: false, created_at: iso(6) },
  ],
  oad_notifications_v1: [
    { id: "n1", type: "accepted", title: "고객이 견적을 수락했습니다 🎉", body: "Q-20260610-003 · 박민수", quote_id: "q3", read: false, created_at: iso(7) },
    { id: "n2", type: "viewed", title: "고객이 견적을 열람했습니다", body: "Q-20260614-004 · 정수진", quote_id: "q4", read: true, created_at: iso(5) },
  ],
  oad_activities_v1: [
    { id: "a1", actor: "홍길동", action: "견적 발송", target_type: "quote", target_id: "q2", meta: {}, created_at: iso(4) },
    { id: "a2", actor: "홍길동", action: "견적 작성", target_type: "quote", target_id: "q1", meta: {}, created_at: iso(1) },
  ],
  oad_team_v1: [
    { id: "u1", name: "홍길동", email: "hong@cadian.com", role: "admin", created_at: iso(40) },
    { id: "u2", name: "김영업", email: "kim@cadian.com", role: "sales", created_at: iso(35) },
  ],
};

const b = await chromium.launch();

async function shoot(ctx, tag, routes) {
  const p = await ctx.newPage();
  await p.addInitScript((data) => {
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, seed);
  for (const [name, path] of routes) {
    await p.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/${tag}-${name}.png`, fullPage: true });
    console.log(`shot ${tag}-${name}`);
  }
  await p.close();
}

const routes = [
  ["dashboard", "/"], ["quotes", "/quotes"], ["quotedetail", "/quotes/q3"], ["editor", "/editor/q3"],
  ["clients", "/clients"], ["catalog", "/catalog"], ["settings", "/settings"], ["reports", "/reports"],
  ["pipeline", "/pipeline"], ["contracts", "/contracts"], ["payments", "/payments"], ["notifications", "/notifications"], ["team", "/team"],
  ["view", "/view?t=q3-tok"],
];

const desktop = await b.newContext({ viewport: { width: 1280, height: 900 } });
await shoot(desktop, "d", routes);
await desktop.close();

const mobile = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
await shoot(mobile, "m", [["dashboard", "/"], ["quotes", "/quotes"], ["quotedetail", "/quotes/q3"], ["editor", "/editor/q3"], ["settings", "/settings"], ["view", "/view?t=q3-tok"]]);
await mobile.close();

await b.close();
console.log("ALL DONE");
