// 공유 비밀번호 정책 — 가입(register)·재설정(updatePassword) 양쪽에서 동일하게 사용.
// 강도 미터가 '장식'에 그치지 않도록, 여기 규칙을 실제 가입/변경 게이트로 강제한다.

export const PW_MIN = 8;
export const PW_MAX = 64; // bcrypt 72바이트 초과 절단 회피 + 합리적 상한

// 강도 점수(0~4)와 표시 메타(바·라벨 색은 .pw-bar.s1~s4 CSS와 매칭)
export const STRENGTH = [
  { label: "매우 약함", cls: "s1" }, // 0
  { label: "약함", cls: "s1" }, // 1
  { label: "보통", cls: "s2" }, // 2
  { label: "양호", cls: "s3" }, // 3
  { label: "강함", cls: "s4" }, // 4
] as const;

export function pwScore(pw: string): number {
  let s = 0;
  if (pw.length >= PW_MIN) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export interface PwCheck {
  label: string;
  ok: boolean;
}
// 입력 중 보여줄 요건 체크리스트(무엇을 채우면 강해지는지 가시화)
export function pwChecklist(pw: string): PwCheck[] {
  return [
    { label: `${PW_MIN}자 이상`, ok: pw.length >= PW_MIN },
    { label: "영문 대·소문자", ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
    { label: "숫자 포함", ok: /\d/.test(pw) },
    { label: "특수문자 포함", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

// 너무 흔해 사전공격에 취약한 비밀번호(소문자 비교)
const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwertyui", "qwerty123", "1q2w3e4r", "1qaz2wsx", "abcd1234", "asdf1234",
  "11111111", "00000000", "aaaaaaaa", "iloveyou", "admin123", "welcome1",
]);

// 정책 위반 사유(없으면 null). email 을 주면 이메일 아이디 포함도 차단.
export function passwordError(pw: string, email?: string): string | null {
  if (pw.length < PW_MIN) return `비밀번호는 ${PW_MIN}자 이상이어야 합니다.`;
  if (pw.length > PW_MAX) return `비밀번호는 ${PW_MAX}자 이하여야 합니다.`;
  if (/^(.)\1+$/.test(pw)) return "같은 문자만으로는 사용할 수 없습니다.";
  if (COMMON.has(pw.toLowerCase())) return "너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해 주세요.";
  if (email) {
    const local = (email.split("@")[0] || "").toLowerCase();
    if (local.length >= 3 && pw.toLowerCase().includes(local))
      return "비밀번호에 이메일 아이디를 포함할 수 없습니다.";
  }
  if (pwScore(pw) < 2) return "비밀번호가 너무 약합니다. 영문·숫자·특수문자를 조합해 주세요.";
  return null;
}
