// 블루프린트 §12 Auth 계약 — 이메일 기반 실제 인증(Supabase 전용)
// 이메일을 로그인 수단으로 쓰고, 비밀번호 분실 시 Supabase 내장
// 재설정 메일(resetPasswordForEmail)로 복구한다. 비밀번호는 Supabase
// 서버에 해시로 저장되어 코드/브라우저에 평문이 없다. (로컬 목업 모드 제거)
import type { Session } from "@/types";
import { supabase } from "./supabaseClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 이메일 링크로 돌아올 비밀번호 재설정 페이지
const RESET_REDIRECT = "/reset-password";

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

type Result = { ok: boolean; msg?: string };

function validate(email: string, pw: string): string | null {
  if (!EMAIL_RE.test(email.trim())) return "올바른 이메일 형식을 입력해 주세요.";
  if (pw.length < 6) return "비밀번호는 6자 이상이어야 합니다.";
  return null;
}

export const Auth = {
  // 계정 생성. 세션이 바로 생기면 loggedIn=true.
  // (이메일 인증이 켜져 있으면 메일 확인 후 로그인하도록 loggedIn=false)
  async register(name: string, email: string, pw: string): Promise<Result & { loggedIn?: boolean }> {
    const v = validate(email, pw);
    if (v) return { ok: false, msg: v };

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
  },

  async login(email: string, pw: string): Promise<Result> {
    const { error } = await supabase.auth.signInWithPassword({
      email: normEmail(email),
      password: pw,
    });
    if (error) {
      const detail = `${error.message} ${(error as { code?: string }).code || ""}`;
      const msg = /not.?confirm|email_not_confirmed/i.test(detail)
        ? "이메일 인증이 완료되지 않았습니다. 받은 인증 메일의 링크를 누르거나, 설정에서 이메일 인증을 꺼주세요."
        : "이메일 또는 비밀번호가 일치하지 않습니다.";
      return { ok: false, msg };
    }
    return { ok: true };
  },

  async current(): Promise<Session | null> {
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
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  // [표준] 비밀번호 재설정 메일 발송. 사용자는 메일의 링크를 눌러
  // RESET_REDIRECT 페이지로 돌아와 새 비밀번호를 설정한다.
  // 계정 존재 여부를 노출하지 않도록 항상 동일 응답을 준다(보안 권장).
  async sendResetEmail(email: string): Promise<Result> {
    if (!EMAIL_RE.test(email.trim())) return { ok: false, msg: "올바른 이메일 형식을 입력해 주세요." };
    await supabase.auth.resetPasswordForEmail(normEmail(email), {
      redirectTo: `${window.location.origin}${RESET_REDIRECT}`,
    });
    return { ok: true, msg: "재설정 메일을 보냈습니다. 메일함을 확인해 주세요." };
  },

  // 재설정 메일 링크로 돌아온 페이지에서 호출. 현재 복구 세션의 비밀번호를 변경.
  async updatePassword(newPw: string): Promise<Result> {
    if (newPw.length < 6) return { ok: false, msg: "비밀번호는 6자 이상이어야 합니다." };
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return { ok: false, msg: "링크가 만료되었거나 유효하지 않습니다. 다시 시도해 주세요." };
    return { ok: true };
  },

  // [아이디 찾기] 서버 인증에서는 이메일이 곧 아이디라 별도 조회가 없다 — 안내만.
  async findEmails(_name: string): Promise<Result & { emails?: string[] }> {
    return {
      ok: false,
      msg: "이메일이 곧 아이디입니다. 가입한 이메일로 로그인하거나, 비밀번호를 잊었다면 재설정을 이용해 주세요.",
    };
  },
};
