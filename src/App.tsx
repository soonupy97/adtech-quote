import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Quotes from "@/pages/Quotes";
import Editor from "@/pages/Editor";
import QuoteDetail from "@/pages/QuoteDetail";
import View from "@/pages/View";
import Clients from "@/pages/Clients";
import Catalog from "@/pages/Catalog";
import Settings from "@/pages/Settings";
import Templates from "@/pages/Templates";
import Leads from "@/pages/Leads";
import Contracts from "@/pages/Contracts";
import WorkOrders from "@/pages/WorkOrders";
import Signage from "@/pages/Signage";
import CalendarPage from "@/pages/Calendar";
import Payments from "@/pages/Payments";
import Invoices from "@/pages/Invoices";
import Reports from "@/pages/Reports";
import Notifications from "@/pages/Notifications";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* 공개 */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/view" element={<View />} />

          {/* 인증 필요 (AppShell 보호) */}
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/:id" element={<QuoteDetail />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/editor/:id" element={<Editor />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/workorders" element={<WorkOrders />} />
            <Route path="/signage" element={<Signage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            {/* 통합/이동된 메뉴 — 구버전 링크 호환 리다이렉트 */}
            <Route path="/pipeline" element={<Navigate to="/leads" replace />} />
            <Route path="/team" element={<Navigate to="/settings" replace />} />
            <Route path="/integrations" element={<Navigate to="/settings" replace />} />
            <Route path="/activities" element={<Navigate to="/settings" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
