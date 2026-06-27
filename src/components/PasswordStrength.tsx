import { Check, X } from "lucide-react";
import { pwChecklist, pwScore, STRENGTH } from "@/lib/password";

// 비밀번호 강도 바 + 요건 체크리스트. 가입·재설정 화면에서 공용.
export default function PasswordStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const sc = pwScore(pw);
  const m = STRENGTH[sc];
  const checks = pwChecklist(pw);
  return (
    <div className="pw-meter">
      <div className="pw-strength">
        <div className="pw-bars" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`pw-bar${i <= sc ? ` on ${m.cls}` : ""}`} />
          ))}
        </div>
        <span className={`pw-strength-label ${m.cls}`}>{m.label}</span>
      </div>
      <ul className="pw-checks">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "ok" : ""}>
            {c.ok ? <Check size={13} /> : <X size={13} />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
