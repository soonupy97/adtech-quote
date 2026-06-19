import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { fireZapier, notifySlack } from "@/lib/integrations";
import { uuid } from "@/lib/quote";
import type { Settings } from "@/types";
import { useToast } from "@/components/Toast";
import { AlertTriangle } from "lucide-react";

// 부록 A27 연동 & 자동화: Slack/이메일/카카오/캘린더/Zapier/API
export default function IntegrationsPage({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => { store.getSettings().then(setS); }, []);
  if (!s) return <div className="empty" style={{ paddingTop: 80 }}>불러오는 중…</div>;
  const ig = s.integrations || {};
  const set = (patch: Partial<typeof ig>) => setS({ ...s, integrations: { ...ig, ...patch } });

  const save = async () => { await store.saveSettings(s); toast("연동 설정을 저장했습니다."); };
  const testSlack = async () => {
    const ok = await notifySlack(ig, "🔔 옥외광고 견적 SaaS 연동 테스트 메시지");
    toast(ok ? "Slack 으로 전송했습니다." : "Webhook URL을 먼저 입력/저장하세요.");
  };
  const testZapier = async () => {
    const ok = await fireZapier(ig, { event: "test", at: new Date().toISOString() });
    toast(ok ? "Zapier 웹훅을 호출했습니다." : "Zapier Webhook URL을 먼저 입력/저장하세요.");
  };
  const genApiKey = () => set({ apiKey: `oad_${uuid().replace(/-/g, "")}` });

  return (
    <>
      {!embedded && <div className="page-head"><div><h1>연동</h1><div className="sub">알림·캘린더·자동화·API</div></div></div>}

      <div className="card">
        <div className="card-title">알림 연동</div>
        <label className="field"><span>Slack Incoming Webhook URL</span>
          <input value={ig.slackWebhook || ""} onChange={(e) => set({ slackWebhook: e.target.value })} placeholder="https://hooks.slack.com/services/..." />
        </label>
        <div className="row"><button className="btn sm soft" onClick={testSlack}>Slack 테스트 전송</button></div>
        <label className="field" style={{ marginTop: 14 }}><span>발신 이메일(알림 from)</span>
          <input value={ig.emailFrom || ""} onChange={(e) => set({ emailFrom: e.target.value })} placeholder="noreply@company.com" />
        </label>
        <label className="field"><span>카카오 알림톡 발신프로필 키</span>
          <input value={ig.kakaoSenderKey || ""} onChange={(e) => set({ kakaoSenderKey: e.target.value })} placeholder="솔라피/알리고 발신키" />
        </label>
        <div className="dim"><AlertTriangle size={16} /> 카카오 알림톡/문자 실제 자동발송은 사업자 인증 + 발송대행사(솔라피·알리고) 연동이 필요합니다(블루프린트 §14.5).</div>
      </div>

      <div className="card">
        <div className="card-title">캘린더 & 자동화</div>
        <label className="field"><span>구글 캘린더 공유 URL</span>
          <input value={ig.calendarUrl || ""} onChange={(e) => set({ calendarUrl: e.target.value })} placeholder="https://calendar.google.com/..." />
        </label>
        <label className="field"><span>Zapier Webhook URL</span>
          <input value={ig.zapierWebhook || ""} onChange={(e) => set({ zapierWebhook: e.target.value })} placeholder="https://hooks.zapier.com/..." />
        </label>
        <div className="row"><button className="btn sm soft" onClick={testZapier}>Zapier 테스트 호출</button></div>
      </div>

      <div className="card">
        <div className="card-title">공개 API</div>
        <label className="field"><span>API Key</span>
          <input readOnly value={ig.apiKey || "(미발급)"} />
        </label>
        <div className="row"><button className="btn sm" onClick={genApiKey}>새 키 발급</button></div>
        <div className="dim">외부 자동화(수락 시 웹훅 등)와 REST API 인증에 사용합니다.</div>
      </div>

      {embedded ? (
        <div className="row"><button className="btn primary" onClick={save}>연동 설정 저장</button></div>
      ) : (
        <div className="actionbar"><button className="btn primary" onClick={save}>저장</button></div>
      )}
    </>
  );
}
