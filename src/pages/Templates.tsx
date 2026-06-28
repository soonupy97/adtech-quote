import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, won, sampleTemplate } from "@/lib/quote";
import { calcTotals } from "@/lib/quote";
import type { Template } from "@/types";
import { Button, EmptyState, PageTitle, Table, type Column } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Plus, LayoutTemplate, Trash2, Check } from "lucide-react";
import RowMenu from "@/components/RowMenu";

// 부록 A20 견적 템플릿 저장/불러오기
export default function Templates() {
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<Template[]>([]);
  const [seeding, setSeeding] = useState(false);

  const load = () => store.templates.list().then(setList);
  useEffect(() => { load(); }, []);

  // 빈 상태 온보딩: 현실적인 샘플 템플릿 1건 추가
  const addSample = async () => {
    setSeeding(true);
    try {
      await store.templates.save(sampleTemplate());
      await load();
      toast("샘플 템플릿을 추가했습니다.", "success");
    } finally {
      setSeeding(false);
    }
  };

  const apply = (t: Template) => navigate(`/editor?tpl=${t.id}`);
  const del = async (t: Template) => {
    if (!confirm(`템플릿 '${t.name}' 을 삭제할까요?`)) return;
    await store.templates.remove(t.id);
    await load();
    toast("삭제되었습니다.", "success");
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
      header: "관리",
      render: (t) => (
        <RowMenu actions={[
          { label: "적용", icon: <Check size={16} />, onClick: () => apply(t) },
          { label: "삭제", icon: <Trash2 size={16} />, danger: true, onClick: () => del(t) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <PageTitle title="견적 템플릿" sub={`자주 쓰는 품목·시공 세트를 1클릭 적용 · ${list.length}개`} />
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => navigate("/editor")}>새 견적에서 저장</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          rows={list}
          rowKey={(t) => t.id}
          empty={
            <EmptyState
              icon={<LayoutTemplate size={40} strokeWidth={1.5} />}
              title="저장된 템플릿이 없습니다"
              desc={<span style={{ display: "block", marginBottom: 16 }}>견적 작성 화면 하단의 “템플릿으로 저장”으로 만들거나, 샘플로 먼저 둘러보세요.</span>}
              action={<Button variant="secondary" loading={seeding} onClick={addSample}>샘플 템플릿 추가</Button>}
            />
          }
        />
      </div>
    </>
  );
}
