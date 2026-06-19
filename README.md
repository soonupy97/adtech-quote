# 옥외광고 전자견적서 SaaS

간판·현수막 옥외광고 업체용 전자견적서 SaaS. 견적 작성 → 고객에게 링크 발송 →
고객이 로그인 없이 열람·수락(전자서명) → 업체가 대시보드로 상태 관리.

블루프린트 `BLUEPRINT-옥외광고-전자견적-SaaS.md` 의 **운영 버전(B)** 구현체입니다.

## 스택

- **React 18 + Vite + TypeScript + SCSS** (패키지매니저: yarn)
- **Supabase** (PostgreSQL + Auth + RLS) — 미설정 시 자동으로 `localStorage` 목업 모드
- **Vercel** 배포 (SPA rewrite 포함)
- 디자인: 토스(Toss) 스타일 · 폰트 Pretendard

## 빠른 시작

```bash
yarn install
yarn dev          # http://localhost:5173
```

Supabase 없이도 즉시 동작합니다(브라우저 localStorage 저장). 처음 실행 시
샘플 단가표 45행(15품목 × 3등급)이 자동 시드됩니다.

## Supabase 연동 (운영)

1. Supabase 프로젝트 생성 후 SQL Editor 에서 `supabase/schema.sql` 실행.
2. `.env` 작성:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
3. `yarn dev` 재시작 → 자동으로 클라우드 모드로 전환.
4. **카카오 로그인**: Supabase → Auth → Providers → Kakao 활성화 +
   Redirect URI `https://<project>.supabase.co/auth/v1/callback` 등록
   (블루프린트 §14.4).

## 라우팅

| 경로 | 화면 | 인증 |
|---|---|---|
| `/login` | 로그인/계정만들기 + 카카오 | 공개 |
| `/` | 대시보드(통계·수주율·파이프라인) | 필요 |
| `/quotes`, `/quotes/:id` | 견적 목록 / 상세 | 필요 |
| `/editor`, `/editor/:id` | 견적 작성/수정 | 필요 |
| `/clients` `/catalog` `/settings` | 거래처 / 품목단가 / 설정 | 필요 |
| `/view?t=<token>` | **고객 열람(읽기전용+수락/서명)** | **공개** |

## 구조

```
src/
├─ lib/
│  ├─ quote.ts            마스터데이터·계산식·유틸 (블루프린트 §8·§9, 변경 금지)
│  ├─ store.types.ts      Store API 계약 (§11)
│  ├─ store.local.ts      localStorage 구현
│  ├─ store.supabase.ts   Supabase 구현 (동일 시그니처)
│  ├─ store.ts            환경에 따라 구현 선택
│  ├─ auth.ts             로컬 djb2 로그인 / Supabase Auth (§12)
│  └─ supabaseClient.ts
├─ components/  AppShell · QuoteReadonly · StatusBadge · Toast · Modal · SignaturePad
├─ pages/       Login · Dashboard · Quotes · Editor · QuoteDetail · View · Clients · Catalog · Settings
└─ styles/      토스 디자인 토큰 + 컴포넌트 + 다크모드 + 인쇄
```

## 빌드

```bash
yarn build        # 타입체크 + 프로덕션 번들
yarn preview
```

## 단계(로드맵) — 부록 A~E 전체 구현

- **P0**: 자동단가·작성/발송/열람/수락·서명·대시보드·거래처·단가표·설정·로그인·다크모드.
- **P1 (견적자동화·문서)**: 견적 템플릿, 회사 브랜딩(로고/직인/테마색), 표준약관·커버레터,
  품목 옵션/변형 단가, 수량 구간별 단가, 원가·마진 계산, 세금모드(과세/면세/영세·포함/별도),
  자동 할인 규칙 엔진(부록 C)·프로모션 코드, 견적번호 채번 규칙 커스텀, 유효기간 자동 만료,
  CSV import/export, 자동저장, PDF 워터마크(DRAFT), 첨부 갤러리.
- **P2 (CRM·발송·계약)**: 리드/문의 인박스, 영업 파이프라인 칸반(드래그), 거래처 확장(담당자·태그·등급),
  열람/수락 실시간 알림·알림센터, 고객 코멘트/재협상, 전자계약(다중 서명자), 작업지시서,
  견적 버전/리비전 관리, 활동 로그(감사), 전환 퍼널, 팔로업 리마인더.
- **P3 (정산·연동·협업)**: 수주 전환·입금/미수금 관리, 세금계산서(팝빌/바로빌 자리), 매출 리포트(추이·랭킹),
  멀티채널 발송(카카오/문자/이메일 시뮬), Slack/Zapier 웹훅·구글 캘린더·공개 API 키,
  다계정/역할 권한(부록 D), 고액·고할인 승인 워크플로.

### 추가 핵심 모듈

```
src/lib/automation.ts   자동할인 규칙·세금모드·마진·유효기간 만료·리마인더·승인 (부록 A19·C·D)
src/lib/csv.ts          CSV 가져오기/내보내기 (부록 A27)
src/lib/integrations.ts Slack/Zapier 웹훅·캘린더·멀티채널 발송 (부록 A27)
```

> 일부 P3 항목(카카오 알림톡/문자 실발송, 세금계산서 실발행)은 사업자 인증·발송대행사·팝빌 API 연동이
> 필요해(블루프린트 §14.5) 시뮬레이션 + 설정 자리로 구현되어 있습니다. Supabase 확장 엔티티는
> `app_collections`(jsonb) 단일 테이블에 collection 별로 저장됩니다.

> ⚠️ 단가표는 샘플 시장가입니다. 실제 단가로 교체하세요(블루프린트 §18).
