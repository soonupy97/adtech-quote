import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { store } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { Button, Field, Input, Modal } from "@/components/ui";
import type { Settings } from "@/types";

// 가입 직후 1회 — 견적서·계약서에 쓰일 공급자(우리 회사) 정보를 받는다.
// 가입 폼을 가볍게 유지하기 위해 회사 정보는 이 온보딩 단계로 분리.
const BIZNO_RE = /^\d{3}-?\d{2}-?\d{5}$/;
export const ONBOARD_SKIP_KEY = "oad_onboard_company_skipped";

export default function OnboardingCompany({
  managerName,
  onClose,
}: {
  managerName?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [name, setName] = useState("");
  const [bizno, setBizno] = useState("");
  const [ceo, setCeo] = useState("");
  const [tel, setTel] = useState("");
  const [addr, setAddr] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store.getSettings().then((s) => {
      setSettings(s);
      const sup = s.supplier || ({} as Settings["supplier"]);
      setName(sup.name || "");
      setBizno(sup.bizno || "");
      setCeo(sup.ceo || "");
      setTel(sup.tel || "");
      setAddr(sup.addr || "");
    });
  }, []);

  const nameErr = !name.trim() ? "회사명(상호)을 입력해 주세요." : "";
  const biznoErr =
    bizno.trim() && !BIZNO_RE.test(bizno.trim())
      ? "사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)."
      : "";

  const save = async () => {
    setTouched(true);
    if (nameErr || biznoErr || !settings || busy) return;
    setBusy(true);
    try {
      await store.saveSettings({
        ...settings,
        supplier: {
          name: name.trim(),
          bizno: bizno.trim(),
          ceo: ceo.trim(),
          addr: addr.trim(),
          tel: tel.trim(),
          manager: settings.supplier?.manager || managerName || "",
        },
      });
      localStorage.removeItem(ONBOARD_SKIP_KEY);
      toast("회사 정보를 저장했습니다.", "success");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    // 한 번 미루면 다음 세션부터 자동으로 다시 띄우지 않는다(설정에서 입력 가능)
    localStorage.setItem(ONBOARD_SKIP_KEY, "1");
    onClose();
  };

  return (
    <Modal
      title="회사 정보 입력"
      onClose={skip}
      footer={
        <>
          <Button variant="primary" onClick={save} loading={busy}>
            저장하고 시작
          </Button>
          <Button variant="ghost" onClick={skip}>
            나중에 하기
          </Button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: -4, marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
        견적서·계약서에 표시될 <b>공급자(우리 회사)</b> 정보입니다. 지금 입력하면 견적 작성이 더 빨라집니다.
        (설정에서 언제든 수정할 수 있어요.)
      </p>
      <Field label="회사명(상호)">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="(주)애드텍디자인"
          autoComplete="organization"
          aria-invalid={!!(touched && nameErr)}
          autoFocus
        />
        {touched && nameErr && (
          <div className="field-error" role="alert">
            <AlertTriangle size={12} /> <span>{nameErr}</span>
          </div>
        )}
      </Field>
      <Field label="사업자등록번호 (선택)">
        <Input
          value={bizno}
          onChange={(e) => setBizno(e.target.value)}
          placeholder="123-45-67890"
          inputMode="numeric"
          aria-invalid={!!biznoErr}
        />
        {biznoErr && (
          <div className="field-error" role="alert">
            <AlertTriangle size={12} /> <span>{biznoErr}</span>
          </div>
        )}
      </Field>
      <div className="grid cols-2">
        <Field label="대표자명 (선택)">
          <Input value={ceo} onChange={(e) => setCeo(e.target.value)} placeholder="홍길동" />
        </Field>
        <Field label="대표 전화 (선택)">
          <Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="02-0000-0000" inputMode="tel" autoComplete="tel" />
        </Field>
      </div>
      <Field label="사업장 주소 (선택)">
        <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="서울특별시 …" autoComplete="street-address" />
      </Field>
    </Modal>
  );
}
