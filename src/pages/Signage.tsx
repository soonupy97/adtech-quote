import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { ITEM_TYPES, fmtDate, won } from "@/lib/quote";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { QuoteSummary, Signage as SignageT } from "@/types";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { MapPin, Plus, SignpostBig } from "lucide-react";

const STATUS_LABEL: Record<SignageT["status"], string> = { active: "게시중", removed: "철거" };
const empty: SignageT = {
  id: "", name: "", customer: "", address: "", type: ITEM_TYPES[0], installDate: "",
  permitExpiry: "", status: "active", memo: "", created_at: "",
};

// 만료까지 남은 일수 (음수면 이미 만료)
function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function expiryBadge(s: SignageT) {
  if (s.status === "removed") return <span className="badge draft"><span className="dot" />철거</span>;
  const dl = daysLeft(s.permitExpiry);
  if (dl === null) return <span className="badge accepted"><span className="dot" />게시중</span>;
  if (dl < 0) return <span className="badge rejected"><span className="dot" />만료 {-dl}일 경과</span>;
  if (dl <= 30) return <span className="badge sent"><span className="dot" />D-{dl} 만료임박</span>;
  return <span className="badge accepted"><span className="dot" />게시중</span>;
}

// 옥외광고물 게시기간·허가 갱신 관리(설치 자산)
export default function Signage() {
  const toast = useToast();
  const [list, setList] = useState<SignageT[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [edit, setEdit] = useState<SignageT | null>(null);

  const load = () => store.signage.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("광고물명을 입력하세요.");
    await store.signage.save(edit);
    setEdit(null);
    await load();
    toast("저장되었습니다.");
  };
  const del = async (s: SignageT) => {
    if (!confirm(`'${s.name}' 광고물을 삭제할까요?`)) return;
    await store.signage.remove(s.id);
    await load();
  };
  // 수주 견적 → 광고물 등록 프리필
  const fromQuote = async (qid: string) => {
    if (!qid) return;
    const q = await store.getQuote(qid);
    if (!q) return;
    setEdit({
      ...empty,
      name: q.items[0]?.type || "광고물",
      customer: q.customer?.name || "",
      address: q.customer?.addr || "",
      type: q.items[0]?.type || ITEM_TYPES[0],
      quote_id: q.id,
    });
  };

  const sorted = useMemo(
    () => list.slice().sort((a, b) => (a.permitExpiry || "9999").localeCompare(b.permitExpiry || "9999")),
    [list],
  );
  const active = list.filter((s) => s.status === "active");
  const expiringSoon = active.filter((s) => { const d = daysLeft(s.permitExpiry); return d !== null && d >= 0 && d <= 30; }).length;
  const expired = active.filter((s) => { const d = daysLeft(s.permitExpiry); return d !== null && d < 0; }).length;

  const exportCSV = () => {
    downloadCSV("광고물.csv", toCSV(list.map((s) => ({
      광고물명: s.name, 고객: s.customer, 위치: s.address, 종류: s.type,
      설치일: s.installDate, 만료일: s.permitExpiry, 상태: STATUS_LABEL[s.status],
    }))));
  };

  return (
    <>
      <div className="page-head">
        <div><h1>광고물 관리</h1><div className="sub">게시중 {active.length} · 만료임박 {expiringSoon} · 만료 {expired}</div></div>
        <div className="spacer" />
        <button className="btn" onClick={exportCSV} disabled={list.length === 0}>CSV</button>
        <button className="btn primary" onClick={() => setEdit({ ...empty })}><Plus size={15} />광고물 등록</button>
      </div>

      <div className="grid cols-3">
        <div className="card stat"><div className="k">게시중</div><div className="v">{active.length}</div></div>
        <div className="card stat"><div className="k">만료 임박(30일)</div><div className="v" style={{ color: "var(--warn)" }}>{expiringSoon}</div></div>
        <div className="card stat"><div className="k">만료 경과</div><div className="v" style={{ color: "var(--danger)" }}>{expired}</div></div>
      </div>

      {quotes.length > 0 && (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span className="card-sub" style={{ margin: 0 }}>수주 견적에서 등록</span>
            <div className="spacer" />
            <select defaultValue="" onChange={(e) => { fromQuote(e.target.value); e.currentTarget.value = ""; }} style={{ maxWidth: 320 }}>
              <option value="">수주 견적 선택…</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quote_no} · {q.customer} · {won(q.grand)}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="card">
        {sorted.length === 0 ? (
          <div className="empty"><div className="big"><SignpostBig size={40} strokeWidth={1.5} /></div><div className="ttl">등록된 광고물이 없습니다</div><div className="dim" style={{ marginTop: 6 }}>설치한 간판·현수막을 등록하면 표시기간·허가 만료를 추적합니다</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>광고물</th><th>고객</th><th>위치</th><th>종류</th><th>설치일</th><th>만료일</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.quote_id ? <Link className="link" to={`/quotes/${s.quote_id}`}>{s.name}</Link> : s.name}</td>
                    <td>{s.customer || "-"}</td>
                    <td className="dim"><MapPin size={13} style={{ verticalAlign: -2 }} /> {s.address || "-"}</td>
                    <td><span className="chip">{s.type}</span></td>
                    <td className="dim">{fmtDate(s.installDate) || "-"}</td>
                    <td className="dim">{fmtDate(s.permitExpiry) || "-"}</td>
                    <td>{expiryBadge(s)}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn sm" onClick={() => setEdit(s)}>편집</button>
                        <button className="btn sm danger" onClick={() => del(s)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <Modal
          title={edit.id ? "광고물 편집" : "광고물 등록"}
          onClose={() => setEdit(null)}
          footer={<><button className="btn primary" onClick={save}>저장</button><button className="btn" onClick={() => setEdit(null)}>취소</button></>}
        >
          <div className="grid cols-2">
            <label className="field"><span>광고물명</span><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="예: ○○약국 전면간판" /></label>
            <label className="field"><span>고객/거래처</span><input value={edit.customer} onChange={(e) => setEdit({ ...edit, customer: e.target.value })} /></label>
            <label className="field"><span>종류</span>
              <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="field"><span>상태</span>
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as SignageT["status"] })}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>설치일</span><input type="date" value={edit.installDate} onChange={(e) => setEdit({ ...edit, installDate: e.target.value })} /></label>
            <label className="field"><span>표시기간/허가 만료일</span><input type="date" value={edit.permitExpiry} onChange={(e) => setEdit({ ...edit, permitExpiry: e.target.value })} /></label>
          </div>
          <label className="field"><span>설치 위치</span><input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="주소·건물·층" /></label>
          <label className="field"><span>메모</span><textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} placeholder="허가번호, 갱신 이력 등" /></label>
        </Modal>
      )}
    </>
  );
}
