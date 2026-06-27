import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth, type Consent } from "@/lib/auth";
import { passwordError } from "@/lib/password";
import { useToast } from "@/components/Toast";
import { Button, Field, Input } from "@/components/ui";
import Modal from "@/components/Modal";
import PasswordStrength from "@/components/PasswordStrength";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";

type Mode = "login" | "register" | "resetPw" | "findEmail";
type Terms = "tos" | "privacy";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 약관 버전 — 동의 증빙(언제·어느 버전에 동의했는지)으로 저장된다. 개정 시 갱신.
const TOS_VER = "2026-06-27";
const PRIVACY_VER = "2026-06-27";

// 흔한 이메일 도메인 — 오타 추정(제안)에 사용
const EMAIL_DOMAINS = [
  "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com",
  "nate.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com",
];
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
// 도메인이 흔한 도메인과 1~2자만 다르면 교정안을 제안(없으면 null)
function suggestEmail(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (domain.length < 3 || EMAIL_DOMAINS.includes(domain)) return null;
  let best: string | null = null, bd = 99;
  for (const c of EMAIL_DOMAINS) {
    const dd = lev(domain, c);
    if (dd < bd) { bd = dd; best = c; }
  }
  return best && bd > 0 && bd <= 2 ? `${local}@${best}` : null;
}

// 약관 본문(샘플) — 실제 약관으로 교체 필요
const TERMS_TEXT: Record<Terms, { title: string; ver: string; body: string }> = {
  tos: {
    title: "이용약관",
    ver: TOS_VER,
    body: `제1조(목적) 본 약관은 애드텍디자인 전자견적 서비스(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.
제2조(이용계약) 이용자는 본 약관에 동의함으로써 서비스 이용계약이 성립됩니다.
제3조(서비스의 제공) 회사는 견적서 작성·발송, 전자계약, 정산 관리 등의 기능을 제공합니다.
제4조(이용자의 의무) 이용자는 관계 법령과 본 약관을 준수해야 합니다.`,
  },
  privacy: {
    title: "개인정보 수집·이용 동의",
    ver: PRIVACY_VER,
    body: `1. 수집 항목: 이름, 이메일(아이디), 비밀번호(암호화 저장), 회사 정보(상호·사업자등록번호·대표자·연락처·주소)
2. 수집 목적: 회원 식별 및 서비스 제공, 견적서·계약서의 공급자 정보 표시, 고객 지원, 공지 전달
3. 보유 기간: 회원 탈퇴 시까지(관계 법령에 따른 보존 기간은 예외)
4. 동의를 거부할 권리가 있으나, 거부 시 회원가입이 제한됩니다.`,
  },
};

