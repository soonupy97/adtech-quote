import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  quoteMessage,
  quoteSubject,
  canNativeShare,
  isMobile,
  nativeShare,
  copyText,
} from "@/lib/share";

interface Props {
  /** 표시·복사할 발송 링크 */
  url: string;
  /** 모바일 공유(카카오톡 등) 메시지 구성을 위한 정보(선택) */
  customer?: string;
  company?: string;
  quoteNo?: string;
  /** 모바일에서 OS 공유 시트 버튼을 함께 노출할지 (기본 true) */
  share?: boolean;
}

// 발송 링크를 읽기전용 input 으로 보여주고, input 오른쪽 끝의 아이콘으로 바로 복사한다.
// 모바일에서는 복사 아이콘 옆에 공유(카카오톡·문자·메일) 아이콘도 함께 노출.
export default function CopyLinkField({ url, customer, company, quoteNo, share = true }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const showShare = share && canNativeShare() && isMobile();

  return (
    <div className="copy-link">
      <Input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="copy-link__input"
        style={{ paddingRight: showShare ? 72 : 44 }}
      />
      <div className="copy-link__actions">
        <Button
          variant="ghost"
          size="sm"
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          title="링크 복사"
          aria-label="링크 복사"
          onClick={async () => {
            const ok = await copyText(url);
            toast(ok ? "링크를 복사했습니다." : "복사에 실패했습니다.");
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        />
        {showShare && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Share2 size={16} />}
            title="공유 (카카오톡 등)"
            aria-label="공유"
            onClick={async () => {
              const ok = await nativeShare({
                title: quoteSubject({ company, quoteNo }),
                text: quoteMessage({ company, customer, quoteNo, url }),
                url,
              });
              if (!ok) toast("공유가 취소되었습니다.");
            }}
          />
        )}
      </div>
    </div>
  );
}
