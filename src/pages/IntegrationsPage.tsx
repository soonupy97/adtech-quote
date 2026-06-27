import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { fireZapier, notifySlack } from "@/lib/integrations";
import { uuid } from "@/lib/quote";
import type { Settings } from "@/types";
import { Button, Field, Input, PageTitle } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { AlertTriangle } from "lucide-react";

// 부록 A27 연동 & 자동화: Slack/이메일/카카오/캘린더/Zapier/API
export default function IntegrationsPage({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => { store.getSettings().then(setS); }, []);
  if (!s) return <div className="empty" style={{ paddingTop: 64 }}>불러오는 중…</div>;
  const ig = s.integrations || {};
  const set = (patch: Partial<typeof ig>) => setS({ ...s, integrations: { ...ig, ...patch } });

  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await store.saveSettings(s); toast("연동 설정을 저장했습니다.", "success"); }
    finally { setSaving(false); }
  };
  const testSlack = async () => {
    const ok = await notifySlack(ig, "🔔 옥외광고 견적 SaaS 연동 테스트 메시지");
    toast(ok ? "Slack 으로 전송했습니다." : "Webhook URL을 먼저 입력/저장하세요.", ok ? "success" : "warning");
  };
  const testZapier = async () => {
    const ok = await fireZapier(ig, { event: "test", at: new Date().toISOString() });
    toast(ok ? "Zapier 웹훅을 호출했습니다." : "Zapier Webhook URL을 먼저 입력/저장하세요.", ok ? "success" : "warning");
  };
  const genApiKey = () => set({ apiKey: `oad_${uuid().replace(/-/g, "")}` });

  return (
    <>
      {!embedded && <div className="page-head"><PageTitle title="연동" sub="알림·캘린더·자동화·API" /></div>}

      <div className="card">
        <div className="card-title">알림 연동</div>
        <Field label="Slack Incoming Webhook URL">
          <Input value={ig.slackWebhook || ""} onChange={(e) => set({ slackWebhook: e.target.value })} placeholder="https://hooks.slack.com/services/..." />
        </Field>
        <div className="row"><Button size="sm" variant="secondary" onClick={testSlack}>Slack 테스트 전송</Button></div>
        <Field label="발신 이메일(알림 from)" style={{ marginTop: 16 }}>
          <Input value={ig.emailFrom || ""} onChange={(e) => set({ emailFrom: e.target.value })} placeholder="noreply@company.com" />
        </Field>
        <Field label="카카오 알림톡 발신프로필 키">
          <Input value={ig.kakaoSenderKey || ""} onChange={(e) => set({ kakaoSenderKey: e.target.value })} placeholder="솔라피/알리고 발신키" />
        </Field>
        <div className="dim"><AlertTriangle size={16} /> 카카오 알림톡/문자 실제 자동발송은 사업자 인증 + 발송대행사(솔라피·알리고) 연동이 필요합니다(블루프린트 §14.5).</div>
      </div>

      <div className="card">
        <div className="card-title">캘린더 & 자동화</div>
        <Field label="구글 캘린더 공유 URL">
          <Input value={ig.calendarUrl || ""} onChange={(e) => set({ calendarUrl: e.target.value })} placeholder="https://calendar.google.com/..." />
        </Field>
        <Field label="Zapier Webhook URL">
          <Input value={ig.zapierWebhook || ""} onChange={(e) => set({ zapierWebhook: e.target.value })} placeholder="https://hooks.zapier.com/..." />
        </Field>
        <div className="row"><Button size="sm" variant="secondary" onClick={testZapier}>Zapier 테스트 호출</Button></div>
      </div>

      <div className="card">
        <div className="card-title">공개 API</div>
        <Field label="API Key">
          <Input readOnly value={ig.apiKey || "(미발급)"} />
        </Field>
        <div className="row"><Button size="sm" onClick={genApiKey}>새 키 발급</Button></div>
        <div className="dim">외부 자동화(수락 시 웹훅 등)와 REST API 인증에 사용합니다.</div>
      </div>

      {embedded ? (
        <div className="row"><Button variant="primary" loading={saving} onClick={save}>연동 설정 저장</Button></div>
      ) : (
        <div className="actionbar"><Button variant="primary" loading={saving} onClick={save}>저장</Button></div>
      )}
    </>
  );
}
