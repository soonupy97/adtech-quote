import { pwScore, STRENGTH } from "@/lib/password";

// 비밀번호 강도 바 + 라벨. 가입·재설정 화면에서 공용.
export default function PasswordStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const sc = pwScore(pw);
  const m = STRENGTH[sc];
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
    </div>
  );
}
