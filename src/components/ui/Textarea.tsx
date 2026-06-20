import { forwardRef, type TextareaHTMLAttributes } from "react";

// 전역 textarea 스타일을 쓰는 얇은 래퍼.
const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return <textarea ref={ref} {...props} />;
  }
);

export default Textarea;
