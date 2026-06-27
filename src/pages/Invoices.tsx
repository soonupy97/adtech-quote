import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, fmtDate, won } from "@/lib/quote";
import type { Invoice, Quote, QuoteSummary } from "@/types";
import { Button, Chip, EmptyState, Field, Modal, PageTitle, Select, Table, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Plus, Receipt, Trash2, Send } from "lucide-react";
import RowMenu from "@/components/RowMenu";

const PROVIDER_LABEL: Record<Invoice["provider"], string> = { popbill: "팝빌", barobill: "바로빌", manual: "수기" };

// 부록 A24 세금계산서 발행 (팝빌/바로빌 연동 자리 — 프로토타입은 상태 관리)
export default function Invoices() {
  const toast = useToast();
  const [list, setList] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [provider, setProvider] = useState<Invoice["provider"]>("popbill");
  const [busy, setBusy] = useState(false);

  const load = () => store.invoices.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.", "warning");
    setBusy(true);
    try {
      const q = (await store.getQuote(pick)) as Quote;
      const t = calcTotals(q);
      await store.invoices.save({
        id: "", quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "",
        supplyAmount: t.supply, vat: t.vat, total: t.grand, status: "draft", provider, created_at: "",
      });
      setCreating(false); setPick("");
      await load();
      toast("세금계산서 초안을 생성했습니다.", "success");
    } finally { setBusy(false); }
  };

  const issue = async (inv: Invoice) => {
    await store.invoices.save({ ...inv, status: "issued", issued_at: new Date().toISOString() });
    await load();
    toast(`${PROVIDER_LABEL[inv.provider]}(으)로 발행 처리되었습니다.`, "success");
  };
  const del = async (inv: Invoice) => { await store.invoices.remove(inv.id); await load(); };

  const columns: Column<Invoice>[] = [
    { key: "quote_no", header: "견적", render: (inv) => <Link className="link" to={`/quotes/${inv.quote_id}`}>{inv.quote_no}</Link> },
    { key: "customer", header: "고객" },
    { key: "supplyAmount", header: "공급가", align: "right", render: (inv) => won(inv.supplyAmount) },
    { key: "vat", header: "부가세", align: "right", render: (inv) => won(inv.vat) },
    { key: "total", header: "합계", align: "right", render: (inv) => won(inv.total) },
    { key: "provider", header: "발행처", render: (inv) => <Chip>{PROVIDER_LABEL[inv.provider]}</Chip> },
    { key: "status", header: "상태", render: (inv) => (inv.status === "issued" ? <span className="badge accepted"><span className="dot" />발행 {fmtDate(inv.issued_at)}</span> : <span className="badge draft"><span className="dot" />초안</span>) },
    {
      key: "act",
      header: "관리",
      render: (inv) => (
        <RowMenu actions={[
          { label: "발행", icon: <Send size={15} />, hidden: inv.status !== "draft", onClick: () => issue(inv) },
          { label: "삭제", icon: <Trash2 size={15} />, danger: true, onClick: () => del(inv) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <PageTitle title="세금계산서" sub={`수주 건의 전자세금계산서 발행 · ${list.length}건`} />
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>계산서 생성</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          rows={list}
          rowKey={(inv) => inv.id}
          empty={<EmptyState icon={<Receipt size={40} strokeWidth={1.5} />} title="발행 내역이 없습니다" />}
        />
      </div>

      {creating && (
        <Modal title="세금계산서 생성" onClose={() => setCreating(false)}
          footer={<><Button variant="primary" loading={busy} onClick={create}>생성</Button><Button disabled={busy} onClick={() => setCreating(false)}>취소</Button></>}>
          <Field label="수주(수락) 견적">
            <Select value={pick} onChange={setPick} placeholder="선택…"
              options={quotes.map((q) => ({ value: q.id, label: `${q.quote_no} · ${q.customer} · ${won(q.grand)}` }))} />
          </Field>
          <Field label="발행처">
            <Select value={provider} onChange={(v) => setProvider(v as Invoice["provider"])}
              options={Object.entries(PROVIDER_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Field>
          <div className="dim">실제 발행은 팝빌/바로빌 API 연동이 필요합니다(운영). 프로토타입은 상태만 기록합니다.</div>
        </Modal>
      )}
    </>
  );
}
