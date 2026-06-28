// 회원가입 이메일 "실재성" 검수 유틸. (외부 서비스 가입/키 불필요)
//  1) 형식 검사
//  2) 일회용(임시) 이메일 도메인 차단
//  3) DNS-over-HTTPS(Google, CORS 허용)로 도메인의 메일 수신 가능 여부(MX, 없으면 A) 확인
// → 가짜/오타/존재하지 않는 도메인을 가입 시점에 즉시(메일 안 보내고) 거른다.
// 메일박스(앞부분)의 실제 수신·소유 검증은 Supabase 확인메일(Confirm email, double opt-in)이 담당한다.
// DNS 조회가 불확실(네트워크 오류 등)하면 통과시켜(가입을 막지 않음) 오탐으로 정상 사용자를 막지 않는다.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 대표적인 일회용/임시 메일 도메인 (필요 시 확장)
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "guerrillamail.info",
  "guerrillamail.net", "tempmail.com", "temp-mail.org", "throwawaymail.com",
  "yopmail.com", "getnada.com", "nada.email", "trashmail.com", "sharklasers.com",
  "grr.la", "maildrop.cc", "dispostable.com", "fakeinbox.com", "mailnesia.com",
  "mohmal.com", "emailondeck.com", "mintemail.com", "tempinbox.com",
  "spamgourmet.com", "33mail.com", "tempr.email", "moakt.com", "mailcatch.com",
  "discard.email", "spam4.me", "tmail.ws", "burnermail.io", "mailto.plus",
]);

export interface EmailCheck {
  ok: boolean;
  reason?: string;
}

// Google DNS-over-HTTPS JSON API 응답(필요한 필드만)
interface DohAnswer {
  type: number; // 1=A, 5=CNAME, 15=MX, 28=AAAA …
}
interface DohResponse {
  Status: number; // 0=NOERROR, 3=NXDOMAIN …
  Answer?: DohAnswer[];
}

// 특정 레코드 존재 여부. "yes"|"no"|"nxdomain"|null(조회 불확실)
async function lookup(domain: string, type: "MX" | "A"): Promise<"yes" | "no" | "nxdomain" | null> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DohResponse;
    if (data.Status === 3) return "nxdomain"; // 도메인 자체가 없음
    if (data.Status !== 0) return null; // SERVFAIL 등 → 불확실
    const wanted = type === "MX" ? 15 : 1;
    return (data.Answer || []).some((a) => a.type === wanted) ? "yes" : "no";
  } catch {
    return null; // 네트워크/CORS 오류 → 불확실
  }
}

// 이메일 도메인이 실제로 메일을 받을 수 있는지 검증한다.
export async function verifyEmailDeliverable(email: string): Promise<EmailCheck> {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, reason: "올바른 이메일 형식을 입력해 주세요." };

  const domain = e.slice(e.indexOf("@") + 1);
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "일회용(임시) 이메일은 사용할 수 없습니다. 다른 이메일을 입력해 주세요." };
  }

  const mx = await lookup(domain, "MX");
  if (mx === "nxdomain") return { ok: false, reason: "존재하지 않는 이메일 도메인입니다. 주소를 다시 확인해 주세요." };
  if (mx === "yes") return { ok: true };

  if (mx === "no") {
    // MX 가 없어도 A 레코드가 있으면 메일 수신 가능(암묵적 MX, RFC 5321)
    const a = await lookup(domain, "A");
    if (a === "yes") return { ok: true };
    if (a === "no" || a === "nxdomain") {
      return { ok: false, reason: "메일을 받을 수 없는 도메인입니다. 이메일 주소를 다시 확인해 주세요." };
    }
  }

  // 불확실(null) → 통과. 최종 검증은 가입 인증메일이 담당한다.
  return { ok: true };
}
