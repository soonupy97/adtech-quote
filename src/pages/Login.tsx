import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@/lib/auth";
import { isSupabaseEnabled } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { Button, Field, Input } from "@/components/ui";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type Mode = "login" | "register" | "resetPw" | "findId";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [sent, setSent] = useState(false); // 재설정 메일 발송 완료 화면
  const [foundEmails, setFoundEmails] = useState<string[] | null>(null); // 아이디 찾기 결과
  const [err, setErr] = useState(""); // 인라인 에러 메시지
  const [busy, setBusy] = useState(false);

  // 이미 로그인 상태면 대시보드로
  useEffect(() => {
    Auth.current().then((s) => {
      if (s) navigate("/", { replace: true });
    });
  }, [navigate]);

  const goMode = (m: Mode) => {
    setMode(m);
    setPw("");
    setPw2("");
    setSent(false);
    setFoundEmails(null);
    setErr("");
  };

  const titleByMode: Record<Mode, string> = {
    login: "로그인",
    register: "계정 만들기",
    resetPw: "비밀번호 재설정",
    findId: "아이디(이메일) 찾기",
  };

  // 로컬 모드의 재설정은 이름 본인확인 + 새 비밀번호 입력이 필요
  const localReset = mode === "resetPw" && !isSupabaseEnabled;
  const supaReset = mode === "resetPw" && isSupabaseEnabled;
  const localFindId = mode === "findId" && !isSupabaseEnabled;
  const supaFindId = mode === "findId" && isSupabaseEnabled;

  const needName = mode === "register" || localReset || localFindId;
  const needEmail = mode === "login" || mode === "register" || mode === "resetPw";
  const needPw = mode === "login" || mode === "register" || localReset;
  const needPw2 = mode === "register" || localReset;

  // 제출 전 클라이언트 검증 — 에러 케이스를 인라인으로 안내
  const validate = (): string | null => {
    if (needName && !name.trim()) return "이름을 입력해 주세요.";
    if (needEmail && !email.trim()) return "이메일을 입력해 주세요.";
    if (needEmail && !EMAIL_RE.test(email.trim())) return "올바른 이메일 형식을 입력해 주세요.";
    if (needPw && !pw) return "비밀번호를 입력해 주세요.";
    if ((mode === "register" || localReset) && pw.length < 6) return "비밀번호는 6자 이상이어야 합니다.";
    if (needPw2 && pw !== pw2) return "비밀번호가 일치하지 않습니다.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");

    const ve = validate();
    if (ve) {
      setErr(ve);
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        const res = await Auth.register(name.trim(), email.trim(), pw);
        if (!res.ok) {
          setErr(res.msg || "계정 생성에 실패했습니다.");
          return;
        }
        if (res.loggedIn) {
          toast("환영합니다! 계정이 생성되었습니다.");
          navigate("/", { replace: true });
        } else {
          // 세션이 바로 생기지 않은 경우(이메일 인증이 켜져 있을 때)
          toast("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
          goMode("login");
        }
        return;
      }

      if (mode === "findId") {
        const res = await Auth.findEmails(name.trim());
        if (!res.ok) {
          setErr(res.msg || "아이디를 찾지 못했습니다.");
          return;
        }
        setFoundEmails(res.emails || []);
        return;
      }

      if (mode === "resetPw") {
        // Supabase 모드: 재설정 메일 발송 / 로컬 모드: 이름 본인확인 후 즉시 재설정
        if (isSupabaseEnabled) {
          const res = await Auth.sendResetEmail(email.trim());
          if (!res.ok) {
            setErr(res.msg || "메일 발송에 실패했습니다.");
            return;
          }
          setSent(true);
        } else {
          const res = await Auth.resetPasswordLocal(email.trim(), name.trim(), pw);
          if (!res.ok) {
            setErr(res.msg || "비밀번호 재설정에 실패했습니다.");
            return;
          }
          toast("비밀번호가 변경되었습니다. 로그인해 주세요.");
          goMode("login");
        }
        return;
      }

      // login
      const res = await Auth.login(email.trim(), pw);
      if (!res.ok) {
        setErr(res.msg || "로그인에 실패했습니다.");
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const submitLabel = busy
    ? "처리 중…"
    : supaReset
      ? "재설정 메일 보내기"
      : mode === "findId"
        ? "아이디 찾기"
        : titleByMode[mode];

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo-row">
          <img className="auth-logo" src="/logo.png" alt="애드텍디자인" />
        </div>
        <div className="eyebrow" style={{ marginTop: 4 }}>
          간판·현수막 · 전자견적서 SaaS
        </div>

        {!isSupabaseEnabled && (
          <div className="auth-note">
            <AlertTriangle size={16} /> 로컬 목업 모드 (Supabase 미설정 · 실보안 아님)
          </div>
        )}

        {/* 재설정 메일 발송 완료 */}
        {mode === "resetPw" && sent ? (
          <div style={{ marginTop: 20 }}>
            <div className="banner ok" style={{ display: "block" }}>
              <CheckCircle2 size={16} /> <strong>{email}</strong> 주소로 재설정 메일을 보냈습니다.
              <br />
              메일의 링크를 눌러 새 비밀번호를 설정해 주세요. (메일이 안 보이면 스팸함도 확인)
            </div>
            <Button size="lg" block onClick={() => goMode("login")}>
              로그인으로 돌아가기
            </Button>
          </div>
        ) : mode === "findId" && foundEmails ? (
          /* 아이디 찾기 결과 */
          <div style={{ marginTop: 20 }}>
            <div className="banner ok" style={{ display: "block" }}>
              <CheckCircle2 size={16} /> <strong>{name}</strong> 님으로 가입된 아이디입니다.
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {foundEmails.map((em) => (
                  <li key={em} style={{ fontWeight: 700 }}>{em}</li>
                ))}
              </ul>
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
            {/* 인라인 에러 케이스 */}
            {err && (
              <div className="banner no" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <AlertTriangle size={16} /> <span>{err}</span>
              </div>
            )}

            {/* 서버 인증 모드의 아이디 찾기는 안내만 */}
            {supaFindId ? (
              <div style={{ marginTop: 16 }}>
                <div className="auth-note" style={{ display: "block" }}>
                  서버 인증에서는 <strong>이메일이 곧 아이디</strong>입니다. 가입한 이메일로 로그인하거나,
                  비밀번호를 잊으셨다면 재설정을 이용해 주세요.
                </div>
                <Button variant="primary" size="lg" block onClick={() => goMode("resetPw")}>
                  비밀번호 재설정으로 이동
                </Button>
                <div className="auth-toggle" style={{ marginTop: 8 }}>
                  <button onClick={() => goMode("login")}>← 로그인으로 돌아가기</button>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={submit} style={{ marginTop: 20 }} noValidate>
                  {needName && (
                    <Field label="이름">
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoFocus />
                    </Field>
                  )}
                  {needEmail && (
                    <Field label="이메일">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        autoComplete="username"
                        autoFocus={!needName}
                      />
                    </Field>
                  )}
                  {needPw && (
                    <Field label={localReset ? "새 비밀번호" : "비밀번호"}>
                      <Input
                        type="password"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                      />
                      {(mode === "register" || localReset) && (
                        <div className="eyebrow" style={{ marginTop: 6 }}>6자 이상 입력해 주세요.</div>
                      )}
                    </Field>
                  )}
                  {needPw2 && (
                    <Field label="비밀번호 확인">
                      <Input
                        type="password"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </Field>
                  )}

                  {supaReset && (
                    <div className="eyebrow" style={{ margin: "2px 0 8px" }}>
                      가입한 이메일로 재설정 링크를 보내드립니다.
                    </div>
                  )}
                  {localFindId && (
                    <div className="eyebrow" style={{ margin: "2px 0 8px" }}>
                      가입 시 입력한 이름으로 등록된 이메일(아이디)을 찾아드립니다.
                    </div>
                  )}

                  <Button variant="primary" size="lg" block type="submit" disabled={busy} style={{ marginTop: 8 }}>
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
                    <button onClick={() => goMode("findId")}>아이디 찾기</button>
                    <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                    <button onClick={() => goMode("resetPw")}>비밀번호를 잊으셨나요?</button>
                  </div>
                )}

                {(mode === "resetPw" || mode === "findId") && (
                  <div className="auth-toggle">
                    <button onClick={() => goMode("login")}>← 로그인으로 돌아가기</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
