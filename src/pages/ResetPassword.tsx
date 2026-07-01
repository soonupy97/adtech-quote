import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@/lib/auth";
import { passwordError } from "@/lib/password";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/Toast";
import { Banner, Button, Field, Input } from "@/components/ui";
import PasswordStrength from "@/components/PasswordStrength";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

// 비밀번호 재설정 메일의 링크로 돌아오는 착지 페이지.
// supabase-js 가 URL 의 복구 토큰을 감지해 임시 세션을 만들고
// PASSWORD_RECOVERY 이벤트를 발생시키면, 새 비밀번호를 입력받아 저장한다.
export default function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [ready, setReady] = useState(false); // 복구 세션 확인됨
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 링크 진입 시 복구 세션이 잡히는지 확인
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    const pe = passwordError(pw);
    if (pe) {
      setErr(pe);
      return;
    }
    if (pw !== pw2) {
      setErr("비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      const res = await Auth.updatePassword(pw);
      if (!res.ok) {
        setErr(res.msg || "비밀번호 변경에 실패했습니다.");
        return;
      }
      await Auth.logout();
      toast("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.", "success");
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo-row">
          <img className="auth-logo" src="/logo.png" alt="애드텍디자인" />
        </div>
        <div className="eyebrow" style={{ marginTop: 4 }}>
          비밀번호 재설정
        </div>

        {!ready ? (
          <div className="auth-note" style={{ display: "block", marginTop: 20 }}>
            <AlertTriangle size={16} /> 재설정 링크를 확인하는 중입니다.
            <br />
            이 페이지는 메일의 재설정 링크를 통해 접근해야 합니다. 링크가 만료됐다면 다시 요청해 주세요.
            <Button block onClick={() => navigate("/login", { replace: true })} style={{ marginTop: 12 }}>
              로그인으로 이동
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 20 }} noValidate>
            {err && (
              <Banner variant="no" icon={<AlertTriangle size={16} />}>{err}</Banner>
            )}
            <Field label="새 비밀번호">
              <div className="pw-field">
                <Input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                  required
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
              {pw ? (
                <PasswordStrength pw={pw} />
              ) : (
                <div className="eyebrow" style={{ marginTop: 6 }}>8자 이상, 영문·숫자·특수문자 조합 권장</div>
              )}
            </Field>
            <Field label="비밀번호 확인">
              <Input
                type={showPw ? "text" : "password"}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {pw2 && pw !== pw2 && (
                <div className="field-error" role="alert" style={{ marginTop: 6 }}>
                  <AlertTriangle size={12} /> <span>비밀번호가 일치하지 않습니다.</span>
                </div>
              )}
            </Field>
            <Button variant="primary" size="lg" block type="submit" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? "처리 중…" : "비밀번호 변경"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
