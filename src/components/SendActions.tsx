import { Share2, MessageSquare, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  quoteMessage,
  quoteSubject,
  canNativeShare,
  isMobile,
  nativeShare,
  smsHref,
  mailtoHref,
  openHref,
  copyText,
} from "@/lib/share";

interface Props {
  url: string;
  tel?: string;
  email?: string;
  customer?: string;
  company?: string;
  quoteNo?: string;
  size?: "sm" | "md";
}

// 견적 발송 링크를 "보조 발송"(공유 시트/문자앱/메일/복사)으로 전달하는 버튼 묶음.
export default function SendActions({ url, tel, email, customer, company, quoteNo, size = "sm" }: Props) {
  const toast = useToast();
  const msg = quoteMessage({ company, customer, quoteNo, url });
  const subject = quoteSubject({ company, quoteNo });

  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {canNativeShare() && (
        <Button
          size={size}
          variant="secondary"
          icon={<Share2 size={15} />}
          onClick={async () => {
            const ok = await nativeShare({ title: subject, text: msg, url });
            if (!ok) toast("공유가 취소되었습니다.");
          }}
        >
          공유 (카카오톡 등)
        </Button>
      )}
      <Button
        size={size}
        icon={<MessageSquare size={15} />}
        onClick={async () => {
          if (isMobile()) {
            openHref(smsHref(tel, msg));
          } else {
            await copyText(msg);
            toast("문자 앱은 휴대폰에서 열려요. 메시지를 복사했습니다.");
          }
        }}
      >
        문자
      </Button>
      <Button size={size} icon={<Mail size={15} />} onClick={() => openHref(mailtoHref(email, subject, msg))}>
        메일
      </Button>
      <Button
        size={size}
        icon={<Copy size={15} />}
        onClick={async () => {
          toast((await copyText(url)) ? "링크를 복사했습니다." : "복사에 실패했습니다.");
        }}
      >
        링크 복사
      </Button>
    </div>
  );
}