// 인라인 필드 에러 한 줄(스크린리더 고지)
function FieldError({ id, msg }: { id: string; msg: string }) {
  if (!msg) return null;
  return (
    <div className="field-error" id={id} role="alert">
      <AlertTriangle size={12} /> <span>{msg}</span>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [sent, setSent] = useState(false); // 재설정 메일 발송 완료
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null); // 가입 후 인증 대기
  const [foundEmails, setFoundEmails] = useState<string[] | null>(null); // 이메일 찾기 결과(마스킹)
  const [hp, setHp] = useState(""); // 허니팟(사람에겐 안 보이는 필드 — 채워지면 봇)
  const [err, setErr] = useState(""); // 서버 오류(상단 배너)
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [cooldown, setCooldown] = useState(0); // 메일 재발송 쿨다운(초)

  // 이미 로그인 상태면 대시보드로
  useEffect(() => {
    Auth.current().then((s) => {
      if (s) navigate("/", { replace: true });
    });
  }, [navigate]);

  // 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const goMode = (m: Mode) => {
    setMode(m);
    setPw("");
    setPw2("");
    setShowPw(false);
    setAgreeTos(false);
    setAgreePrivacy(false);
    setSent(false);
    setVerifyEmail(null);
    setFoundEmails(null);
    setHp("");
    setErr("");
    setTouched({});
  };

  const titleByMode: Record<Mode, string> = {
    login: "로그인",
    register: "계정 만들기",
    resetPw: "비밀번호 재설정",
    findEmail: "이메일 찾기",
  };
  // 폼 헤더 설명(로고 자리 대체 — 데스크톱 상단 허전함 보완)
  const descByMode: Record<Mode, string> = {
    login: "계정에 로그인하고 견적 업무를 이어서 관리하세요.",
    register: "무료로 계정을 만들고 전자견적을 시작하세요.",
    resetPw: "가입하신 이메일로 재설정 링크를 보내드립니다.",
    findEmail: "가입 정보로 등록된 이메일(아이디)을 찾아드립니다.",
  };

  const needName = mode === "register" || mode === "findEmail";
  const needEmail = mode !== "findEmail";
  const needPw = mode === "login" || mode === "register";
  const needPw2 = mode === "register";
  const agreedRequired = agreeTos && agreePrivacy;

  const emailSuggest = useMemo(() => suggestEmail(email), [email]);

  // 필드별 검증(빈 문자열이면 정상)
  const nameErr = () => (needName && !name.trim() ? "이름을 입력해 주세요." : "");
  const emailErr = () => {
    if (!needEmail) return "";
    if (!email.trim()) return "이메일을 입력해 주세요.";
    if (!EMAIL_RE.test(email.trim())) return "올바른 이메일 형식을 입력해 주세요.";
    return "";
  };
  const pwErr = () => {
    if (!needPw) return "";
    if (!pw) return "비밀번호를 입력해 주세요.";
    if (mode === "register") return passwordError(pw, email) || "";
    return "";
  };
  const pw2Err = () => (needPw2 && pw2 && pw !== pw2 ? "비밀번호가 일치하지 않습니다." : "");

  // 화면 표시용(터치된 필드만 노출; 비밀번호 확인은 입력 즉시)
  const showNameErr = touched.name ? nameErr() : "";
  const showEmailErr = touched.email ? emailErr() : "";
  const showPwErr = touched.pw ? pwErr() : "";
  const showPw2Err = pw2 ? pw2Err() : "";

  const setAll = (v: boolean) => {
    setAgreeTos(v);
    setAgreePrivacy(v);
  };

  const startCooldown = (s: number) => setCooldown(s);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTouched({ name: true, email: true, pw: true, pw2: true });

    // 클라이언트 필드 검증 — 에러는 각 필드 인라인으로 노출
    if (nameErr() || emailErr() || pwErr() || pw2Err()) {
      setErr("");
      return;
    }
    if (mode === "register" && !agreedRequired) {
      setErr("필수 약관에 동의해 주세요.");
      return;
    }
    // 허니팟: 사람에겐 보이지 않는 필드가 채워졌다면 봇 → 조용히 중단(비용 0 봇차단)
    if (mode === "register" && hp.trim()) return;
    setErr("");
    setBusy(true);
    try {
      if (mode === "register") {
        const consent: Consent = {
          tosVer: TOS_VER,
          privacyVer: PRIVACY_VER,
          agreedAt: new Date().toISOString(),
        };
        const res = await Auth.register(name.trim(), email.trim(), pw, consent);
        if (!res.ok) {
          setErr(res.msg || "계정 생성에 실패했습니다.");
          return;
        }
        if (res.loggedIn) {
          toast("환영합니다! 계정이 생성되었습니다.");
          navigate("/", { replace: true });
        } else {
          // 이메일 인증이 켜져 있어 즉시 로그인되지 않음 → 인증 안내 화면
          setVerifyEmail(email.trim());
          startCooldown(60);
        }
        return;
      }

      if (mode === "findEmail") {
        const res = await Auth.findEmails(name.trim());
        if (!res.ok) {
          setErr(res.msg || "이메일을 찾지 못했습니다.");
          return;
        }
        setFoundEmails(res.emails || []);
        return;
      }

      if (mode === "resetPw") {
        const res = await Auth.sendResetEmail(email.trim());
        if (!res.ok) {
          setErr(res.msg || "메일 발송에 실패했습니다.");
          return;
        }
        setSent(true);
        startCooldown(60);
        return;
      }

      // login
      const res = await Auth.login(email.trim(), pw);
      if (!res.ok) {
        if (res.needVerify) {
          // 미인증 계정 → 인증 안내 화면으로 전환(재발송 가능)
          setVerifyEmail(email.trim());
          return;
        }
        setErr(res.msg || "로그인에 실패했습니다.");
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  // 인증 메일 재발송
  const resendVerify = async () => {
    if (cooldown > 0 || busy || !verifyEmail) return;
    setBusy(true);
    try {
      const r = await Auth.resendVerification(verifyEmail);
      toast(r.msg || (r.ok ? "다시 보냈습니다." : "재발송에 실패했습니다."));
      if (r.ok) startCooldown(60);
    } finally {
      setBusy(false);
    }
  };

  // 재설정 메일 재발송
  const resendReset = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      const r = await Auth.sendResetEmail(email.trim());
      toast(r.msg || "다시 보냈습니다.");
      if (r.ok) startCooldown(60);
    } finally {
      setBusy(false);
    }
  };

  const submitLabel = busy
    ? "처리 중…"
    : mode === "resetPw"
      ? "재설정 메일 보내기"
      : titleByMode[mode];

  return (
    <div className="auth-split">
      {/* 좌측 브랜드·가치제안 패널(데스크톱) */}
      <aside className="auth-aside">
        <div className="aside-mark">애드텍디자인 · 전자견적</div>
        <div className="aside-hero">
          <h2>간판·현수막 견적,<br />더 빠르고 단순하게.</h2>
          <p className="aside-sub">
            견적 작성부터 발송·전자계약·정산까지 한 곳에서. 옥외광고 업무에 최적화된 전자견적 SaaS.
          </p>
        </div>
        <ul className="aside-list">
          <li><span className="tick"><CheckCircle2 size={14} /></span> 전자견적서 발송 · 열람/수락 추적</li>
          <li><span className="tick"><CheckCircle2 size={14} /></span> 전자계약 · 다중 서명</li>
          <li><span className="tick"><CheckCircle2 size={14} /></span> 정산 · 세금계산서 · 매출 리포트</li>
        </ul>
      </aside>

      {/* 우측 폼 */}
      <div className="auth-main">
        <div className="auth-card">
          <div className="logo-row">
            <img className="auth-logo" src="/logo.png" alt="애드텍디자인" />
          </div>
          <div className="auth-head">
            <h1 className="auth-title">{titleByMode[mode]}</h1>
            <p className="auth-desc">{descByMode[mode]}</p>
          </div>

          {mode === "resetPw" && sent ? (
            /* 재설정 메일 발송 완료 */
            <div style={{ marginTop: 20 }}>
              <div className="banner ok" style={{ display: "block" }}>
                <CheckCircle2 size={16} /> <strong>{email}</strong> 주소로 재설정 메일을 보냈습니다.
                <br />
                메일의 링크를 눌러 새 비밀번호를 설정해 주세요. (메일이 안 보이면 스팸함도 확인)
              </div>
              <Button size="lg" block disabled={cooldown > 0 || busy} onClick={resendReset}>
                {cooldown > 0 ? `재발송 (${cooldown}초)` : "메일 재발송"}
              </Button>
              <div className="auth-toggle">
                <button onClick={() => goMode("login")}>← 로그인으로 돌아가기</button>
              </div>
            </div>
          ) : verifyEmail ? (
            /* 가입/로그인 시 이메일 인증 대기 안내 */
            <div style={{ marginTop: 20 }}>
              <div className="banner info" style={{ display: "block" }}>
                <Mail size={16} /> <strong>{verifyEmail}</strong> 주소로 인증 메일을 보냈습니다.
                <br />
                메일의 링크를 눌러 인증을 완료한 뒤 로그인해 주세요. (메일이 안 보이면 스팸함도 확인)
              </div>
              <Button variant="primary" size="lg" block disabled={cooldown > 0 || busy} onClick={resendVerify}>
                {cooldown > 0 ? `재발송 (${cooldown}초)` : "인증 메일 재발송"}
              </Button>
              <div className="auth-toggle">
                <button onClick={() => goMode("login")}>← 로그인으로 돌아가기</button>
              </div>
            </div>
          ) : mode === "findEmail" && foundEmails ? (
            /* 이메일 찾기 결과(마스킹) */
            <div style={{ marginTop: 20 }}>
              <div className="banner ok" style={{ display: "block" }}>
                <CheckCircle2 size={16} /> <strong>{name}</strong> 님으로 가입된 이메일입니다.
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {foundEmails.map((em) => (
                    <li key={em} style={{ fontWeight: 700 }}>{em}</li>
                  ))}
                </ul>
                <div className="eyebrow" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
                  보안을 위해 이메일 일부를 가렸습니다.
                </div>
              </div>
              <Button variant="primary" size="lg" block onClick={() => goMode("login")}>
                로그인하기
              </Button>
              <div className="auth-toggle" style={{ marginTop: 8 }}>
                <button onClick={() => goMode("resetPw")}>비밀번호를 잊으셨나요?</button>
              </div>
            </div>
          ) : (
            <>
              {/* 서버 오류 배너 */}
              {err && (
                <div
                  className="banner no"
                  role="alert"
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}
                >
                  <AlertTriangle size={16} /> <span>{err}</span>
                </div>
              )}

              <form onSubmit={submit} style={{ marginTop: 20 }} noValidate>
                {needName && (
                  <Field label="이름">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      placeholder="홍길동"
                      autoComplete="name"
                      aria-invalid={!!showNameErr}
                      aria-describedby={showNameErr ? "err-name" : undefined}
                      autoFocus
                    />
                    <FieldError id="err-name" msg={showNameErr} />
                  </Field>
                )}
                {needEmail && (
                  <Field label="이메일">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="you@company.com"
                      autoComplete="username"
                      aria-invalid={!!showEmailErr}
                      aria-describedby={showEmailErr ? "err-email" : undefined}
                      autoFocus={!needName}
                    />
                    <FieldError id="err-email" msg={showEmailErr} />
                    {touched.email && !showEmailErr && emailSuggest && (
                      <div className="email-suggest">
                        혹시{" "}
                        <button type="button" onClick={() => setEmail(emailSuggest)}>
                          {emailSuggest}
                        </button>{" "}
                        아닌가요?
                      </div>
                    )}
                  </Field>
                )}
                {needPw && (
                  <Field label="비밀번호">
                    <div className="pw-field">
                      <Input
                        type={showPw ? "text" : "password"}
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
                        placeholder="••••••••"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        aria-invalid={!!showPwErr}
                        aria-describedby={showPwErr ? "err-pw" : undefined}
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 표시"}
                        aria-pressed={showPw}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mode === "register" && (pw ? <PasswordStrength pw={pw} /> : (
                      <div className="eyebrow" style={{ marginTop: 6 }}>8자 이상, 영문·숫자·특수문자 조합 권장</div>
                    ))}
                    {showPwErr && <FieldError id="err-pw" msg={showPwErr} />}
                  </Field>
                )}
                {needPw2 && (
                  <Field label="비밀번호 확인">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      aria-invalid={!!showPw2Err}
                      aria-describedby={showPw2Err ? "err-pw2" : undefined}
                    />
                    <FieldError id="err-pw2" msg={showPw2Err} />
                  </Field>
                )}

                {/* 약관·개인정보 필수 동의 */}
                {mode === "register" && (
                  <div className="agree">
                    <label className="agree-all">
                      <input type="checkbox" checked={agreedRequired} onChange={(e) => setAll(e.target.checked)} />
                      <span>약관에 모두 동의합니다</span>
                    </label>
                    <div className="agree-item">
                      <label className="agree-chk">
                        <input type="checkbox" checked={agreeTos} onChange={(e) => setAgreeTos(e.target.checked)} />
                        <span><b>(필수)</b> 이용약관 동의</span>
                      </label>
                      <button type="button" className="agree-view" onClick={() => setTerms("tos")}>보기</button>
                    </div>
                    <div className="agree-item">
                      <label className="agree-chk">
                        <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
                        <span><b>(필수)</b> 개인정보 수집·이용 동의</span>
                      </label>
                      <button type="button" className="agree-view" onClick={() => setTerms("privacy")}>보기</button>
                    </div>
                  </div>
                )}

                {/* 허니팟 — 화면/스크린리더에서 숨김. 봇만 채운다. */}
                {mode === "register" && (
                  <div className="hp-field" aria-hidden="true">
                    <label>
                      회사 홈페이지(입력하지 마세요)
                      <input
                        type="text"
                        name="company_site_hp"
                        tabIndex={-1}
                        autoComplete="off"
                        value={hp}
                        onChange={(e) => setHp(e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {mode === "resetPw" && (
                  <div className="eyebrow" style={{ margin: "2px 0 8px" }}>
                    가입한 이메일로 재설정 링크를 보내드립니다.
                  </div>
                )}

                {mode === "findEmail" && (
                  <div className="eyebrow" style={{ margin: "2px 0 8px", textTransform: "none", letterSpacing: 0 }}>
                    가입 시 입력한 이름으로 찾습니다. 보안을 위해 이메일 일부만 표시됩니다.
                  </div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  block
                  type="submit"
                  loading={busy}
                  disabled={mode === "register" && !agreedRequired}
                  style={{ marginTop: 8 }}
                >
                  {submitLabel}
                </Button>
              </form>

              {(mode === "login" || mode === "register") && (
                <div className="auth-toggle">
                  {mode === "register" ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
                  <button onClick={() => goMode(mode === "register" ? "login" : "register")}>
                    {mode === "register" ? "로그인" : "계정 만들기"}
                  </button>
                </div>
              )}

              {mode === "login" && (
                <div className="auth-toggle" style={{ marginTop: 8 }}>
                  <button onClick={() => goMode("findEmail")}>이메일 찾기</button>
                  <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                  <button onClick={() => goMode("resetPw")}>비밀번호를 잊으셨나요?</button>
                </div>
              )}

              {(mode === "resetPw" || mode === "findEmail") && (
                <div className="auth-toggle">
                  <button onClick={() => goMode("login")}>← 로그인으로 돌아가기</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 약관 보기 모달 */}
      {terms && (
        <Modal
          title={`${TERMS_TEXT[terms].title} (v${TERMS_TEXT[terms].ver})`}
          onClose={() => setTerms(null)}
          footer={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  if (terms === "tos") setAgreeTos(true);
                  else setAgreePrivacy(true);
                  setTerms(null);
                }}
              >
                동의하고 닫기
              </Button>
              <Button onClick={() => setTerms(null)}>닫기</Button>
            </>
          }
        >
          <div className="terms-doc">
            <span className="terms-note">※ 아래는 샘플 문구입니다. 실제 약관으로 교체해 주세요.</span>
            {TERMS_TEXT[terms].body}
          </div>
        </Modal>
      )}
    </div>
  );
}
