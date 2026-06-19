import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@/lib/auth";
import { isSupabaseEnabled } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { AlertTriangle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  // 이미 로그인 상태면 대시보드로
  useEffect(() => {
    Auth.current().then((s) => {
      if (s) navigate("/", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "register") {
        const res = await Auth.register(name.trim(), id.trim(), pw);
        if (!res.ok) {
          toast(res.msg || "계정 생성에 실패했습니다.");
          return;
        }
        if (res.loggedIn) {
          navigate("/", { replace: true });
        } else {
          // 세션이 바로 생기지 않은 경우(이메일 인증이 켜져 있을 때)
          toast("계정이 생성되었습니다. 로그인해 주세요.");
          setMode("login");
          setPw("");
        }
        return;
      }
      const res = await Auth.login(id.trim(), pw);
      if (!res.ok) {
        toast(res.msg || "로그인에 실패했습니다.");
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

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

        <form onSubmit={submit} style={{ marginTop: 18 }}>
          {mode === "register" && (
            <label className="field">
              <span>이름</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
            </label>
          )}
          <label className="field">
            <span>아이디</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="영문/숫자 3~30자"
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
            />
          </label>
          <button className="btn primary block lg" type="submit" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? "처리 중…" : mode === "register" ? "계정 만들기" : "로그인"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "register" ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
          <button onClick={() => setMode(mode === "register" ? "login" : "register")}>
            {mode === "register" ? "로그인" : "계정 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}
