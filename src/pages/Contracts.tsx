import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { store } from "@/lib/store";
import { calcTotals, fmtDate, won } from "@/lib/quote";
import type { Contract, ContractParty, Quote, QuoteSummary } from "@/types";
import { Button, Chip, EmptyState, Field, Modal, Select, Table, type Column } from "@/components/ui";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { useToast } from "@/components/Toast";
import { Plus, FileSignature, Check, Trash2 } from "lucide-react";

// 부록 A23 전자계약 전환 + 다중 서명자
export default function Contracts() {
  const toast = useToast();
  const [list, setList] = useState<Contract[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [signing, setSigning] = useState<{ c: Contract; idx: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const load = () => store.contracts.list().then(setList);
  useEffect(() => {
    load();
    store.listQuotes().then((qs) => setQuotes(qs.filter((q) => q.status === "accepted")));
  }, []);

  const create = async () => {
    if (!pick) return toast("견적을 선택하세요.");
    setBusy(true);
    try {
      const q = (await store.getQuote(pick)) as Quote;
      const settings = await store.getSettings();
      const parties: ContractParty[] = [
        { role: "갑", name: q.supplier?.name || settings.supplier.name || "공급자" },
        { role: "을", name: q.customer?.name || "고객" },
      ];
      await store.contracts.save({
        id: "", quote_id: q.id, quote_no: q.quote_no, customer: q.customer?.name || "",
        amount: calcTotals(q).grand,
        terms: settings.terms?.standard || "표준 계약 조건에 따른다.",
        parties, status: "draft", created_at: "",
      });
      await store.activities.save({ id: "", actor: "직원", action: "전자계약 생성", target_type: "contract", target_id: q.id, created_at: "" } as never);
      setCreating(false); setPick("");
      await load();
      toast("계약서를 생성했습니다.");
    } finally { setBusy(false); }
  };

  const doSign = async () => {
    if (!signing) return;
    if (sigRef.current?.isEmpty()) return toast("서명을 해주세요.");
    setBusy(true);
    try {
      const c = { ...signing.c, parties: signing.c.parties.map((p) => ({ ...p })) };
      c.parties[signing.idx] = {
        ...c.parties[signing.idx],
        signature: sigRef.current!.toDataURL(),
        signed_at: new Date().toISOString(),
      };
      if (c.parties.every((p) => p.signature)) c.status = "signed";
      await store.contracts.save(c);
      setSigning(null);
      await load();
      toast("서명이 완료되었습니다.");
    } finally { setBusy(false); }
  };

  const del = async (c: Contract) => {
    if (!confirm(`${c.quote_no} 계약을 삭제할까요?`)) return;
    await store.contracts.remove(c.id);
    await load();
  };

  const columns: Column<Contract>[] = [
    { key: "quote_no", header: "견적번호", render: (c) => <Link className="link" to={`/quotes/${c.quote_id}`}>{c.quote_no}</Link> },
    { key: "customer", header: "고객", render: (c) => c.customer },
    { key: "amount", header: "계약금액", align: "right", render: (c) => won(c.amount) },
    {
      key: "sign",
      header: "서명",
      render: (c) => c.parties.map((p) => (
        <Chip key={p.role} variant={p.signature ? "blue" : "default"} style={{ marginRight: 4 }}>
          {p.role} {p.signature ? <Check size={14} /> : "…"}
        </Chip>
      )),
    },
    { key: "status", header: "상태", render: (c) => (c.status === "signed" ? <span className="badge accepted"><span className="dot" />체결</span> : <span className="badge draft"><span className="dot" />작성중</span>) },
    { key: "created_at", header: "생성일", className: "dim", render: (c) => fmtDate(c.created_at) },
    {
      key: "act",
      header: "관리",
      render: (c) => (
        <div className="row" style={{ gap: 4 }}>
          {c.parties.map((p, i) => !p.signature && (
            <Button key={i} size="sm" variant="secondary" onClick={() => setSigning({ c, idx: i })}>{p.role} 서명</Button>
          ))}
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} title="삭제" aria-label="삭제" onClick={() => del(c)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>전자계약</h1><div className="sub">수락된 견적을 계약서로 전환 · {list.length}건</div></div>
        <div className="spacer" />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>계약 생성</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          rows={list}
          rowKey={(c) => c.id}
          empty={<EmptyState icon={<FileSignature size={40} strokeWidth={1.5} />} title="계약이 없습니다" desc="수락된 견적에서 계약서를 만들 수 있습니다." />}
        />
      </div>

      {creating && (
        <Modal title="계약 생성" onClose={() => setCreating(false)}
          footer={<><Button variant="primary" loading={busy} onClick={create}>생성</Button><Button disabled={busy} onClick={() => setCreating(false)}>취소</Button></>}>
          <Field label="수락된 견적 선택">
            <Select value={pick} onChange={setPick} placeholder="선택…"
              options={quotes.map((q) => ({ value: q.id, label: `${q.quote_no} · ${q.customer} · ${won(q.grand)}` }))} />
          </Field>
          {quotes.length === 0 && <div className="dim">수락된 견적이 없습니다. 고객 수락 후 계약을 생성하세요.</div>}
        </Modal>
      )}

      {signing && (
        <Modal title={`${signing.c.parties[signing.idx].role} (${signing.c.parties[signing.idx].name}) 서명`} onClose={() => setSigning(null)}
          footer={<><Button variant="primary" loading={busy} onClick={doSign}>서명 완료</Button><Button disabled={busy} onClick={() => sigRef.current?.clear()}>지우기</Button><Button disabled={busy} onClick={() => setSigning(null)}>취소</Button></>}>
          <SignaturePad ref={sigRef} />
        </Modal>
      )}
    </>
  );
}
