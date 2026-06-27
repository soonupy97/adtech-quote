import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  Inbox,
  Search,
  SignpostBig,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import { store } from "@/lib/store";
import type { CatalogItem, Client, Lead, QuoteSummary, Signage } from "@/types";

// 헤더 전역 검색 — 견적·거래처·리드·품목·광고물을 한 번에 찾아 이동.
// 첫 포커스 때 데이터셋을 한 번 로드해 캐시하고, 입력은 클라이언트에서 필터한다.

type HitType = "quote" | "client" | "lead" | "catalog" | "signage";
interface Hit {
  type: HitType;
  label: string;
  sub: string;
  to: string;
}

interface Data {
  quotes: QuoteSummary[];
  clients: Client[];
  leads: Lead[];
  catalog: CatalogItem[];
  signage: Signage[];
}

const GROUP: Record<HitType, { label: string; icon: LucideIcon }> = {
  quote: { label: "견적", icon: FileText },
  client: { label: "거래처", icon: Building2 },
  lead: { label: "리드", icon: Inbox },
  catalog: { label: "품목", icon: Tags },
  signage: { label: "광고물", icon: SignpostBig },
};
const GROUP_ORDER: HitType[] = ["quote", "client", "lead", "catalog", "signage"];
const PER_GROUP = 5;

// 공백 정규화 후 부분일치(대소문자 무시)
const norm = (s: unknown) => String(s ?? "").toLowerCase();

export default function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    Promise.all([
      store.listQuotes(),
      store.listClients(),
      store.leads.list(),
      store.listCatalog(),
      store.signage.list(),
    ]).then(([quotes, clients, leads, catalog, signage]) =>
      setData({ quotes, clients, leads, catalog, signage }),
    );
  }, []);

  // 검색어→그룹별 히트(각 그룹 상한). 빈 입력이면 결과 없음.
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !data) return [] as { type: HitType; hits: Hit[] }[];
    const has = (hay: string) => hay.includes(term);

    const quote: Hit[] = data.quotes
      .filter((x) => has(norm([x.quote_no, x.customer, x.customer_tel, x.title].join(" "))))
      .slice(0, PER_GROUP)
      .map((x) => ({
        type: "quote",
        label: `${x.quote_no} · ${x.customer || "고객 미정"}`,
        sub: x.title || "",
        to: `/quotes/${x.id}`,
      }));
    const client: Hit[] = data.clients
      .filter((x) => has(norm([x.name, x.tel, x.manager, x.bizno, x.memo].join(" "))))
      .slice(0, PER_GROUP)
      .map((x) => ({ type: "client", label: x.name, sub: [x.manager, x.tel].filter(Boolean).join(" · "), to: "/clients" }));
    const lead: Hit[] = data.leads
      .filter((x) => has(norm([x.customerName, x.tel, x.memo].join(" "))))
      .slice(0, PER_GROUP)
      .map((x) => ({ type: "lead", label: x.customerName, sub: [x.stage, x.tel].filter(Boolean).join(" · "), to: "/leads" }));
    const catalog: Hit[] = data.catalog
      .filter((x) => has(norm([x.type, x.grade, x.unit, x.memo].join(" "))))
      .slice(0, PER_GROUP)
      .map((x) => ({ type: "catalog", label: x.type, sub: [x.grade, x.unit].filter(Boolean).join(" · "), to: "/catalog" }));
    const signage: Hit[] = data.signage
      .filter((x) => has(norm([x.name, x.customer, x.address, x.type].join(" "))))
      .slice(0, PER_GROUP)
      .map((x) => ({ type: "signage", label: x.name, sub: [x.customer, x.address].filter(Boolean).join(" · "), to: "/signage" }));

    const byType: Record<HitType, Hit[]> = { quote, client, lead, catalog, signage };
    return GROUP_ORDER.map((type) => ({ type, hits: byType[type] })).filter((g) => g.hits.length > 0);
  }, [q, data]);

  // 키보드 내비게이션용 평면 리스트
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  // 입력 변경 시 활성 인덱스 리셋
  useEffect(() => setActive(0), [q]);

  // 외부 클릭 → 패널 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (hit: Hit) => {
    navigate(hit.to);
    setOpen(false);
    setQ("");
  };

  const onFocus = () => {
    setOpen(true);
    if (!data) load();
  };

  const openMobile = () => {
    setOpen(true);
    if (!data) load();
    // 모바일: 토글로 펼친 뒤 입력에 포커스
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active] || flat[0]);
    }
  };

  const showPanel = open && q.trim().length > 0;

  return (
    <div className={`appbar-search${open ? " open" : ""}`} ref={wrapRef}>
      {/* 모바일 전용 토글(아이콘) */}
      <button type="button" className="btn icon-only ghost search-toggle" aria-label="검색" onClick={openMobile}>
        <Search size={18} />
      </button>

      <div className="search-field">
        <Search size={16} className="search-lead" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          placeholder="견적·거래처·리드·품목 검색"
          aria-label="전역 검색"
          onChange={(e) => setQ(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
        {q && (
          <button type="button" className="search-clear" aria-label="지우기" onClick={() => { setQ(""); inputRef.current?.focus(); }}>
            <X size={15} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="search-panel">
          {flat.length === 0 ? (
            <div className="search-empty">{data ? "검색 결과가 없습니다" : "불러오는 중…"}</div>
          ) : (
            groups.map((g) => {
              const Meta = GROUP[g.type];
              return (
                <div className="search-group" key={g.type}>
                  <div className="search-group-label">{Meta.label}</div>
                  {g.hits.map((hit) => {
                    const idx = flat.indexOf(hit);
                    const Ic = GROUP[hit.type].icon;
                    return (
                      <button
                        type="button"
                        key={`${hit.type}-${hit.to}-${hit.label}`}
                        className={`search-hit${idx === active ? " active" : ""}`}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(hit)}
                      >
                        <span className="hit-ic"><Ic size={15} /></span>
                        <span className="hit-main">
                          <span className="hit-label">{hit.label}</span>
                          {hit.sub && <span className="hit-sub">{hit.sub}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
