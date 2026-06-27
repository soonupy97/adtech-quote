import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { fmtDateTime } from "@/lib/quote";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { Activity } from "@/types";
import { Button, EmptyState, PageTitle } from "@/components/ui";
import { ScrollText } from "lucide-react";

// 부록 A26 활동 로그(감사)
export default function Activities({ embedded = false }: { embedded?: boolean }) {
  const [list, setList] = useState<Activity[]>([]);
  useEffect(() => { store.activities.list().then(setList); }, []);

  const exportCSV = () => {
    downloadCSV("활동로그.csv", toCSV(list.map((a) => ({
      시각: a.created_at, 담당: a.actor, 동작: a.action, 대상: a.target_type, 대상ID: a.target_id,
    }))));
  };

  return (
    <>
      {!embedded ? (
        <div className="page-head">
          <PageTitle title="활동 로그" sub={`작성·발송·수정·삭제 감사 기록 · ${list.length}건`} />
          <Button size="sm" onClick={exportCSV} disabled={list.length === 0}>CSV 내보내기</Button>
        </div>
      ) : (
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-sub" style={{ margin: 0 }}>작성·발송·수정·삭제 감사 기록 · {list.length}건</div>
          <div className="spacer" />
          <Button size="sm" onClick={exportCSV} disabled={list.length === 0}>CSV 내보내기</Button>
        </div>
      )}
      <div className="card">
        {list.length === 0 ? (
          <EmptyState icon={<ScrollText size={40} strokeWidth={1.5} />} title="기록이 없습니다" />
        ) : (
          <div className="timeline">
            {list.map((a) => (
              <div className="ev" key={a.id}>
                <span className="pin" />
                <div className="body">
                  <div className="t">{a.action} <span className="dim" style={{ fontWeight: 400 }}>· {a.target_type}</span></div>
                  <div className="d">{a.actor} · {fmtDateTime(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
