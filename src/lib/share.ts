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
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}
