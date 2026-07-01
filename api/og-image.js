// 링크 미리보기 카드 이미지 — "로고 + 회사명 + 옥외광고 전자견적서" 1200×630.
// @vercel/og(Satori)로 렌더한다. 한글이 깨지지 않도록 Pretendard(OTF)를 실어준다.
// 회사명·로고 모두 익명 접근 가능한 get_quote_by_token RPC 로만 읽는다
// (로고는 발송 시 markSent 가 견적 supplier.logoUrl 에 스냅샷해 둔 값).
// → Supabase 서비스롤 키·스키마 변경 없이 동작한다. 로고가 없으면 회사명만 표시.
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || "https://egbnloazsitbzycyymzh.supabase.co";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_YALwTe4gtG4h4PRirxbYhQ_wl1f0alY";

const FONT_REGULAR = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf";
const FONT_BOLD = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf";

// React.createElement 없이 엘리먼트 트리를 만든다(엣지 번들 최소화).
function h(type, props, ...children) {
  return {
    type,
    key: null,
    ref: null,
    props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
    $$typeof: Symbol.for("react.element"),
  };
}

let _fonts = null;
async function loadFonts() {
  if (_fonts) return _fonts;
  const [reg, bold] = await Promise.all([
    fetch(FONT_REGULAR).then((r) => r.arrayBuffer()),
    fetch(FONT_BOLD).then((r) => r.arrayBuffer()),
  ]);
  _fonts = [
    { name: "Pretendard", data: reg, weight: 400, style: "normal" },
    { name: "Pretendard", data: bold, weight: 700, style: "normal" },
  ];
  return _fonts;
}

async function fetchQuote(token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_quote_by_token`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (Array.isArray(data)) return data[0] || null;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";

  let company = "옥외광고 전자견적";
  let logo = "";
  if (token) {
    const q = await fetchQuote(token);
    if (q && q.supplier) {
      if (q.supplier.name) company = String(q.supplier.name);
      const l = q.supplier.logoUrl;
      if (typeof l === "string" && l.startsWith("data:image")) logo = l;
    }
  }

  let fonts;
  try {
    fonts = await loadFonts();
  } catch {
    fonts = undefined; // 폰트 로드 실패 시에도 이미지 자체는 생성(라틴만 정상)
  }

  const children = [
    logo
      ? h("img", {
          src: logo,
          width: 560,
          height: 150,
          style: { objectFit: "contain", marginBottom: 44 },
        })
      : null,
    h(
      "div",
      { style: { fontSize: 66, fontWeight: 700, color: "#111111", textAlign: "center", lineHeight: 1.2, maxWidth: 1000 } },
      company,
    ),
    h(
      "div",
      { style: { fontSize: 32, fontWeight: 400, color: "#888888", marginTop: 18 } },
      "옥외광고 전자견적서",
    ),
  ].filter(Boolean);

  const root = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        fontFamily: "Pretendard",
        padding: 80,
      },
    },
    ...children,
  );

  return new ImageResponse(root, { width: 1200, height: 630, fonts });
}
