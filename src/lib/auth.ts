// 블루프린트 §12 Auth 계약 — 이메일 기반 실제 인증(Supabase)
// 표준 방식: 이메일을 로그인 수단으로 쓰고, 비밀번호 분실 시
// Supabase 내장 재설정 메일(resetPasswordForEmail)로 복구한다.
// 비밀번호는 Supabase 서버에 해시로 저장되어 코드/브라우저에 평문이 없다.
import type { Session } from "@/types";
import { isSupabaseEnabled, supabase } from "./supabaseClient";

const S_KEY = "oad_session_v1";
const A_KEY = "oad_accounts_v1"; // 로컬 폴백(개발용) 계정 저장소

// 이메일 형식 검증(간단형)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 이메일 링크로 돌아올 비밀번호 재설정 페이지
const RESET_REDIRECT = "/reset-password";

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

// 이메일 일부 마스킹: hong***@company.com
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.length <= 2 ? user.slice(0, 1) : user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(3, user.length - head.length))}@${domain}`;
}

// ── 로컬 폴백(Supabase 미설정 시 개발용. 실보안 아님) ───────────────
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}
interface LocalAccount {
  email: string;
  name: string;
  pw: string;
  created_at: string;
}
function readAccounts(): Record<string, LocalAccount> {
  try {
    return JSON.parse(localStorage.getItem(A_KEY) || "{}") as Record<string, LocalAccount>;
  } catch {
    return {};
  }
}
function writeAccounts(map: Record<string, LocalAccount>): void {
  localStorage.setItem(A_KEY, JSON.stringify(map));
}
function setLocalSession(s: Session): void {
  localStorage.setItem(S_KEY, JSON.stringify(s));
}

type Result = { ok: boolean; msg?: string };

function validate(email: string, pw: string): string | null {
  if (!EMAIL_RE.test(email.trim())) return "올바른 이메일 형식을 입력해 주세요.";
  if (pw.length < 6) return "비밀번호는 6자 이상이어야 합니다.";
  return null;
}

export const Auth = {
  enabled: isSupabaseEnabled,

  // [로컬 목업 전용] gitignore 된 .env 의 VITE_ADMIN_* 로 관리자 계정을 1회 시드한다.
  // 비밀번호는 소스/깃이 아니라 .env 에서만 읽는다(자격증명 유출 방지).
  // 실서비스(Supabase) 모드에선 동작하지 않는다 → 그땐 Supabase 가입을 쓴다.
  ensureLocalAdmin(): void {
    if (isSupabaseEnabled) return;
    const email = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim();
    const pw = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
    const name = (import.meta.env.VITE_ADMIN_NAME as string | undefined)?.trim() || "관리자";
    if (!email || !EMAIL_RE.test(email) || !pw || pw.length < 6) return;
    const key = normEmail(email);
    const map = readAccounts();
    if (map[key]) return; // 이미 있으면 보존(비밀번호 덮어쓰지 않음)
    map[key] = { email: key, name, pw: djb2(pw), created_at: new Date().toISOString() };
    writeAccounts(map);
  },

  // 계정 생성. 성공 시 active 세션이 바로 생기면 loggedIn=true.
  // (이메일 인증이 켜져 있으면 메일 확인 후 로그인하도록 loggedIn=false)
  async register(name: string, email: string, pw: string): Promise<Result & { loggedIn?: boolean }> {
    const v = validate(email, pw);
    if (v) return { ok: false, msg: v };

    if (isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: normEmail(email),
        password: pw,
        options: {
          data: { name: name.trim() || normEmail(email) },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        const m = /already registered/i.test(error.message)
          ? "이미 가입된 이메일입니다."
          : error.message;
        return { ok: false, msg: m };
      }
      return { ok: true, loggedIn: Boolean(data.session) };
    }

    // 로컬 폴백
    const key = normEmail(email);
    const map = readAccounts();
    if (map[key]) return { ok: false, msg: "이미 가입된 이메일입니다." };
    map[key] = { email: key, name: name.trim() || key, pw: djb2(pw), created_at: new Date().toISOString() };
    writeAccounts(map);
    setLocalSession({ name: map[key].name, email: key, provider: "email", at: new Date().toISOString() });
    return { ok: true, loggedIn: true };
  },

  async login(email: string, pw: string): Promise<Result> {
    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: normEmail(email),
        password: pw,
      });
      if (error) return { ok: false, msg: "이메일 또는 비밀번호가 일치하지 않습니다." };
      return { ok: true };
    }

    // 로컬 폴백
    const acc = readAccounts()[normEmail(email)];
    if (!acc) return { ok: false, msg: "등록된 계정이 없습니다. 계정을 먼저 만들어 주세요." };
    if (acc.pw !== djb2(pw)) return { ok: false, msg: "비밀번호가 일치하지 않습니다." };
    setLocalSession({ name: acc.name, email: acc.email, provider: "email", at: new Date().toISOString() });
    return { ok: true };
  },

  async current(): Promise<Session | null> {
    if (isSupabaseEnabled && supabase) {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) return null;
      const email = s.user.email || "";
      return {
        name: (s.user.user_metadata?.name as string) || email,
        email,
        provider: "email",
        at: new Date(s.user.created_at).toISOString(),
      };
    }
    try {
      const raw = localStorage.getItem(S_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    if (isSupabaseEnabled && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(S_KEY);
  },

  // [표준] 비밀번호 재설정 메일 발송. 사용자는 메일의 링크를 눌러
  // RESET_REDIRECT 페이지로 돌아와 새 비밀번호를 설정한다.
  // 계정 존재 여부를 노출하지 않도록 항상 동일 응답을 준다(보안 권장).
  async sendResetEmail(email: string): Promise<Result> {
    if (!EMAIL_RE.test(email.trim())) return { ok: false, msg: "올바른 이메일 형식을 입력해 주세요." };

    if (isSupabaseEnabled && supabase) {
      await supabase.auth.resetPasswordForEmail(normEmail(email), {
        redirectTo: `${window.location.origin}${RESET_REDIRECT}`,
      });
      return { ok: true, msg: "재설정 메일을 보냈습니다. 메일함을 확인해 주세요." };
    }
    return {
      ok: false,
      msg: "로컬 모드에서는 메일 발송이 불가합니다. 이메일·이름으로 직접 재설정해 주세요.",
    };
  },

  // 재설정 메일 링크로 돌아온 페이지에서 호출. 현재 복구 세션의 비밀번호를 변경.
  async updatePassword(newPw: string): Promise<Result> {
    if (newPw.length < 6) return { ok: false, msg: "비밀번호는 6자 이상이어야 합니다." };
    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) return { ok: false, msg: "링크가 만료되었거나 유효하지 않습니다. 다시 시도해 주세요." };
      return { ok: true };
    }
    return { ok: false, msg: "로컬 모드에서는 지원되지 않습니다." };
  },

  // [아이디 찾기] 이름으로 가입된 이메일(아이디)을 찾아 마스킹해 돌려준다.
  // 서버 인증 모드에서는 보안상 클라이언트에서 사용자 조회가 불가하므로 안내만 한다.
  async findEmails(name: string): Promise<Result & { emails?: string[] }> {
    const qn = name.trim().toLowerCase();
    if (!qn) return { ok: false, msg: "이름을 입력해 주세요." };

    if (isSupabaseEnabled) {
      return {
        ok: false,
        msg: "서버 인증 모드에서는 이메일이 곧 아이디입니다. 가입한 이메일로 로그인하거나, 비밀번호를 잊었다면 재설정을 이용해 주세요.",
      };
    }

    const map = readAccounts();
    const emails = Object.values(map)
      .filter((a) => a.name.trim().toLowerCase() === qn)
      .map((a) => maskEmail(a.email));
    if (!emails.length) return { ok: false, msg: "해당 이름으로 가입된 계정을 찾지 못했습니다." };
    return { ok: true, emails };
  },

  // [로컬 개발용 폴백] 메일을 못 보내는 로컬 모드에서 이메일+이름 본인확인 후 즉시 재설정.
  async resetPasswordLocal(email: string, name: string, newPw: string): Promise<Result> {
    const key = normEmail(email);
    const qn = name.trim().toLowerCase();
    if (!EMAIL_RE.test(key)) return { ok: false, msg: "올바른 이메일 형식을 입력해 주세요." };
    if (!qn) return { ok: false, msg: "이름을 입력해 주세요." };
    if (newPw.length < 6) return { ok: false, msg: "비밀번호는 6자 이상이어야 합니다." };

    const map = readAccounts();
    const acc = map[key];
    if (!acc) return { ok: false, msg: "등록된 계정이 없습니다." };
    if (acc.name.trim().toLowerCase() !== qn) {
      return { ok: false, msg: "이메일과 이름이 일치하지 않습니다." };
    }
    acc.pw = djb2(newPw);
    writeAccounts(map);
    return { ok: true };
  },
};
