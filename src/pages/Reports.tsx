import { useEffect, useMemo, useState } from "react";
import { store } from "@/lib/store";
import { calcTotals, itemAmount, won } from "@/lib/quote";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { Quote, QuoteSummary } from "@/types";
import { Button } from "@/components/ui";

// 부록 A25 매출 리포트 · 전환 퍼널 · 랭킹
export default function Reports() {
  const [summaries, setSummaries] = useState<QuoteSummary[]>([]);
  const [accepted, setAccepted] = useState<Quote[]>([]);
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    store.listQuotes().then(async (qs) => {
      setSummaries(qs);
      const acc = await Promise.all(qs.filter((q) => q.status === "accepted").map((q) => store.getQuote(q.id)));
      setAccepted(acc.filter(Boolean) as Quote[]);
    });
    store.leads.list().then((l) => setLeadCount(l.length));
  }, []);

  // 전환 퍼널
  const funnel = useMemo(() => {
    const quoted = summaries.length;
    const sent = summaries.filter((q) => q.status !== "draft").length;
    const acc = summaries.filter((q) => q.status === "accepted").length;
    const base = Math.max(leadCount, quoted, 1);
    return [
      { label: "문의", n: leadCount, pct: (leadCount / base) * 100 },
      { label: "견적작성", n: quoted, pct: (quoted / base) * 100 },
      { label: "발송", n: sent, pct: (sent / base) * 100 },
      { label: "수락", n: acc, pct: (acc / base) * 100 },
    ];
  }, [summaries, leadCount]);

  // 월별 매출 추이(최근 6개월, 수락 견적 grand 합)
  const trend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; amt: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: `${d.getMonth() + 1}월`, amt: 0 });
    }
    for (const q of accepted) {
      const key = (q.responded_at || q.created_at || "").slice(0, 7);
      const m = months.find((x) => x.key === key);
      if (m) m.amt += calcTotals(q).grand;
    }
    return months;
  }, [accepted]);
  const maxAmt = Math.max(1, ...trend.map((m) => m.amt));

  // 품목별 / 고객별 랭킹 (수락 기준)
  const byItem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of accepted) for (const it of q.items) map[it.type] = (map[it.type] || 0) + itemAmount(it);
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [accepted]);
  const byClient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of accepted) {
      const name = q.customer?.name || "(미지정)";
      map[name] = (map[name] || 0) + calcTotals(q).grand;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [accepted]);

  const totalSales = accepted.reduce((s, q) => s + calcTotals(q).grand, 0);
  const avgQuote = summaries.length ? Math.round(summaries.reduce((s, q) => s + q.grand, 0) / summaries.length) : 0;
  const avgWon = accepted.length ? Math.round(totalSales / accepted.length) : 0;

  const exportCSV = () => {
    const rows = summaries.map((q) => ({
      견적번호: q.quote_no, 고객: q.customer, 상태: q.status, 총액: q.grand, 작성일: q.created_at,
    }));
    downloadCSV("견적목록.csv", toCSV(rows));
  };

  return (
    <>
      <div className="color-block plain" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="eyebrow">분석 · REPORTS</div>
          <div className="display" style={{ marginTop: 12 }}>전환 퍼널 · 매출 추이 · 랭킹</div>
        </div>
        <Button variant="inverse" onClick={exportCSV}>CSV 내보내기</Button>
      </div>

      <div className="bento">
        <div className="tile feature col-2 row-2">
          <div className="k">누적 수주 매출</div>
          <div className="push-bottom">
            <div className="v-lg">{won(totalSales)}</div>
            <div className="bento-foot">평균 수주가 {won(avgWon)}</div>
          </div>
        </div>
        <div className="tile">
          <div className="k">평균 견적가</div>
          <div className="v push-bottom">{won(avgQuote)}</div>
        </div>
        <div className="tile">
          <div className="k">평균 수주가</div>
          <div className="v push-bottom">{won(avgWon)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">전환 퍼널</div>
        <div className="funnel">
          {funnel.map((f, i) => (
            <div className="step" key={f.label}>
              <div className="lab">{f.label}</div>
              <div className="bar" style={{ width: `${Math.max(f.pct, 6)}%` }}>{f.n}</div>
              {i > 0 && <div className="rate">{funnel[i - 1].n ? Math.round((f.n / funnel[i - 1].n) * 100) : 0}%</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">월별 매출 추이 (최근 6개월)</div>
        <div className="barchart">
          {trend.map((m) => (
            <div className="b" key={m.key}>
              <div className="val">{m.amt ? `${Math.round(m.amt / 10000)}만` : ""}</div>
              <div className="fill" style={{ height: `${(m.amt / maxAmt) * 100}%` }} />
              <div className="lab">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">품목별 매출 TOP</div>
          {byItem.length === 0 ? <div className="dim">데이터 없음</div> : byItem.map(([name, amt]) => (
            <div className="totals" key={name} style={{ padding: 0, background: "none" }}>
              <div className="line"><span>{name}</span><span className="v">{won(amt)}</span></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">고객별 매출 TOP</div>
          {byClient.length === 0 ? <div className="dim">데이터 없음</div> : byClient.map(([name, amt]) => (
            <div className="totals" key={name} style={{ padding: 0, background: "none" }}>
              <div className="line"><span>{name}</span><span className="v">{won(amt)}</span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
