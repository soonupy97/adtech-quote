import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  /** 금액/숫자 우측 정렬(.amt) + 천 단위 콤마 표시 */
  amount?: boolean;
}

// 정수부에 천 단위 콤마를 넣어 표시(소수부·부호는 보존). 예: "7000000" → "7,000,000"
function groupThousands(s: string): string {
  if (s === "") return "";
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const dot = body.indexOf(".");
  const int = dot === -1 ? body : body.slice(0, dot);
  const frac = dot === -1 ? null : body.slice(dot + 1);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + (frac === null ? grouped : `${grouped}.${frac}`);
}

// 전역 input 스타일을 쓰는 얇은 래퍼. ref 전달 지원(파일 input 등).
// amount 일 때는 표시값에만 콤마를 넣고, onChange 는 그대로 전달한다
// (호출부가 이미 입력값에서 숫자만 추출해 저장하므로 콤마는 무해).
const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { amount, className, value, ...rest },
  ref
) {
  const cls = [amount && "amt", className].filter(Boolean).join(" ") || undefined;
  const display = amount ? groupThousands(value == null ? "" : String(value)) : value;
  return <input ref={ref} className={cls} value={display} {...rest} />;
});

export default Input;
