import { chromium } from "playwright";
const url = "http://localhost:5199";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });

// 깨끗한 상태에서 시작 (계정/세션 비우기) → main.tsx 의 ensureLocalAdmin 이 .env 시드
await p.goto(url + "/login", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { localStorage.removeItem("oad_accounts_v1"); localStorage.removeItem("oad_session_v1"); });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(500);

// 시드된 계정 확인
const seeded = await p.evaluate(() => localStorage.getItem("oad_accounts_v1"));
console.log("seeded accounts:", seeded);

// 관리자 자격으로 로그인
await p.fill('input[type="email"]', "admin@test.local");
await p.fill('input[type="password"]', "test1234");
await p.click('button:has-text("로그인")');
await p.waitForTimeout(1200);
console.log("after login URL:", new URL(p.url()).pathname);
const session = await p.evaluate(() => localStorage.getItem("oad_session_v1"));
console.log("session:", session);
await p.screenshot({ path: "scripts/admin-login.png" });

// 잘못된 비밀번호는 거부되는지
await p.evaluate(() => localStorage.removeItem("oad_session_v1"));
await p.goto(url + "/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "admin@test.local");
await p.fill('input[type="password"]', "wrongpw");
await p.click('button:has-text("로그인")');
await p.waitForTimeout(600);
console.log("wrong-pw stays on login:", new URL(p.url()).pathname);

await b.close();
