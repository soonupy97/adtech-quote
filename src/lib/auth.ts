// 블루프린트 §12 Auth 계약 — 이메일 기반 실제 인증(Supabase 전용)
// 이메일을 로그인 수단으로 쓰고, 비밀번호 분실 시 Supabase 내장
// 재설정 메일(resetPasswordForEmail)로 복구한다. 비밀번호는 Supabase
// 서버에 해시로 저장되어 코드/브라우저에 평문이 없다. (로컬 목업 모드 제거)
import type { Session, Supplier } from "@/types";
import { supabase } from "./supabaseClient";
import { passwordError } from "./password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 이메일 링크로 돌아올 비밀번호 재설정 페이지
const RESET_REDIRECT = "/reset-password";
// 제어문자(0x00~0x1F, 0x7F) 제거용 — 소스에 literal 제어문자를 넣지 않도록 생성자 사용
const CTRL_RE = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

// 이름 정제: 제어문자 제거 + 공백 정리 + 길이 상한(메타데이터 오염/과대 입력 방지)
function cleanName(name: string): string {
  return name.replace(CTRL_RE, "").trim().slice(0, 40);
}

type Result = { ok: boolean; msg?: string };

// 가입 시 함께 저장하는 약관 동의 증빙(어떤 버전에 언제 동의했는지)
export interface Consent {
  tosVer: string;
  privacyVer: string;
  agreedAt: string; // ISO
}

function validate(email: string, pw: string): string | null {
  if (!EMAIL_RE.test(email.trim())) return "올바른 이메일 형식을 입력해 주세요.";
  return passwordError(pw, email);
}

export const Auth = {
  // 계정 생성. 세션이 바로 생기면 loggedIn=true.
  // (이메일 인증이 켜져 있으면 메일 확인 후 로그인하도록 loggedIn=false)
  async register(
    name: string,
    email: string,
    pw: string,
    consent?: Consent,
    company?: Partial<Supplier>,
  ): Promise<Result & { loggedIn?: boolean }> {
    const v = validate(email, pw);
    if (v) return { ok: false, msg: v };

    const nm = cleanName(name) || normEmail(email);
    // 회사 정보(회사명이 있을 때만) — 첫 로그인 시 settings.supplier 로 하이드레이션
    const co = company && (company.name || "").trim() ? company : undefined;
    const { data, error } = await supabase.auth.signUp({
      email: normEmail(email),
      password: pw,
      options: {
        // 이름 + (있으면) 약관 동의 증빙 + 회사 정보를 user_metadata 에 함께 보관
        data: {
          name: nm,
          ...(consent ? { consent } : {}),
          ...(co ? { company: co } : {}),
        },
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

  async login(email: string, pw: string): Promise<Result & { needVerify?: boolean }> {
    const { error } = await supabase.auth.signInWithPassword({
      email: normEmail(email),
      password: pw,
    });
    if (error) {
      const detail = `${error.message} ${(error as { code?: string }).code || ""}`;
      if (/not.?confirm|email_not_confirmed/i.test(detail)) {
        // 운영 설정(이메일 인증 토글)을 사용자에게 노출하지 않고, 재발송을 유도
        return {
          ok: false,
          needVerify: true,
          msg: "이메일 인증이 아직 완료되지 않았습니다. 받은 인증 메일의 링크를 눌러 인증을 완료해 주세요.",
        };
      }
      return { ok: false, msg: "이메일 또는 비밀번호가 일치하지 않습니다." };
    }
    return { ok: true };
  },

  // 구글 OAuth 로그인. 구글 동의 화면을 거쳐 origin 으로 돌아오며,
  // supabase-js 가 콜백 URL에서 세션을 자동 수립한다(AppShell 가 이어받음).
  // ※ Supabase 대시보드에서 Google provider 활성화 + 구글 OAuth 클라이언트 등록이 선행돼야 한다.
  async loginWithGoogle(): Promise<Result> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, msg: "구글 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    return { ok: true };
  },

  // 카카오 OAuth 로그인. 카카오 동의 화면을 거쳐 origin 으로 돌아오며,
  // supabase-js 가 콜백 URL에서 세션을 자동 수립한다(AppShell 가 이어받음).
  // ※ Supabase 대시보드에서 Kakao provider 활성화 + 카카오 개발자 앱 등록이 선행돼야 한다.
  async loginWithKakao(): Promise<Result> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, msg: "카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    return { ok: true };
  },

  // 인증 메일 재발송(가입 확인용). 미인증 계정에만 의미가 있다.
  async resendVerification(email: string): Promise<Result> {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normEmail(email),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { ok: false, msg: "인증 메일 재발송에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    return { ok: true, msg: "인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요." };
  },

  async current(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s) return null;
    const email = s.user.email || "";
    // 로그인 수단(이메일/카카오 등) — 카카오면 프로필에 '· 카카오'로 표시
    const provider = (s.user.app_metadata?.provider as string) || "email";
    return {
      name: (s.user.user_metadata?.name as string)
        || (s.user.user_metadata?.full_name as string)
        || email
        || "사용자",
      email,
      provider,
      at: new Date(s.user.created_at).toISOString(),
    };
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  // [회원 탈퇴] 본인 데이터 + 계정을 서버 RPC 로 삭제하고 로그아웃한다. (비가역)
  async deleteAccount(): Promise<Result> {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { ok: false, msg: "계정 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    await supabase.auth.signOut();
    return { ok: true };
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
    const pe = passwordError(newPw);
    if (pe) return { ok: false, msg: pe };
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return { ok: false, msg: "링크가 만료되었거나 유효하지 않습니다. 다시 시도해 주세요." };
    return { ok: true };
  },

  // [이메일 찾기] 이름 정확 일치 시 마스킹된 이메일 목록을 반환(서버 RPC).
  // 전체 이메일은 노출하지 않는다(열거/수집 악용 완화).
  async findEmails(name: string): Promise<Result & { emails?: string[] }> {
    const n = name.trim();
    if (n.length < 2) return { ok: false, msg: "이름을 2자 이상 입력해 주세요." };
    const { data, error } = await supabase.rpc("find_member_emails", { p_name: n });
    if (error) {
      // 함수 미배포(PGRST202)·스키마 캐시 미반영이면 원인을 명확히 안내
      const detail = `${error.message} ${(error as { code?: string }).code || ""}`;
      if (/PGRST202|schema cache|find_member_emails|could not find the function/i.test(detail)) {
        return { ok: false, msg: "이메일 찾기 기능이 서버에 아직 설정되지 않았습니다. 관리자에게 문의해 주세요." };
      }
      return { ok: false, msg: "이메일을 찾는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
    const emails = ((data as { masked_email: string }[] | null) || []).map((r) => r.masked_email);
    if (emails.length === 0)
      return { ok: false, msg: "입력하신 이름으로 가입된 계정을 찾지 못했습니다. 이름을 정확히 입력했는지 확인해 주세요." };
    return { ok: true, emails };
  },
};
