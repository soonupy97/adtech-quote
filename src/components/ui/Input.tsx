import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  /** 금액/숫자 우측 정렬(.amt) */
  amount?: boolean;
}

// 전역 input 스타일을 쓰는 얇은 래퍼. ref 전달 지원(파일 input 등).
const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { amount, className, ...rest },
  ref
) {
  const cls = [amount && "amt", className].filter(Boolean).join(" ") || undefined;
  return <input ref={ref} className={cls} {...rest} />;
});

export default Input;
