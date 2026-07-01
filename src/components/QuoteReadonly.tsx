import { Minus, Plus } from "lucide-react";
import type { Quote } from "@/types";
import { calcTotals, fmtDate, itemAmount, won } from "@/lib/quote";
import { areaInSqm, dimLabel } from "@/lib/units";
import { InfoBox, KeyValue } from "@/components/ui";

// 견적 전문 읽기전용 렌더 (§14.2 renderReadonly → 컴포넌트)
export default function QuoteReadonly({ quote: q }: { quote: Quote }) {
  const t = calcTotals(q);
  const constructions = (q.constructions || []).filter((c) => c.checked);
  const permits = (q.permits || []).filter((c) => c.checked);
  const etc = (q.etcCosts || []).filter((c) => c.checked);
  const sur = q.adjustments?.surcharge || [];
  const dis = q.adjustments?.discount || [];

  return (
    <div className="qdoc">
      <h2>견 적 서</h2>
      <div className="qmeta">
        {q.quote_no} · 발행일 {fmtDate(q.created_at)}
        {q.validity ? ` · 유효기간 ${q.validity}` : ""}
      </div>

      <div className="twocol">
        <InfoBox title="공급자">
          <KeyValue k="상호">{q.supplier?.name}</KeyValue>
          <KeyValue k="사업자">{q.supplier?.bizno}</KeyValue>
          <KeyValue k="대표">{q.supplier?.ceo}</KeyValue>
          <KeyValue k="주소">{q.supplier?.addr}</KeyValue>
          <KeyValue k="연락처">{q.supplier?.tel}</KeyValue>
          <KeyValue k="담당">{q.supplier?.manager}</KeyValue>
          <KeyValue k="업종">{q.supplier?.upjong}</KeyValue>
          <KeyValue k="업태">{q.supplier?.uptae}</KeyValue>
        </InfoBox>
        <InfoBox title="공급받는자 (고객)">
          <KeyValue k="상호/성함">{q.customer?.name}</KeyValue>
          <KeyValue k="연락처">{q.customer?.tel}</KeyValue>
          <KeyValue k="주소">{q.customer?.addr}</KeyValue>
          <div className="bt" style={{ marginTop: 12 }}>현장</div>
          <KeyValue k="층/위치">{q.site?.floor}</KeyValue>
          <KeyValue k="설치높이">{q.site?.height}</KeyValue>
          <KeyValue k="도로/접면">{q.site?.road}</KeyValue>
        </InfoBox>
      </div>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>광고물</th>
              <th>규격(가로×세로)</th>
              <th>면적</th>
              <th className="amt">단가</th>
              <th className="amt">수량</th>
              <th className="amt">금액</th>
            </tr>
          </thead>
          <tbody>
            {(q.items || []).map((it, i) => {
              const area = areaInSqm(it, q.dimUnit);
              return (
                <tr key={i}>
                  <td>{it.type}</td>
                  <td>{it.w || it.h ? `${it.w || "-"} × ${it.h || "-"} ${dimLabel(q.dimUnit)}` : "-"}</td>
                  <td>{area ? `${area} ㎡` : "-"}</td>
                  <td className="amt">{won(it.price)}</td>
                  <td className="amt">{it.qty}</td>
                  <td className="amt">{won(itemAmount(it))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(constructions.length > 0 || permits.length > 0 || etc.length > 0) && (
        <div className="table-wrap" style={{ marginBottom: 20 }}>
          <table className="table">
            <thead>
              <tr>
                <th>항목</th>
                <th>구분</th>
                <th className="amt">금액</th>
              </tr>
            </thead>
            <tbody>
              {constructions.map((c, i) => (
                <tr key={`c${i}`}>
                  <td>{c.name}</td>
                  <td><span className="chip">시공·설치</span></td>
                  <td className="amt">{won(c.cost)}</td>
                </tr>
              ))}
              {permits.map((c, i) => (
                <tr key={`p${i}`}>
                  <td>{c.name}</td>
                  <td><span className="chip">인허가·행정</span></td>
                  <td className="amt">{won(c.cost)}</td>
                </tr>
              ))}
              {etc.map((c, i) => (
                <tr key={`e${i}`}>
                  <td>{c.name}</td>
                  <td><span className="chip">부대비용</span></td>
                  <td className="amt">{won(c.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="totals">
        <div className="line"><span>품목 합계</span><span className="v">{won(t.items)}</span></div>
        <div className="line"><span>시공·설치비</span><span className="v">{won(t.construct)}</span></div>
        <div className="line"><span>인허가·행정비</span><span className="v">{won(t.permit)}</span></div>
        <div className="line"><span>부대비용</span><span className="v">{won(t.etc)}</span></div>
        <div className="line sep"><span>소계</span><span className="v">{won(t.subtotal)}</span></div>
        {sur.map((s, i) => (
          <div className="line" key={`s${i}`}>
            <span><Plus size={14} /> {s.label || "할증"} {s.mode === "pct" ? `(${s.value}%)` : ""}</span>
            <span className="v">{won(s.mode === "pct" ? (t.subtotal * s.value) / 100 : s.value)}</span>
          </div>
        ))}
        {dis.map((d, i) => (
          <div className="line" key={`d${i}`}>
            <span><Minus size={14} /> {d.label || "할인"} {d.mode === "pct" ? `(${d.value}%)` : ""}</span>
            <span className="v">-{won(d.mode === "pct" ? (t.subtotal * d.value) / 100 : d.value)}</span>
          </div>
        ))}
        <div className="line sep"><span>공급가액</span><span className="v">{won(t.supply)}</span></div>
        <div className="line"><span>부가세 (10%)</span><span className="v">{won(t.vat)}</span></div>
        <div className="grand">
          <span className="label">총 견적금액 (VAT 포함)</span>
          <span className="v">{won(t.grand)}</span>
        </div>
      </div>

      {(q.paymentTerms?.deposit || q.paymentTerms?.balance || q.paymentTerms?.as) && (
        <InfoBox title="결제 조건" style={{ marginTop: 20 }}>
          {q.paymentTerms?.deposit && <KeyValue k="계약금">{q.paymentTerms.deposit}</KeyValue>}
          {q.paymentTerms?.balance && <KeyValue k="잔금">{q.paymentTerms.balance}</KeyValue>}
          {q.paymentTerms?.as && <KeyValue k="A/S">{q.paymentTerms.as}</KeyValue>}
        </InfoBox>
      )}

      {q.notes && (
        <InfoBox title="비고" style={{ marginTop: 16 }}>
          <div style={{ whiteSpace: "pre-wrap", color: "var(--text-2)" }}>{q.notes}</div>
        </InfoBox>
      )}
    </div>
  );
}
