import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  FileSignature,
  FileText,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Moon,
  Receipt,
  Settings,
  SignpostBig,
  Sun,
  Tags,
  TrendingUp,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Auth } from "@/lib/auth";
import { isSupabaseEnabled, store } from "@/lib/store";
import type { AppNotification, Session } from "@/types";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "견적",
    items: [
      { to: "/", icon: LayoutDashboard, label: "대시보드", end: true },
      { to: "/quotes", icon: FileText, label: "견적" },
      { to: "/templates", icon: LayoutTemplate, label: "템플릿" },
    ],
  },
  {
    section: "영업·고객",
    items: [
      { to: "/leads", icon: Inbox, label: "리드·영업" },
      { to: "/clients", icon: Building2, label: "거래처" },
    ],
  },
  {
    section: "계약·시공",
    items: [
      { to: "/contracts", icon: FileSignature, label: "전자계약" },
      { to: "/workorders", icon: Wrench, label: "작업지시서" },
      { to: "/signage", icon: SignpostBig, label: "광고물 관리" },
    ],
  },
  {
    section: "일정·정산",
    items: [
      { to: "/calendar", icon: CalendarDays, label: "일정" },
      { to: "/payments", icon: Wallet, label: "정산/입금" },
      { to: "/invoices", icon: Receipt, label: "세금계산서" },
    ],
  },
  {
    section: "분석·운영",
    items: [
      { to: "/reports", icon: TrendingUp, label: "매출 리포트" },
      { to: "/catalog", icon: Tags, label: "품목·단가" },
      { to: "/settings", icon: Settings, label: "설정" },
    ],
  },
];

// 항상 표시(숨길 수 없는) 핵심 메뉴
export const CORE_PATHS = new Set(["/", "/quotes", "/settings"]);
// 설정에서 표시/숨김을 토글할 수 있는 메뉴 목록
export const MENU_TOGGLES = NAV.flatMap((g) =>
  g.items.filter((n) => !CORE_PATHS.has(n.to)).map((n) => ({ to: n.to, label: n.label, section: g.section })),
);
// 메뉴 표시 설정 변경 시 사이드바 갱신용 이벤트
export const MENU_EVENT = "oad-menus-changed";

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("oad_theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("oad_theme", theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [notis, setNotis] = useState<AppNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);

  const loadNotis = useCallback(() => {
    store.notifications.list().then((l) => setNotis(l.slice(0, 30)));
  }, []);

  const loadMenus = useCallback(() => {
    store.getSettings().then((s) => setHidden(s.menuHidden || []));
  }, []);

  // 메뉴 표시 설정 로드 + 설정 저장 시 갱신
  useEffect(() => {
    loadMenus();
    window.addEventListener(MENU_EVENT, loadMenus);
    return () => window.removeEventListener(MENU_EVENT, loadMenus);
  }, [loadMenus]);

  useEffect(() => {
    let alive = true;
    Auth.current().then((s) => {
      if (!alive) return;
      if (!s) {
        navigate("/login", { replace: true });
        return;
      }
      setSession(s);
      setChecked(true);
      loadNotis();
    });
    return () => { alive = false; };
  }, [navigate, loadNotis]);

  // 라우트 이동 시 알림 갱신
  useEffect(() => { if (checked) loadNotis(); }, [location.pathname, checked, loadNotis]);

  if (!checked) return <div className="empty" style={{ paddingTop: 120 }}>불러오는 중…</div>;

  const unread = notis.filter((n) => !n.read).length;

  // 숨김 설정 반영 (핵심 메뉴는 항상 표시), 빈 섹션 제거
  const visibleNav = NAV.map((grp) => ({
    ...grp,
    items: grp.items.filter((n) => CORE_PATHS.has(n.to) || !hidden.includes(n.to)),
  })).filter((grp) => grp.items.length > 0);

  const onLogout = async () => {
    await Auth.logout();
    navigate("/login", { replace: true });
  };

  const markAllRead = async () => {
    for (const n of notis.filter((x) => !x.read)) {
      await store.notifications.save({ ...n, read: true });
    }
    loadNotis();
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">간</span>
          <span>옥외광고 견적</span>
        </div>
        <nav>
          {visibleNav.map((grp) => (
            <div key={grp.section} className="nav-group">
              <div className="nav-section">{grp.section}</div>
              {grp.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
                  <span className="ic"><n.icon size={18} /></span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="foot">
          <div className="u">
            {session?.name || session?.email}
            {session?.provider === "kakao" ? " · 카카오" : ""}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={toggleTheme}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>
            <button className="btn sm" onClick={onLogout}>로그아웃</button>
          </div>
          {!isSupabaseEnabled && <div className="dim" style={{ marginTop: 10, fontSize: 11.5 }}>로컬 목업 모드</div>}
        </div>
      </aside>

      <main className="main">
        <div className="topbar no-print">
          <div className="spacer" />
          <button className="btn sm topbar-only" onClick={toggleTheme} title="테마">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>
          <button className="btn sm topbar-only" onClick={onLogout}>로그아웃</button>
          <div className="bell-wrap">
            <button className="btn sm" onClick={() => setBellOpen((v) => !v)}>
              <Bell size={15} />{unread > 0 && <span className="bell-badge">{unread}</span>}
            </button>
            {bellOpen && (
              <div className="bell-panel" onMouseLeave={() => setBellOpen(false)}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <strong>알림센터</strong>
                  <div className="spacer" />
                  <button className="chip" onClick={markAllRead}>모두 읽음</button>
                  <Link className="chip blue" to="/notifications" onClick={() => setBellOpen(false)}>전체</Link>
                </div>
                {notis.length === 0 ? (
                  <div className="dim" style={{ padding: "12px 0" }}>알림이 없습니다</div>
                ) : (
                  notis.slice(0, 8).map((n) => (
                    <Link
                      key={n.id}
                      to={n.quote_id ? `/quotes/${n.quote_id}` : "/notifications"}
                      className={`noti ${n.read ? "" : "unread"}`}
                      onClick={() => setBellOpen(false)}
                    >
                      <div className="t">{n.title}</div>
                      <div className="b">{n.body}</div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
