import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, won } from "@/lib/quote";
import { calcTotals } from "@/lib/quote";
import type { Template } from "@/types";
import { Button, EmptyState, Table, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Plus, LayoutTemplate } from "lucide-react";

// 부록 A20 견적 템플릿 저장/불러오기
export default function Templates() {
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<Template[]>([]);

  const load = () => store.templates.list().then(setList);
  useEffect(() => { load(); }, []);

  const apply = (t: Template) => navigate(`/editor?tpl=${t.id}`);
  const del = async (t: Template) => {
    if (!confirm(`템플릿 '${t.name}' 을 삭제할까요?`)) return;
    await store.templates.remove(t.id);
    await load();
    toast("삭제되었습니다.");
  };

  const sum = (t: Template) =>
    calcTotals({
      items: t.payload.items,
      constructions: t.payload.constructions,
      permits: t.payload.permits,
      etcCosts: t.payload.etcCosts,
      adjustments: t.payload.adjustments,
    } as never).grand;

  const columns: Column<Template>[] = [
    { key: "name", header: "이름", render: (t) => <span style={{ fontWeight: 700 }}>{t.name}</span> },
    { key: "items", header: "품목수", render: (t) => `${t.payload.items.length}개` },
    { key: "sum", header: "예상 합계", align: "right", render: (t) => won(sum(t)) },
    { key: "memo", header: "메모", className: "dim", render: (t) => t.memo || "-" },
    { key: "created_at", header: "생성일", className: "dim", render: (t) => fmtDate(t.created_at) },
    {
      key: "act",
      render: (t) => (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" variant="secondary" onClick={() => apply(t)}>적용</Button>
          <Button size="sm" variant="danger" onClick={() => del(t)}>삭제</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>견적 템플릿</h1><div className="sub">자주 쓰는 품목·시공 세트를 1클릭 적용 · {list.length}개</div></div>
        <div className="spacer" />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate("/editor")}>새 견적에서 저장</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          rows={list}
          rowKey={(t) => t.id}
          empty={<EmptyState icon={<LayoutTemplate size={40} strokeWidth={1.5} />} title="저장된 템플릿이 없습니다" desc="견적 작성 화면 하단의 “템플릿으로 저장”으로 만들 수 있습니다." />}
        />
      </div>
    </>
  );
}
