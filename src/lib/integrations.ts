// 부록 A27 연동 & 자동화: Slack/Zapier 웹훅, 이메일/카카오(시뮬), 캘린더 ICS
import type { Integrations } from "@/types";

export async function notifySlack(cfg: Integrations | undefined, text: string): Promise<boolean> {
  if (!cfg?.slackWebhook) return false;
  try {
    await fetch(cfg.slackWebhook, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function fireZapier(
  cfg: Integrations | undefined,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!cfg?.zapierWebhook) return false;
  try {
    await fetch(cfg.zapierWebhook, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

// 구글 캘린더 일정 추가 링크 (설치/미팅) — 부록 A27
export function calendarEventUrl(title: string, dateISO: string, details = ""): string {
  const d = new Date(dateISO);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`;
  // 구글 캘린더 종일 일정의 종료일은 '배타적' → 시작일과 같으면 길이 0의 빈 일정이 됨. 종료 = 시작 +1일.
  const end = new Date(d);
  end.setDate(end.getDate() + 1);
  const dates = `${fmt(d)}/${fmt(end)}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, details, dates });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// 멀티채널 자동발송(부록 A22/P3): 실제 발송은 사업자 인증+발송대행사 필요.
// 프로토타입은 채널별 동작을 시뮬레이션하고 결과 메시지를 반환.
export function simulateSend(channel: "kakao" | "sms" | "email", to: string, url: string): string {
  const map = {
    kakao: `카카오 알림톡 발송(시뮬): ${to}`,
    sms: `문자 발송(시뮬): ${to}`,
    email: `이메일 발송(시뮬): ${to}`,
  };
  return `${map[channel]} — 링크: ${url}`;
}
