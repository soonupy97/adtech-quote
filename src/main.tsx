import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { store } from "@/lib/store";
import { Auth } from "@/lib/auth";
import "@/styles/index.scss";

// 초기 테마
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("oad_theme") || "light",
);

// 단가표 시드 (oad_seeded_v1 없을 때 1회)
store.seedIfEmpty().catch(() => {});
// 로컬 관리자 계정 시드 (.env 의 VITE_ADMIN_* 가 채워졌을 때만 1회)
Auth.ensureLocalAdmin();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
