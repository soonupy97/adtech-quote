// 견적 발송 헬퍼 — 서버·API키·사업자 인증·비용 없이 지금 바로 동작하는 것만 사용.
// 기본: 링크 복사(copyText) — 모든 환경에서 항상 동작.
// 모바일: navigator.share 로 OS 공유 시트 호출(카카오톡·문자·메일 등이 그대로 노출).

export function quoteMessage(opts: {
  company?: string;
  customer?: string;
  quoteNo?: string;
  url: string;
}): string {
  const { company, customer, quoteNo, url } = opts;
  const who = customer ? `${customer}님, ` : "";
  const from = company ? `${company} ` : "";
  const no = quoteNo ? ` (${quoteNo})` : "";
  return `${who}${from}견적서를 보내드립니다${no}.\n아래 링크에서 확인·수락하실 수 있습니다:\n${url}`;
}

export function quoteSubject(opts: { company?: string; quoteNo?: string }): string {
  const { company, quoteNo } = opts;
  return `${company ? `[${company}] ` : ""}견적서${quoteNo ? ` ${quoteNo}` : ""}`;
}

export const canNativeShare = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

export const isMobile = (): boolean =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// 인앱(임베디드) 브라우저 감지 — 카카오톡/네이버/인스타/페북/라인/밴드 등의 WebView.
// 구글 OAuth 는 이런 임베디드 WebView 에서 `disallowed_useragent`(403)로 차단되므로,
// 구글 로그인을 시도하기 전에 사용자에게 기본 브라우저로 열도록 안내해야 한다.
export const isInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /KAKAOTALK|KAKAOSTORY|NAVER\(inapp|NAVER |Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|band\b|everytimeApp|Snapchat|; wv\)/i.test(ua);
};

// 성공 시 true. 사용자가 취소(AbortError)하거나 미지원이면 false.
export async function nativeShare(opts: { title?: string; text: string; url: string }): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  // 보안 컨텍스트(HTTPS)에서는 Clipboard API 사용. navigator.clipboard 가 없으면(비보안/구형)
  // ?. 가 undefined 로 단락돼 await 가 통과하므로, 실제로 복사 안 됐는데 true 를 반환하는 걸 막는다.
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 권한 거부 등 → 아래 폴백으로 진행
    }
  }
  // 폴백: 임시 textarea + execCommand("copy") (비보안 컨텍스트/구형 브라우저)
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
