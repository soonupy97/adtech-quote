// 링크 미리보기(OG) 서버 함수 — /view?t=<token> 요청을 가로채,
// 견적 토큰으로 "발송한 회사명"을 조회해 <title>·og:title·og:image 를 주입한다.
// 크롤러(카카오톡·슬랙 등)는 JS 를 실행하지 않으므로, 정적 SPA 만으로는
// 회사별 미리보기가 불가능하다. 이 함수가 그 간극을 메운다.
// 실제 사용자가 열면 동일한 SPA HTML 이 내려가 React 가 정상 부팅된다.
export const config = { runtime: "edge" };

// 연결 기본값은 클라이언트(supabaseClient.ts)와 동일 — 둘 다 공개(publishable) 값이라
// 코드에 내장돼도 안전하며, 실제 보호는 RLS 가 담당한다. 로고 조회는 og-image 쪽에서만 한다.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://egbnloazsitbzycyymzh.supabase.co";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_YALwTe4gtG4h4PRirxbYhQ_wl1f0alY";

const DEFAULT_TITLE = "옥외광고 전자견적";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

// 익명 접근 가능한 RPC(get_quote_by_token, security definer)로 견적 단건을 읽는다.
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
  const origin = url.origin;

  // 원본 SPA HTML — /index.html 은 정적 파일이라 rewrite 를 타지 않아 루프가 없다.
  let html;
  try {
    const res = await fetch(`${origin}/index.html`);
    if (!res.ok) throw new Error(String(res.status));
    html = await res.text();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  let company = "";
  if (token) {
    const q = await fetchQuote(token);
    if (q && q.supplier && q.supplier.name) company = String(q.supplier.name);
  }

  const title = company ? `${company} 견적서` : DEFAULT_TITLE;
  const desc = company
    ? `${company}에서 보낸 옥외광고 견적서입니다. 링크에서 확인·수락하실 수 있습니다.`
    : "옥외광고 전자견적서를 확인·수락하실 수 있습니다.";
  const ogImage = `${origin}/api/og-image?t=${encodeURIComponent(token)}`;
  const pageUrl = `${origin}/view?t=${encodeURIComponent(token)}`;

  const meta = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(company || DEFAULT_TITLE)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(pageUrl)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
  ].join("\n    ");

  // 기존 <title> 제거 후 </head> 직전에 메타 주입.
  html = html.replace(/<title>[\s\S]*?<\/title>/i, "");
  html = html.replace(/<\/head>/i, `    ${meta}\n  </head>`);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // 크롤러/CDN 캐시는 짧게 — 회사명 변경이 비교적 빨리 반영되도록.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
