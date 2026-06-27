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
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  SignpostBig,
  Sun,
  Tags,
  TrendingUp,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Auth } from "@/lib/auth";
import { store } from "@/lib/store";
import HeaderSearch from "@/components/HeaderSearch";
import OnboardingCompany, { ONBOARD_SKIP_KEY } from "@/components/OnboardingCompany";
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
  const [profileOpen, setProfileOpen] = useState(false); // 헤더 프로필 popover
  const [navOpen, setNavOpen] = useState(false); // 모바일 햄버거 드로어
  const [hidden, setHidden] = useState<string[]>([]);
  const [needCompany, setNeedCompany] = useState(false); // 가입 후 회사 정보 온보딩

  const loadNotis = useCallback(() => {
    store.notifications.list().then((l) => setNotis(l.slice(0, 30)));
  }, []);

  const loadMenus = useCallback(() => {
    store.getSettings().then((s) => {
      setHidden(s.menuHidden || []);
      // 공급자(회사) 정보가 비어 있고, '나중에 하기'로 미룬 적 없으면 온보딩 노출
      const empty = !(s.supplier?.name || "").trim();
      setNeedCompany(empty && !localStorage.getItem(ONBOARD_SKIP_KEY));
    });
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

  // 라우트 이동 시 알림 갱신 + 모바일 드로어·프로필 popover 닫기
  useEffect(() => { if (checked) loadNotis(); setNavOpen(false); setProfileOpen(false); }, [location.pathname, checked, loadNotis]);

  if (!checked) return <div className="empty" style={{ paddingTop: 64 }}>불러오는 중…</div>;

  const unread = notis.filter((n) => !n.read).length;
  // 아바타 이니셜(이름 우선, 없으면 이메일 첫 글자)
  const avatarInitial = (session?.name || session?.email || "?").trim().charAt(0).toUpperCase();

  // 숨김 설정 반영 (핵심 메뉴는 항상 표시), 빈 섹션 제거
  const visibleNav = NAV.map((grp) => ({
    ...grp,
    items: grp.items.filter((n) => CORE_PATHS.has(n.to) || !hidden.includes(n.to)),
  })).filter((grp) => grp.items.length > 0);

  const onLogout = async () => {
    await Auth.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="shell">
      <header className="appbar no-print">
        <Link to="/" className="appbar-brand" aria-label="홈으로">
          <img className="brand-logo" src="/logo.png" alt="애드텍디자인 — 옥외광고 견적" />
        </Link>
        <HeaderSearch />
        <div className="profile-wrap">
          <button
            className="profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label={unread > 0 ? `프로필 — 안 읽은 알림 ${unread}건` : "프로필"}
            aria-expanded={profileOpen}
          >
            <span className="avatar">
              {avatarInitial}
              {unread > 0 && <span className="avatar-dot" aria-hidden />}
            </span>
          </button>
          {profileOpen && (
            <div className="profile-menu" onMouseLeave={() => setProfileOpen(false)}>
              <div className="profile-head">
                <span className="avatar lg">{avatarInitial}</span>
                <div className="profile-id">
                  <div className="nm">{session?.name || "사용자"}</div>
                  <div className="em">
                    {session?.email}
                    {session?.provider === "kakao" ? " · 카카오" : ""}
                  </div>
                </div>
              </div>
              <Link className="profile-item" to="/notifications" onClick={() => setProfileOpen(false)}>
                <Bell size={16} /> 알림센터
                {unread > 0 && <span className="profile-count">{unread}</span>}
              </Link>
              <button className="profile-item" onClick={toggleTheme}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? "라이트 모드" : "다크 모드"}
              </button>
              <div className="profile-sep" />
              <button className="profile-item danger" onClick={onLogout}>
                <LogOut size={16} /> 로그아웃
              </button>
            </div>
          )}
        </div>
        {/* 햄버거 토글 — 우측 끝(사이드바가 오른쪽이므로 동선 일치) */}
        <button
          className="btn appbar-burger"
          data-icon-only
          data-variant="ghost"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={navOpen}
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      <div className="body">
        <aside className={`sidebar${navOpen ? " open" : ""}`}>
          <nav>
            {visibleNav.map((grp) => (
              <div key={grp.section} className="nav-group">
                <div className="nav-section">{grp.section}</div>
                {grp.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>
                    <span className="ic"><n.icon size={18} /></span>
                    {n.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}

        <main className="main">
          <Outlet />
        </main>
      </div>

      {/* 가입 직후 1회: 회사(공급자) 정보 온보딩 */}
      {needCompany && (
        <OnboardingCompany managerName={session?.name} onClose={() => setNeedCompany(false)} />
      )}
    </div>
  );
}
