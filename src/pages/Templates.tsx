import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { fmtDate, won } from "@/lib/quote";
import { calcTotals } from "@/lib/quote";
import type { Template } from "@/types";
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

  return (
    <>
      <div className="page-head">
        <div><h1>견적 템플릿</h1><div className="sub">자주 쓰는 품목·시공 세트를 1클릭 적용 · {list.length}개</div></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => navigate("/editor")}><Plus size={15} />새 견적에서 저장</button>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty">
            <div className="big"><LayoutTemplate size={40} strokeWidth={1.5} /></div>
            <div className="ttl">저장된 템플릿이 없습니다</div>
            <div>견적 작성 화면 하단의 “템플릿으로 저장”으로 만들 수 있습니다.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>이름</th><th>품목수</th><th className="amt">예상 합계</th><th>메모</th><th>생성일</th><th></th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.payload.items.length}개</td>
                    <td className="amt">{won(sum(t))}</td>
                    <td className="dim">{t.memo || "-"}</td>
                    <td className="dim">{fmtDate(t.created_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn sm soft" onClick={() => apply(t)}>적용</button>
                        <button className="btn sm danger" onClick={() => del(t)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
