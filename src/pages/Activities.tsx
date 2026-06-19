import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { fmtDateTime } from "@/lib/quote";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { Activity } from "@/types";
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
          <div><h1>활동 로그</h1><div className="sub">작성·발송·수정·삭제 감사 기록 · {list.length}건</div></div>
          <div className="spacer" />
          <button className="btn" onClick={exportCSV} disabled={list.length === 0}>CSV 내보내기</button>
        </div>
      ) : (
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="card-sub" style={{ margin: 0 }}>작성·발송·수정·삭제 감사 기록 · {list.length}건</div>
          <div className="spacer" />
          <button className="btn sm" onClick={exportCSV} disabled={list.length === 0}>CSV 내보내기</button>
        </div>
      )}
      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><div className="big"><ScrollText size={40} strokeWidth={1.5} /></div><div className="ttl">기록이 없습니다</div></div>
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
