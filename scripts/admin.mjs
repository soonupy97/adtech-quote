import { readFileSync, writeFileSync } from "fs";
function edit(file, edits) {
  let s = readFileSync(file, "utf8"); let ok = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) { console.log(`MISS ${file} :: ${from.slice(0, 46).replace(/\n/g, "⏎")}`); continue; }
    s = s.replace(from, to); ok++;
  }
  writeFileSync(file, s, "utf8");
  console.log(`${file}: ${ok}/${edits.length}`);
}

// 1) auth.ts — ensureLocalAdmin() 추가
edit("src/lib/auth.ts", [[
`export const Auth = {
  enabled: isSupabaseEnabled,
`,
`export const Auth = {
  enabled: isSupabaseEnabled,

  // [로컬 목업 전용] gitignore 된 .env 의 VITE_ADMIN_* 로 관리자 계정을 1회 시드한다.
  // 비밀번호는 소스/깃이 아니라 .env 에서만 읽는다(자격증명 유출 방지).
  // 실서비스(Supabase) 모드에선 동작하지 않는다 → 그땐 Supabase 가입을 쓴다.
  ensureLocalAdmin(): void {
    if (isSupabaseEnabled) return;
    const email = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim();
    const pw = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
    const name = (import.meta.env.VITE_ADMIN_NAME as string | undefined)?.trim() || "관리자";
    if (!email || !EMAIL_RE.test(email) || !pw || pw.length < 6) return;
    const key = normEmail(email);
    const map = readAccounts();
    if (map[key]) return; // 이미 있으면 보존(비밀번호 덮어쓰지 않음)
    map[key] = { email: key, name, pw: djb2(pw), created_at: new Date().toISOString() };
    writeAccounts(map);
  },
`]]);

// 2) main.tsx — 시드 호출
edit("src/main.tsx", [
  [`import { store } from "@/lib/store";`,
   `import { store } from "@/lib/store";\nimport { Auth } from "@/lib/auth";`],
  [`store.seedIfEmpty().catch(() => {});`,
   `store.seedIfEmpty().catch(() => {});\n// 로컬 관리자 계정 시드 (.env 의 VITE_ADMIN_* 가 채워졌을 때만 1회)\nAuth.ensureLocalAdmin();`],
]);

// 3) .env.example — 관리자 변수 문서화
edit(".env.example", [[
`VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=`,
`VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# ─────────────────────────────────────────────────────────────
# 로컬 관리자 계정 시드 (로컬 목업 모드 전용 · 나만 쓰는 관리자 로그인)
#
# 아래 3개를 채우면 첫 실행 시 이 계정이 자동 생성됩니다(브라우저 저장).
# 비밀번호는 .env 에만 두세요 — 이 파일(.env)은 .gitignore 라 깃에 안 올라갑니다.
# (.env.example 에는 비밀번호를 적지 마세요.) 비밀번호는 6자 이상.
#
# ※ 로컬 목업은 실보안이 아니며, Vercel 등 공개 배포 시 번들에 노출될 수 있습니다.
#    실서비스로 쓰려면 위 Supabase 설정으로 전환해 Supabase 가입을 사용하세요.
# ─────────────────────────────────────────────────────────────
VITE_ADMIN_EMAIL=
VITE_ADMIN_NAME=관리자
VITE_ADMIN_PASSWORD=`]]);
