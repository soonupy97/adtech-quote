// 블루프린트 §12 Auth 계약 — 아이디 기반 실제 인증(Supabase)
// Supabase Auth 는 이메일 기반이므로, 사용자가 입력한 "아이디"를
// 내부적으로 `<아이디>@<도메인>` 합성 이메일로 변환해 가입/로그인한다.
// 사용자에게는 아이디만 노출되고, 비밀번호는 Supabase 서버에서
// bcrypt 해시로 저장된다(코드/브라우저에 평문 노출 없음).
import type { Session } from "@/types";
import { isSupabaseEnabled, supabase } from "./supabaseClient";

const S_KEY = "oad_session_v1";
const A_KEY = "oad_accounts_v1"; // 로컬 폴백(개발용) 계정 저장소

// 아이디 → 내부 이메일 변환용 도메인 (실제 메일 발송 안 함)
const ID_DOMAIN = "adtech-quote.app";
// 허용 아이디 형식: 영문/숫자/._- 3~30자
const ID_RE = /^[a-zA-Z0-9._-]{3,30}$/;

function normId(id: string): string {
  return id.trim().toLowerCase();
}
function idToEmail(id: string): string {
  return `${normId(id)}@${ID_DOMAIN}`;
}
function emailToId(email: string): string {
  const suffix = `@${ID_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}

// ── 로컬 폴백(Supabase 미설정 시 개발용. 실보안 아님) ───────────────
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}
interface LocalAccount {
  id: string;
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

function validate(id: string, pw: string): string | null {
  if (!ID_RE.test(id.trim())) return "아이디는 영문/숫자 3~30자로 입력해 주세요.";
  if (pw.length < 6) return "비밀번호는 6자 이상이어야 합니다.";
  return null;
}

export const Auth = {
  enabled: isSupabaseEnabled,

  // 계정 생성. 성공 시 active 세션이 바로 생기면 loggedIn=true.
  async register(name: string, id: string, pw: string): Promise<Result & { loggedIn?: boolean }> {
    const v = validate(id, pw);
    if (v) return { ok: false, msg: v };

    if (isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: idToEmail(id),
        password: pw,
        options: { data: { name: name.trim() || normId(id), username: normId(id) } },
      });
      if (error) {
        const m = /already registered/i.test(error.message)
          ? "이미 사용 중인 아이디입니다."
          : error.message;
        return { ok: false, msg: m };
      }
      return { ok: true, loggedIn: Boolean(data.session) };
    }

    // 로컬 폴백
    const map = readAccounts();
    if (map[normId(id)]) return { ok: false, msg: "이미 사용 중인 아이디입니다." };
    map[normId(id)] = { id: normId(id), name: name.trim() || normId(id), pw: djb2(pw), created_at: new Date().toISOString() };
    writeAccounts(map);
    setLocalSession({ name: name.trim() || normId(id), email: normId(id), provider: "id", at: new Date().toISOString() });
    return { ok: true, loggedIn: true };
  },

  async login(id: string, pw: string): Promise<Result> {
    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: idToEmail(id),
        password: pw,
      });
      if (error) return { ok: false, msg: "아이디 또는 비밀번호가 일치하지 않습니다." };
      return { ok: true };
    }

    // 로컬 폴백
    const acc = readAccounts()[normId(id)];
    if (!acc) return { ok: false, msg: "등록된 계정이 없습니다. 계정을 먼저 만들어 주세요." };
    if (acc.pw !== djb2(pw)) return { ok: false, msg: "비밀번호가 일치하지 않습니다." };
    setLocalSession({ name: acc.name, email: acc.id, provider: "id", at: new Date().toISOString() });
    return { ok: true };
  },

  async current(): Promise<Session | null> {
    if (isSupabaseEnabled && supabase) {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) return null;
      const username = (s.user.user_metadata?.username as string) || emailToId(s.user.email || "");
      return {
        name: (s.user.user_metadata?.name as string) || username,
        email: username, // 화면엔 아이디만 노출
        provider: "id",
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
};
