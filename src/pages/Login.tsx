import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@/lib/auth";
import { isSupabaseEnabled } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { Button, Field, Input } from "@/components/ui";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type Mode = "login" | "register" | "resetPw";

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [sent, setSent] = useState(false); // 재설정 메일 발송 완료 화면
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
  };

  const titleByMode: Record<Mode, string> = {
    login: "로그인",
    register: "계정 만들기",
    resetPw: "비밀번호 재설정",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "register") {
        if (pw !== pw2) {
          toast("비밀번호가 일치하지 않습니다.");
          return;
        }
        const res = await Auth.register(name.trim(), email.trim(), pw);
        if (!res.ok) {
          toast(res.msg || "계정 생성에 실패했습니다.");
          return;
        }
        if (res.loggedIn) {
          navigate("/", { replace: true });
        } else {
          // 세션이 바로 생기지 않은 경우(이메일 인증이 켜져 있을 때)
          toast("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
          goMode("login");
        }
        return;
      }

      if (mode === "resetPw") {
        // Supabase 모드: 재설정 메일 발송 / 로컬 모드: 이름 본인확인 후 즉시 재설정
        if (isSupabaseEnabled) {
          const res = await Auth.sendResetEmail(email.trim());
          if (!res.ok) {
            toast(res.msg || "메일 발송에 실패했습니다.");
            return;
          }
          setSent(true);
        } else {
          if (pw !== pw2) {
            toast("비밀번호가 일치하지 않습니다.");
            return;
          }
          const res = await Auth.resetPasswordLocal(email.trim(), name.trim(), pw);
          if (!res.ok) {
            toast(res.msg || "비밀번호 재설정에 실패했습니다.");
            return;
          }
          toast("비밀번호가 변경되었습니다. 로그인해 주세요.");
          goMode("login");
        }
        return;
      }

      const res = await Auth.login(email.trim(), pw);
      if (!res.ok) {
        toast(res.msg || "로그인에 실패했습니다.");
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  // 로컬 모드의 재설정은 이름 본인확인 + 새 비밀번호 입력이 필요
  const localReset = mode === "resetPw" && !isSupabaseEnabled;
  const needName = mode === "register" || localReset;
  const needPw = mode === "login" || mode === "register" || localReset;
  const needPw2 = mode === "register" || localReset;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo-row">
          <span className="logo">간</span>
          옥외광고 견적
        </div>
        <div className="eyebrow" style={{ marginTop: 4 }}>
          간판·현수막 · 전자견적서 SaaS
        </div>

        {!isSupabaseEnabled && (
          <div className="auth-note">
            <AlertTriangle size={16} /> 로컬 목업 모드 (Supabase 미설정 · 실보안 아님)
          </div>
        )}

        {mode === "resetPw" && sent ? (
          <div style={{ marginTop: 20 }}>
            <div className="auth-note" style={{ display: "block" }}>
              <CheckCircle2 size={16} /> <strong>{email}</strong> 주소로 재설정 메일을 보냈습니다.
              <br />
              메일의 링크를 눌러 새 비밀번호를 설정해 주세요. (메일이 안 보이면 스팸함도 확인)
            </div>
            <Button size="lg" block onClick={() => goMode("login")} style={{ marginTop: 12 }}>
              로그인으로 돌아가기
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} style={{ marginTop: 20 }}>
              {needName && (
                <Field label="이름">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" required />
                </Field>
              )}
              <Field label="이메일">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </Field>
              {needPw && (
                <Field label={localReset ? "새 비밀번호" : "비밀번호"}>
                  <Input
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
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
                    required
                  />
                </Field>
              )}

              {mode === "resetPw" && isSupabaseEnabled && (
                <div className="eyebrow" style={{ margin: "2px 0 8px" }}>
                  가입한 이메일로 재설정 링크를 보내드립니다.
                </div>
              )}

              <Button variant="primary" size="lg" block type="submit" disabled={busy} style={{ marginTop: 8 }}>
                {busy ? "처리 중…" : mode === "resetPw" && isSupabaseEnabled ? "재설정 메일 보내기" : titleByMode[mode]}
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
                <button onClick={() => goMode("resetPw")}>비밀번호를 잊으셨나요?</button>
              </div>
            )}

            {mode === "resetPw" && (
              <div className="auth-toggle">
                <button onClick={() => goMode("login")}>← 로그인으로 돌아가기</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
