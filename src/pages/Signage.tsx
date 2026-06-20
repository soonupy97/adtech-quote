import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { ITEM_TYPES, fmtDate, won } from "@/lib/quote";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { QuoteSummary, Signage as SignageT } from "@/types";
import { Button, Chip, EmptyState, Field, Input, Modal, Select, Table, Textarea, type Column } from "@/components/ui";
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
  const [saving, setSaving] = useState(false);

  const load = () => store.signage.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("광고물명을 입력하세요.");
    setSaving(true);
    try {
      await store.signage.save(edit);
      setEdit(null);
      await load();
      toast("저장되었습니다.");
    } finally { setSaving(false); }
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

  const columns: Column<SignageT>[] = [
    { key: "name", header: "광고물", render: (s) => <span style={{ fontWeight: 700 }}>{s.quote_id ? <Link className="link" to={`/quotes/${s.quote_id}`}>{s.name}</Link> : s.name}</span> },
    { key: "customer", header: "고객", render: (s) => s.customer || "-" },
    { key: "address", header: "위치", className: "dim", render: (s) => <><MapPin size={13} style={{ verticalAlign: -2 }} /> {s.address || "-"}</> },
    { key: "type", header: "종류", render: (s) => <Chip>{s.type}</Chip> },
    { key: "installDate", header: "설치일", className: "dim", render: (s) => fmtDate(s.installDate) || "-" },
    { key: "permitExpiry", header: "만료일", className: "dim", render: (s) => fmtDate(s.permitExpiry) || "-" },
    { key: "status", header: "상태", render: (s) => expiryBadge(s) },
    {
      key: "act",
      render: (s) => (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" onClick={() => setEdit(s)}>편집</Button>
          <Button size="sm" variant="danger" onClick={() => del(s)}>삭제</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>광고물 관리</h1><div className="sub">게시중 {active.length} · 만료임박 {expiringSoon} · 만료 {expired}</div></div>
        <div className="spacer" />
        <Button onClick={exportCSV} disabled={list.length === 0}>CSV</Button>
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEdit({ ...empty })}>광고물 등록</Button>
      </div>

      <div className="bento">
        <div className="tile feature col-2 row-2">
          <div className="k">게시중</div>
          <div className="push-bottom">
            <div className="v-lg">{active.length}</div>
            <div className="bento-foot">전체 광고물 {list.length}개</div>
          </div>
        </div>
        <div className="tile">
          <div className="k">만료 임박(30일)</div>
          <div className="v push-bottom">{expiringSoon}</div>
        </div>
        <div className="tile">
          <div className="k">만료 경과</div>
          <div className="v push-bottom">{expired}</div>
        </div>
      </div>

      {quotes.length > 0 && (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span className="card-sub" style={{ margin: 0 }}>수주 견적에서 등록</span>
            <div className="spacer" />
            <Select value="" placeholder="수주 견적 선택…" style={{ maxWidth: 320 }}
              onChange={(v) => v && fromQuote(v)}
              options={quotes.map((q) => ({ value: q.id, label: `${q.quote_no} · ${q.customer} · ${won(q.grand)}` }))} />
          </div>
        </div>
      )}

      <div className="card">
        <Table
          columns={columns}
          rows={sorted}
          rowKey={(s) => s.id}
          empty={<EmptyState icon={<SignpostBig size={40} strokeWidth={1.5} />} title="등록된 광고물이 없습니다" desc={<span className="dim" style={{ marginTop: 8 }}>설치한 간판·현수막을 등록하면 표시기간·허가 만료를 추적합니다</span>} />}
        />
      </div>

      {edit && (
        <Modal
          title={edit.id ? "광고물 편집" : "광고물 등록"}
          onClose={() => setEdit(null)}
          footer={<><Button variant="primary" loading={saving} onClick={save}>저장</Button><Button disabled={saving} onClick={() => setEdit(null)}>취소</Button></>}
        >
          <div className="grid cols-2">
            <Field label="광고물명"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="예: ○○약국 전면간판" /></Field>
            <Field label="고객/거래처"><Input value={edit.customer} onChange={(e) => setEdit({ ...edit, customer: e.target.value })} /></Field>
            <Field label="종류">
              <Select value={edit.type} onChange={(v) => setEdit({ ...edit, type: v })}
                options={ITEM_TYPES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="상태">
              <Select value={edit.status} onChange={(val) => setEdit({ ...edit, status: val as SignageT["status"] })}
                options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
            </Field>
            <Field label="설치일"><Input type="date" value={edit.installDate} onChange={(e) => setEdit({ ...edit, installDate: e.target.value })} /></Field>
            <Field label="표시기간/허가 만료일"><Input type="date" value={edit.permitExpiry} onChange={(e) => setEdit({ ...edit, permitExpiry: e.target.value })} /></Field>
          </div>
          <Field label="설치 위치"><Input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="주소·건물·층" /></Field>
          <Field label="메모"><Textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} placeholder="허가번호, 갱신 이력 등" /></Field>
        </Modal>
      )}
    </>
  );
}
