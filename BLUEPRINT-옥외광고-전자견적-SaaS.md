# 옥외광고 전자견적서 SaaS — 종합 블루프린트 (재현용)

> **이 문서의 목적**: 이 MD 파일 **하나만** 읽고도 동일한 시스템을 처음부터 재현할 수 있도록, 도메인 지식·데이터 모델·계산식·마스터 데이터·상태 머신·API 계약·디자인 시스템·화면별 명세·DB 스키마·React 재구축 가이드를 모두 담는다.
>
> 작성일: 2026-06-19 · 대상 독자: 이 프로젝트를 이어받는 AI(또는 개발자)

---

## 0. Claude에게 — 재현 지침

이 문서로 재현할 때 따른다.

1. **두 가지 산출물 형태가 가능**하다. 요청에 맞춰 택한다.
   - (A) **프로토타입 재현**: 순수 HTML + CSS + JavaScript + `localStorage`. 빌드 도구·서버 없이 브라우저에서 바로 동작. → 본 문서 §1~§13 그대로 구현.
   - (B) **운영 버전 재구축**: React + Vite + Vercel + Supabase(+Kakao OAuth). → §1~§13의 **로직·데이터·디자인을 그대로** 옮기고 §14의 매핑을 따른다.
2. **데이터 모델·계산식·마스터 데이터·상태 머신은 절대 변경 금지**(§7~§11). 그대로 옮긴다.
3. **디자인은 토스(Toss) 스타일**(§6). 색 토큰·폰트·라운드·컴포넌트 규칙을 지킨다.
4. 모든 UI 텍스트는 **한국어**, 통화는 **원(KRW)**, 부가세 **10%**.
5. **고객 열람 화면(view)은 로그인 없이 공개**, 그 외 내부 화면은 인증 필요(§13).
6. **플러그(Pluuug) 수준의 전체 기능**을 목표로 한다 → **부록 A~E**(전체 기능 카탈로그·확장 데이터 모델·자동화 규칙·권한·통합 로드맵)를 반드시 함께 구현 범위로 삼는다. 단계는 `P0`(완료)→`P1`(견적자동화)→`P2`(CRM·계약)→`P3`(정산·연동) 순.

---

## 1. 제품 개요

- **무엇**: 옥외광고(간판·현수막) 업체가 **워드 수기 견적**을 대체하는 **전자견적서 SaaS**. 견적 작성 → 고객에게 링크 발송 → 고객이 가입 없이 열람·수락(전자서명) → 업체가 상태를 대시보드로 관리.
- **벤치마크**: 국내 견적 자동화 SaaS **플러그(Pluuug)** — "문의→영업→견적→계약→정산→세금→매출"을 대시보드로 관리하는 CRM+ERP 통합툴. 본 제품은 그 개념을 **옥외광고 견적**에 맞춰 구현.
- **사용 주체**: 단일 회사 전용(직원이 작성/관리, 고객은 링크 열람만).
- **핵심 가치**: ① 단가표 기반 **자동 견적** ② **링크 발송 + 상태 추적**(작성·발송·열람·수락) ③ **거래처(CRM)·품목단가 마스터** 재사용.

---

## 2. 단계(로드맵)

| 단계 | 내용 | 본 문서 반영 |
|---|---|---|
| 1 | 견적 작성·저장·링크 발송·열람 추적 | ✅ 구현됨 |
| 2 | 고객 수락/거절·간단 전자서명·(알림) | ✅ 수락/거절/서명 구현, 알림은 미구현 |
| 3 | 대시보드·거래처(CRM)·품목단가·직원 로그인 | ✅ 구현됨(로컬 로그인) |
| 4 | 카카오 알림톡/문자 자동발송 | ⛔ 미구현(사업자 인증 필요) — §14 참고 |

현재 산출물 = **플러그형 SaaS 프로토타입**(순수 HTML/JS + localStorage). 알림 자동발송과 실제 보안 인증만 클라우드 전환 시 추가.

---

## 3. 기술 스택

- **프로토타입(현재)**: HTML5 + CSS(단일 `style.css`) + Vanilla JS(ES2015) + `localStorage`. 외부 의존성은 **Pretendard 폰트 CDN** 뿐.
- **운영 목표**: React + Vite, 호스팅 Vercel, 백엔드/DB/인증 Supabase(PostgreSQL + Auth + RLS), 소셜 로그인 Kakao(Supabase Provider).

---

## 4. 파일 구조 (프로토타입)

```
옥외광고_견적서/
├─ app/
│  ├─ index.html        → dashboard.html 로 리다이렉트
│  ├─ login.html        로그인/계정만들기 + 카카오(데모)
│  ├─ dashboard.html    대시보드(통계·수주율·파이프라인·상태분포·최근견적)
│  ├─ quotes.html       견적 목록(검색·상태필터·발송·복제·삭제)
│  ├─ editor.html       견적 작성/수정(자동단가·거래처불러오기·설정기본값)
│  ├─ quote.html        견적 상세(상태 타임라인·서명·발송·복제)
│  ├─ view.html         ★고객용 읽기전용(열람기록·수락/거절·전자서명) — 공개
│  ├─ clients.html      거래처(CRM) CRUD
│  ├─ catalog.html      품목·단가표 CRUD(+샘플 시드)
│  ├─ settings.html     회사정보·견적 기본값
│  ├─ list.html         → quotes.html 로 리다이렉트(구버전 호환)
│  └─ assets/
│     ├─ style.css      토스풍 공용 스타일(디자인 토큰·컴포넌트)
│     ├─ quote.js       도메인 모델·마스터데이터·계산·읽기전용 렌더
│     ├─ store.js       데이터 계층(localStorage; Supabase로 교체 가능)
│     └─ app.js         앱 셸(사이드바)+로컬 로그인(Auth)+토스트
├─ supabase/
│  └─ schema.sql        운영 전환용 테이블·RLS·함수
└─ docs/                설계·구현계획·셋업가이드·본 블루프린트
```

**스크립트 로드 순서(내부 앱 페이지)**: `quote.js` → `store.js` → `app.js`.
**고객 페이지(view.html)**: `quote.js` → `store.js` 만 (app.js 미포함 → 인증/사이드바 없음 = 공개).

---

## 5. 도메인 지식 — 옥외광고 견적 구성요소

견적서는 5개 비용의 합: **① 자재비 ② 제작비 ③ 시공·설치비 ④ 인허가·행정비 ⑤ 부대비용**.
계산 흐름: `품목합계 + 시공 + 인허가 + 부대 = 소계 → ±할증/할인 → 공급가 → +VAT(10%) → 총액`.

- **광고물 종류**: 전면간판(채널), 채널레터, 후레임(파나플렉스), 갈바간판, LED 전광판, 아크릴 간판, 시트지 시공, 돌출간판(양면), 입간판(스탠드), 윈도우시트, 어닝(차양), 현수막(일반), 메쉬현수막, 배너(거치대), 네온/플렉스네온.
- **부품(발광/구조/고정)**: LED모듈, SMPS(파워), 컨트롤러, 전선, 커넥터, 아크릴/플렉스, 시트지, 각관/프레임, 앙카/피스, 브라켓.
- **시공·공사**: 기존간판 철거, 폐기물 처리, 고소작업(스카이차), 비계/아시바, 전기 인입·증설, 누전차단기/배선, 벽체 보강·타공, 도색/페인트, 방수·코킹, 운반·상하차, 야간/휴일 할증, 크레인(대형물).
- **인허가·행정**: 옥외광고물 허가/신고 대행, 면허세/허가수수료, 광고물 보증보험, 구조안전 확인, 전기 사용전 점검, 도로점용 허가.
- **할증 요인**: 층수/설치높이, 작업난이도, 야간/휴일, 긴급납기, 원거리출장, 고급자재, 방수강화.
- **할인 요인**: 수량/면적, 단골/재계약, 세트, 현금/선결제, 시즌.

---

## 6. 디자인 시스템 (토스 스타일)

**폰트**: Pretendard. CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`. `-webkit-font-smoothing: antialiased`.

**색 토큰(CSS 변수)**:
```
--toss-blue:#3182f6;  --toss-blue-dark:#2272eb;  --toss-blue-soft:#e8f3ff;
--bg:#f2f4f6;  --card:#fff;  --fill:#f2f4f6;  --fill-2:#f9fafb;  --line:#e5e8eb;
--text:#191f28;  --text-2:#4e5968;  --text-3:#8b95a1;
--danger:#f04452;  --success:#15c47e;  --warn:#ff9500;
--radius:20px;  --radius-sm:12px;
```

**원칙**:
- 배경 `--bg` 회색, 콘텐츠는 흰색 **라운드 카드**(radius 20px). 테두리 최소화, 여백 중심.
- 입력은 **filled 스타일**: 배경 `--fill`, 테두리 없음, 포커스 시 `box-shadow:0 0 0 2px var(--toss-blue) inset` + 배경 흰색.
- 버튼은 **pill**(radius 12px). 주버튼 `--toss-blue`+흰글자, 보조 `--toss-blue-soft`+파란글자, 회색 `--fill`. `:active{transform:scale(.98)}`.
- 숫자는 `font-variant-numeric:tabular-nums`, 금액 우측정렬.
- 체크 항목은 **토글 카드**: 선택 시 `--toss-blue-soft` 배경 + `inset` 파란 테두리 + 커스텀 체크(✓) 애니메이션.
- **상태 뱃지**(점+텍스트, pill): draft 회색(`#868e96`/`#f1f3f5`), sent 주황(`#f08c00`/`#fff4e6`), viewed 파랑(`#3182f6`/`#e8f3ff`), accepted 초록(`#15c47e`/`#e6fcf3`), rejected 빨강(`#f04452`/`#fdeef0`).
- **하단 액션바**: sticky, blur 배경, 둥근 그림자. **토스트**: 하단 중앙, 다크 배경 pill, 2.2초.
- **사이드바**(내부 앱): 좌측 236px 흰색, 메뉴 라운드, active는 파란 soft. 좁은 화면(≤860px)에선 상단 가로 스크롤 바로 전환.
- 반응형: ≤720px에서 2단 그리드 → 1단.

**인쇄(PDF)**: `@media print`에서 사이드바·액션바·`.no-print` 숨김, 카드 그림자 제거, `break-inside:avoid`.

---

## 7. 데이터 모델 (엔티티 스키마)

### 7.1 Quote (견적)
```jsonc
{
  "id": "uuid",
  "public_token": "uuid",        // 고객 링크용(추측 불가)
  "quote_no": "Q-YYYYMMDD-NNN",
  "status": "draft|sent|viewed|accepted|rejected",
  "supplier": { "name","bizno","ceo","addr","tel","manager" },
  "customer": { "name","tel","addr" },
  "site":     { "floor","height","road" },
  "items": [ {
    "type": "광고물 종류(ITEM_TYPES 중)",
    "w": "가로(m, 문자)", "h": "세로(m, 문자)",
    "grade": "일반|고급|수입",
    "price": 0,            // 단가(원)
    "qty": 1,
    "parts": { "LED모듈": 4, "SMPS": 1 }   // 부품 수량 메모(금액 비반영)
  } ],
  "constructions": [ { "name","checked":false,"cost":0 } ], // 고정 12항목
  "permits":       [ { "name","checked":false,"cost":0 } ], // 고정 6항목
  "etcCosts":      [ { "name","checked":false,"cost":0 } ], // 고정 4항목
  "adjustments": {
    "surcharge": [ { "label","mode":"pct|amt","value":0 } ],
    "discount":  [ { "label","mode":"pct|amt","value":0 } ]
  },
  "paymentTerms": { "deposit","balance","as" },
  "validity": "발행일로부터 15일",
  "notes": "",
  "events": [ { "type":"created|sent|viewed|accepted|rejected", "at":"ISO", "meta":{} } ],
  "customer_response": { "name","accepted":true,"at":"ISO" },  // 응답 시
  "signature": "data:image/png;base64,...",                    // 수락+서명 시
  "created_at":"ISO","updated_at":"ISO","sent_at":"ISO","first_viewed_at":"ISO","responded_at":"ISO"
}
```

### 7.2 Client (거래처)
`{ id, name, tel, addr, manager, memo, created_at }`

### 7.3 CatalogItem (품목·단가)
`{ id, type, grade, unit, price, memo }` — 자동단가 키 = `type + "|" + grade`.

### 7.4 Settings (설정)
```jsonc
{ "supplier": { name,bizno,ceo,addr,tel,manager },
  "defaults": { validity, deposit, balance, as } }
```

### 7.5 Auth (로컬 로그인; 프로토타입)
- account `oad_auth_v1`: `{ name, email, pw(해시), created_at }`
- session `oad_session_v1`: `{ name, email, provider, at }`

### 7.6 localStorage 키
`oad_quotes_v1` · `oad_clients_v1` · `oad_catalog_v1` · `oad_settings_v1` · `oad_seq_v1`(견적번호 시퀀스) · `oad_seeded_v1`(시드 플래그) · `oad_auth_v1` · `oad_session_v1`.

---

## 8. 마스터 데이터 (그대로 사용)

```js
ITEM_TYPES = ["전면간판(채널)","채널레터","후레임(파나플렉스)","갈바간판","LED 전광판",
  "아크릴 간판","시트지 시공","돌출간판(양면)","입간판(스탠드)","윈도우시트",
  "어닝(차양)","현수막(일반)","메쉬현수막","배너(거치대)","네온/플렉스네온","기타"]; // 16

GRADES = ["일반","고급","수입"];

PARTS = ["LED모듈","SMPS","컨트롤러","전선(m)","커넥터","아크릴/플렉스","시트지(㎡)","각관/프레임","앙카/피스","브라켓"]; // 10

CONSTRUCT = ["기존간판 철거","폐기물 처리","고소작업(스카이차)","비계/아시바","전기 인입·증설",
  "누전차단기/배선","벽체 보강·타공","도색/페인트","방수·코킹","운반·상하차","야간/휴일 할증","크레인(대형물)"]; // 12

PERMIT = ["옥외광고물 허가/신고 대행","면허세/허가수수료","광고물 보증보험","구조안전 확인","전기 사용전 점검","도로점용 허가"]; // 6

ETC = ["디자인비","출장비","감리/현장조사","기타"]; // 4

STATUS_LABEL = { draft:"작성", sent:"발송", viewed:"열람", accepted:"수락", rejected:"거절" };
```

### 8.1 기본 단가표 시드 (15품목 × 3등급 = 45행)
형식 `[종류, 단위, 일반, 고급, 수입]` (원). **샘플 시장가이며 실제 단가로 교체 필요.**
```
["전면간판(채널)","㎡",150000,200000,280000],
["채널레터","㎡",250000,350000,500000],
["후레임(파나플렉스)","㎡",130000,180000,250000],
["갈바간판","㎡",90000,120000,160000],
["LED 전광판","㎡",600000,900000,1300000],
["아크릴 간판","㎡",80000,120000,180000],
["시트지 시공","㎡",30000,45000,70000],
["돌출간판(양면)","개",600000,900000,1400000],
["입간판(스탠드)","개",150000,250000,400000],
["윈도우시트","㎡",25000,40000,60000],
["어닝(차양)","㎡",120000,180000,250000],
["현수막(일반)","㎡",8000,12000,18000],
["메쉬현수막","㎡",12000,18000,25000],
["배너(거치대)","개",15000,25000,40000],
["네온/플렉스네온","m",50000,80000,120000]
```
시드는 `oad_seeded_v1`가 없을 때 1회만 수행.

---

## 9. 계산 로직 (정확히 동일하게)

유틸:
```
num(v)  = 문자열에서 [0-9.-]만 남겨 parseFloat, 실패 시 0
won(n)  = Math.round(n).toLocaleString("ko-KR") + "원"
itemArea(it)   = round(num(w)*num(h), 2)   // 0이면 표시 안 함
itemAmount(it) = num(price) * num(qty)
```
합계 `calcTotals(q)`:
```
items     = Σ itemAmount(item)
construct = Σ cost (checked인 constructions)
permit    = Σ cost (checked인 permits)
etc       = Σ cost (checked인 etcCosts)
subtotal  = items + construct + permit + etc
surcharge = Σ ( mode=="pct" ? subtotal*value/100 : value )  over adjustments.surcharge
discount  = Σ ( mode=="pct" ? subtotal*value/100 : value )  over adjustments.discount
supply    = subtotal + surcharge - discount
vat       = supply * 0.1
grand     = supply + vat
```
**할증/할인의 pct는 항상 `subtotal` 기준**(공급가 아님).

견적번호: `Q-YYYYMMDD-NNN` — 당일 시퀀스(`oad_seq_v1`에 날짜별 카운트), NNN 3자리 0패딩.

검증 예시(회귀 테스트용): 품목 [채널레터 4×0.7 고급 단가350000 ×1]=350000, [추가 없음] + 시공 고소작업 300000 → subtotal 650000... (구현 후 본인 데이터로 확인). 별도 예시: items 1,260,000 + 시공 300,000 + 인허가 150,000 = subtotal 1,710,000, 할증 10% =171,000, 할인 50,000 → supply 1,831,000, vat 183,100, **grand 2,014,100**.

---

## 10. 상태 머신 & 이벤트

상태: `draft → sent → viewed → (accepted | rejected)`.

| 동작 | 전이 | 기록 |
|---|---|---|
| `saveQuote`(신규) | (없음)→draft | id·public_token·quote_no 생성, event `created` |
| `saveQuote`(수정) | 상태 유지 | created_at·token·상태·응답필드 보존 |
| `markSent(id)` | draft→sent | sent_at, token 보장, event `sent`, 링크 URL 반환 |
| `markViewed(token)` | sent→viewed | first_viewed_at(최초만), event `viewed` (draft면 무시) |
| `markResponse(token,accept,name,sig)` | →accepted/rejected | responded_at, customer_response, (수락 시)signature, event |
| `duplicateQuote(id)` | →draft(신규) | token·발송·응답 필드 제거, quote_no 재발급 |

**이벤트 타임라인**은 `events[]`(시간순)로 상세 화면에 역순 표시.

---

## 11. Store API 계약 (데이터 계층)

모든 메서드는 **Promise 반환**(나중에 네트워크로 바꿔도 호출부 불변). localStorage 구현 → Supabase 구현으로 **동일 시그니처 교체**.

```
// 견적
listQuotes() -> [summary]            // 최신순. summary: {id,quote_no,status,customer,customer_tel,grand,created_at,sent_at,first_viewed_at,responded_at,title}
getQuote(id) -> quote|null
getQuoteByToken(token) -> quote|null // ★draft면 null(보안)
saveQuote(quote) -> quote            // id 없으면 생성(draft), 있으면 수정(보존필드 유지)
duplicateQuote(id) -> quote(draft)
markSent(id) -> { token, url }
markViewed(token) -> true|null
markResponse(token, accept, name, signature) -> quote|null
removeQuote(id) -> true
shareUrl(token) -> "<base>/view.html?t=<token>"   // base = 현재 URL의 파일명·쿼리 제거

// 통계
stats() -> { count, monthCount, monthAmt, sent, accepted, winRate, pipelineAmt, byStatus{draft,sent,viewed,accepted,rejected} }
// winRate = round(accepted / sent * 100), sent = 발송이상 상태 수, pipelineAmt = sent+viewed 금액합, monthAmt = 이번달 생성 견적 grand 합

// 거래처
listClients() -> [client]   getClient(id)   saveClient(c)->c   removeClient(id)

// 품목·단가
listCatalog() -> [item]
catalogMap() -> { "type|grade": item }   // 자동단가 조회
saveCatalogItem(r)->r   removeCatalogItem(id)

// 설정
getSettings() -> {supplier,defaults}   saveSettings(s)->s

// 시드
seedIfEmpty() -> boolean   // oad_seeded_v1 없을 때 45행 단가표 생성
```
ID는 `crypto.randomUUID()`(없으면 폴리필). 시간은 ISO 문자열.

---

## 12. Auth 계약 (로그인)

**프로토타입 = 로컬 로그인**(`app.js`의 `App.Auth`). ⚠️ 실보안 아님(우회 가능). 운영은 Supabase Auth로 교체.
```
hasAccount() -> bool
register(name,email,pw) -> {ok}        // 계정 저장 + 세션 설정. pw는 djb2 해시(hex)
login(email,pw) -> {ok, msg?}          // 계정/비번 검증 후 세션
demoSocial(provider) -> {ok}           // 카카오 등 데모(시뮬) 로그인. 세션 provider 기록
current() -> session|null
logout() -> (세션 삭제 후 login.html)
resetAccount()
```
**페이지 보호**: `app.js`는 DOMContentLoaded에서 **`#sidebar`가 있는 내부 페이지**면 `current()` 없을 때 `login.html`로 redirect. `view.html`은 `#sidebar`도 `app.js`도 없어 **공개**.

**카카오 로그인**: 프로토타입은 `demoSocial("kakao")`로 시뮬. 실제는 §14.4(Supabase Kakao Provider). `file://`에선 실동작 불가(Redirect URI·도메인 필요).

---

## 13. 보안 규칙

- `public_token`은 추측 불가 UUID. **링크를 아는 사람만** 열람.
- **draft(미발송)는 `getQuoteByToken`이 null** 반환 → 고객 노출 금지.
- 고객 화면은 **읽기 전용**(+ 수락/거절/서명만 가능). 단일 견적만 접근.
- 내부 화면은 인증 필요. 운영(Supabase)에서는 **RLS로 본인(owner) 견적만** CRUD, 고객용은 토큰 RPC(`get_quote_by_token`, `mark_viewed`)만 anon 허용(§ schema).

---

## 14. 운영 재구축 가이드 (React + Vercel + Supabase + Kakao)

### 14.1 라우팅(예: React Router)
`/login` `/`(대시보드) `/quotes` `/quotes/:id`(상세) `/editor` `/editor/:id` `/clients` `/catalog` `/settings` · 공개 `/view?t=token`.

### 14.2 컴포넌트 매핑
- `quote.js` → `lib/quote.ts`(마스터데이터·`calcTotals`·`renderReadonly`는 `<QuoteReadonly>` 컴포넌트로).
- `store.js` → `lib/store.ts`(동일 시그니처, 내부를 Supabase 호출로). localStorage 구현은 오프라인/목업 토글로 남겨도 됨.
- `app.js` 사이드바 → `<AppShell>` 레이아웃, Auth → Supabase Auth 훅.
- 각 `*.html` → 동일 이름 페이지 컴포넌트. 디자인 토큰은 CSS 변수/Tailwind 테마로.

### 14.3 Supabase
- §15 `schema.sql` 실행. `quotes`/`quote_events` + RLS + `get_quote_by_token`/`mark_viewed` 함수.
- 직원 로그인 = Supabase Auth(email/비번). 견적은 `owner_id=auth.uid()`로 격리.
- 거래처·품목단가·설정도 테이블화(동일 필드). 단가표 시드는 마이그레이션으로.

### 14.4 카카오 로그인
1. developers.kakao.com 앱 생성 → REST API 키.
2. 카카오 로그인 ON, 동의항목(닉네임·이메일).
3. Redirect URI = `https://<proj>.supabase.co/auth/v1/callback`.
4. 카카오 플랫폼에 Vercel 도메인 등록.
5. Supabase → Auth → Providers → **Kakao** 활성 + 키 입력.
6. 버튼 → `supabase.auth.signInWithOAuth({ provider:'kakao' })`.
⚠️ 배포 도메인 필수(`file://`·로컬 더블클릭 불가).

### 14.5 미구현(4단계) — 알림 자동발송
카카오 알림톡/문자 자동발송은 **사업자 인증 + 발송대행사(솔라피/알리고 등)** 필요. 발송은 Supabase Edge Function에서 호출. 프로토타입은 "링크 복사 후 수동 전달".

---

## 15. Supabase 스키마 (운영 전환용, 그대로 실행)

```sql
-- 1) 견적
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  quote_no text,
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','rejected')),
  supplier jsonb default '{}'::jsonb, customer jsonb default '{}'::jsonb, site jsonb default '{}'::jsonb,
  items jsonb default '[]'::jsonb, constructions jsonb default '[]'::jsonb, permits jsonb default '[]'::jsonb,
  etc_costs jsonb default '[]'::jsonb, adjustments jsonb default '{}'::jsonb, totals jsonb default '{}'::jsonb,
  payment_terms jsonb default '{}'::jsonb, validity text, notes text,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  sent_at timestamptz, first_viewed_at timestamptz
);
-- 2) 이벤트
create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null check (event_type in ('created','sent','viewed','accepted','rejected')),
  meta jsonb default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_quotes_owner on public.quotes(owner_id);
create index if not exists idx_quotes_token on public.quotes(public_token);
-- 3) RLS
alter table public.quotes enable row level security;
alter table public.quote_events enable row level security;
create policy "owner_select" on public.quotes for select using (auth.uid() = owner_id);
create policy "owner_insert" on public.quotes for insert with check (auth.uid() = owner_id);
create policy "owner_update" on public.quotes for update using (auth.uid() = owner_id);
create policy "owner_delete" on public.quotes for delete using (auth.uid() = owner_id);
create policy "owner_events" on public.quote_events for all using (
  exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid()));
-- 4) 고객 열람용(익명, draft 차단)
create or replace function public.get_quote_by_token(p_token uuid)
returns public.quotes language sql security definer set search_path = public as $$
  select * from public.quotes where public_token = p_token and status <> 'draft' limit 1; $$;
-- 5) 열람 기록
create or replace function public.mark_viewed(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.quotes where public_token = p_token and status <> 'draft' limit 1;
  if v_id is null then return; end if;
  update public.quotes set status = case when status='sent' then 'viewed' else status end,
    first_viewed_at = coalesce(first_viewed_at, now()) where id = v_id;
  insert into public.quote_events(quote_id, event_type) values (v_id, 'viewed');
end; $$;
grant execute on function public.get_quote_by_token(uuid) to anon;
grant execute on function public.mark_viewed(uuid) to anon;
```

---

## 16. 화면별 명세

### 16.1 login.html (공개)
- 중앙 카드. 계정 없으면 **계정 만들기**(이름·이메일·비번), 있으면 **로그인**(이메일·비번). 토글 링크.
- **카카오 버튼**(노랑 #fee500, "💬 카카오로 시작하기 〔데모〕") → 토스트 안내 후 `demoSocial('kakao')` → 대시보드.
- 상단 ⚠️ 노트: "프로토타입 로컬 로그인". Enter 제출. 이미 로그인 상태면 대시보드로 redirect.

### 16.2 dashboard.html (active=dashboard)
- 통계 카드 4개: **이번달 견적**(건수·금액), **진행중**(sent+viewed 건수·대기금액), **수주**(accepted/sent), **수주율 링**(conic-gradient `--p%`).
- **파이프라인**(5칸: 작성/발송/열람/수락/거절 건수, 상태색).
- **상태 분포 막대**(누적 비율) + 범례.
- **최근 견적** 표(6건, 견적번호→quote.html, 고객, 총액, 상태뱃지, 작성일).
- 비었으면 빈 상태 + "첫 견적 만들기".

### 16.3 quotes.html (active=quotes)
- 검색(견적번호·고객명) + 상태 필터.
- 표: 견적번호(→상세)·고객·대표품목·총액·상태·발송·열람 + 관리(🔗 링크발송/편집/삭제).
- 🔗 = `markSent` 후 링크 모달(복사·미리보기).

### 16.4 editor.html (active=quotes)
- 사이드바 레이아웃 + 하단 액션바(저장/발송 링크 생성/PDF/목록).
- **공급자** 카드(설정에서 자동) / **견적·고객·현장** 카드.
- **거래처 불러오기** 드롭다운(선택 시 고객정보 채움) + "거래처 저장" 버튼.
- **품목 표**: 행추가, 종류·가로·세로·면적(자동)·등급·단가·수량·금액(자동), ⚙부품(10종 수량 메모) 펼침.
  - **자동단가**: 종류/등급 **변경 시** `catalogMap[type|grade]` 단가를 단가칸에 넣고 토스트.
- 시공(12)/인허가(6)/부대(4) **토글 카드**(체크 시 금액칸 활성).
- 할인/할증(정률%·정액원) 행추가.
- 합계 박스(품목/시공/인허가/부대/소계/할증/할인/공급가/VAT/총액).
- 결제조건·비고.
- 신규 진입 시 **설정의 회사정보·기본값** 적용. `?id=` 있으면 해당 견적 로드.
- 발송 시 링크 모달 + "상세로" 이동.

### 16.5 quote.html (active=quotes) — 견적 상세(내부)
- 헤더(견적번호·고객·총액·상태뱃지) + 액션(발송 링크/편집/복제/고객화면).
- 수락/거절 시 **결과 배너**.
- **진행 상태 타임라인**(events 역순) + **고객 서명 이미지**(있으면).
- 요약(고객·연락처·총액·작성/발송/최초열람일).
- 하단에 `renderReadonly(q)` 견적 전문.

### 16.6 view.html (공개) — 고객 열람
- 토큰으로 `getQuoteByToken`(draft·잘못된 토큰 → 안내). 진입 시 `markViewed`.
- `renderReadonly(q)`로 견적 표시 + PDF 저장 버튼.
- 미응답이면 **수락/거절 영역**: 성함 입력 + **서명 패드(canvas, 마우스/터치)** + [거절]/[✓ 수락]. 수락은 성함·서명 필수.
- 제출 시 `markResponse` → 결과 배너. 이미 응답된 견적이면 응답 배너만.

### 16.7 clients.html / catalog.html / settings.html
- **clients**: 거래처 표 + 추가/편집 모달(상호·연락처·담당·주소·메모).
- **catalog**: 품목·단가 표 + 추가/편집 모달(종류·등급·단위·단가·메모), 검색, "샘플 단가 다시 채우기"(`oad_seeded_v1` 제거 후 재시드).
- **settings**: 공급자 정보 + 견적 기본값(유효기간·계약금·잔금·A/S), 저장 → 새 견적에 자동.

### 16.8 고객 발송→수락 시퀀스
```
[작성자] editor 저장 → markSent → 링크 복사 → (카톡/문자로 전달)
[고객]  링크 열기 → getQuoteByToken → markViewed(sent→viewed)
        → 성함+서명 → markResponse(accepted, sig)
[작성자] dashboard/quote에서 상태 viewed→accepted, 타임라인·서명 확인
```

---

## 17. 재현 체크리스트 (완료 기준)

- [ ] 마스터데이터(§8)·계산식(§9)·상태머신(§10)이 명세와 정확히 일치(회귀: subtotal 1,710,000 → grand 2,014,100).
- [ ] 단가표 45행 시드, 종류·등급 선택 시 자동단가.
- [ ] 견적 작성·저장(draft)·발송(sent)·고객열람(viewed)·수락+서명(accepted) 전 흐름.
- [ ] draft/잘못된 토큰은 고객 화면에서 차단.
- [ ] 대시보드 통계·수주율·파이프라인·상태분포.
- [ ] 거래처·품목단가·설정 CRUD 및 작성기 연동.
- [ ] 로그인(내부 보호) + 카카오 버튼(프로토타입=데모), view 공개 유지.
- [ ] 토스 디자인 토큰·컴포넌트 일치, 반응형, 인쇄(PDF).

---

## 18. 가정·주의

1. **단가표는 샘플 시장가** — 실제 단가로 교체.
2. 자동단가는 종류/등급 변경 시 **덮어쓰기**(이후 수동 수정 가능).
3. 부품 수량은 **메모용**(금액 미반영).
4. 프로토타입 로그인·카카오는 **데모(비보안)** — 운영은 Supabase Auth/Kakao로 교체.
5. 알림 자동발송·정산·세금계산서는 범위 외(4단계).
6. 데이터는 브라우저 localStorage에만 저장(기기/브라우저 종속). 운영 전환 시 Supabase로 이전.

---

# 부록 A. 플러그형 견적 자동화 — 전체 기능 카탈로그

> 목표: **플러그(Pluuug)** 같은 견적 자동화 SaaS와 최대한 동등한 결과물. 플러그는 "문의→영업→견적→계약→배정→정산→세금→매출"을 하나의 대시보드로 잇는 CRM+ERP 통합툴이다. 아래는 그 전 범위를 옥외광고 견적에 맞춰 **재현 가능한 단위 기능**으로 분해한 것이다.
>
> **단계 태그**: `[P0]` 프로토타입에 이미 구현 · `[P1]` 견적자동화·문서 핵심 · `[P2]` CRM·발송·계약 · `[P3]` 정산·연동·협업. 운영(React+Supabase) 재구축 시 P0→P3 순으로 쌓는다.

## A19. 견적 자동화 엔진
- **품목·단가 마스터 자동단가** `[P0]` — 종류+등급 키로 단가 자동(§8.1).
- **옵션/변형 단가** `[P1]` — 품목별 옵션(예: 양면/단면, LED 색온도, 방수등급)에 가산금액. `catalog.options[]`.
- **수량 구간별 단가(볼륨 디스카운트)** `[P1]` — `priceTiers: [{minQty, price}]`로 수량 많을수록 단가 자동 하향.
- **원가·마진 계산** `[P1]` — 품목에 `cost`(원가) 입력 시 마진율·원가율 자동 표시. 목표 마진 역산(판매가 자동).
- **세금 모드** `[P1]` — 과세(VAT 10%)/면세/영세, **부가세 포함/별도** 토글, 품목별 과세구분.
- **자동 할인 규칙 엔진** `[P1]` — 조건(총액≥/수량≥/거래처등급/기간)에 따라 할인 자동 적용(§A부록 B 규칙 스키마). 프로모션 코드 지원.
- **견적번호 채번 규칙 커스텀** `[P1]` — 접두어·날짜형식·시퀀스 자릿수 설정(기본 `Q-YYYYMMDD-NNN`).
- **유효기간 자동 만료** `[P1]` — 만료일 지나면 상태 `expired` 표시, 재발송 시 연장.
- **견적 버전/리비전 관리** `[P2]` — 수정 시 버전 스냅샷 보관, 고객에게 보낸 버전 추적.
- **다중 통화** `[P3, 선택]` — 기본 KRW. 필요 시 통화·환율.

## A20. 견적서 템플릿 & 문서 커스텀
- **견적 템플릿 저장/불러오기** `[P1]` — 자주 쓰는 견적(품목·시공 세트)을 템플릿으로 저장 → 새 견적에 1클릭 적용. `templates` 엔티티.
- **회사 브랜딩** `[P1]` — 로고·직인 이미지 업로드, 견적서 강조색(테마) 설정 → 고객 화면/PDF에 반영. `settings.branding`.
- **표준 약관/유의사항** `[P1]` — 계약 표준조건·A/S·면책 문구를 설정에 저장 → 견적 하단 자동 삽입.
- **커버레터/인사말** `[P2]` — 견적 상단 맞춤 인사말 블록.
- **문서 레이아웃 테마** `[P2]` — 견적서 스타일 프리셋 선택.
- **PDF 생성·워터마크** `[P1]` — 서버 PDF(운영) 또는 브라우저 인쇄(프로토타입). 초안엔 "DRAFT" 워터마크.
- **첨부파일** `[P2]` — 현장사진·도면·시안 이미지 첨부, 고객 화면에 갤러리.

## A21. CRM & 영업 파이프라인
- **거래처 관리** `[P0]` — 저장·재사용(§16.7).
- **거래처 확장** `[P2]` — 담당자 여러 명(`contacts[]`), 태그, 등급(VIP/일반), 사업자번호, 연락 이력 타임라인, 메모.
- **리드/문의 인박스** `[P2]` — 외부 문의(전화·폼·카톡)를 `leads`로 등록 → 견적으로 전환.
- **영업 파이프라인 칸반** `[P2]` — 단계(문의→상담→견적발송→협상→수주/실주) 보드, 드래그 이동.
- **팔로업 리마인더** `[P2]` — 미열람/미응답 N일 후 담당자에게 후속 알림, 할 일(Task).

## A22. 발송 & 커뮤니케이션
- **링크 발송 + 열람 추적** `[P0]` — 고유 링크, sent→viewed 자동(§10).
- **멀티채널 자동발송** `[P3]` — 카카오 알림톡/문자/이메일 자동전송(사업자 인증+발송대행사). 프로토타입은 링크 복사 수동.
- **열람/수락 실시간 알림** `[P2]` — 고객이 열람·수락하면 담당자에게 푸시/메일/Slack.
- **고객 코멘트·재협상** `[P2]` — 고객이 견적 화면에서 질문·수정요청 코멘트 → 담당자 회신, 금액 협상 스레드.
- **자동 리마인더 재발송** `[P3]` — 미응답 시 정해진 간격 자동 재안내.

## A23. 전자계약 & 서명
- **수락 + 간단 전자서명** `[P0]` — 이름+사인 canvas(§16.6).
- **전자계약 전환** `[P2]` — 수락된 견적 → 계약서 자동 생성(`contracts`), 계약조건·금액·기간 포함.
- **다중 서명자** `[P3]` — 갑/을 양측 서명, 서명 순서.
- **발주서/작업지시서 자동 생성** `[P2]` — 수주 시 시공팀용 작업지시서(품목·현장·시공항목·일정) 자동.

## A24. 정산 · 세금 · 매출 (플러그 핵심 영역)
- **수주 전환 & 입금 관리** `[P3]` — accepted → 수주. 계약금/중도금/잔금 스케줄, 입금 체크, **미수금** 자동 집계. `payments`.
- **세금계산서 발행 연동** `[P3]` — 팝빌/바로빌 등 API로 전자세금계산서 발행. `invoices`.
- **매출 리포트** `[P3]` — 기간별 매출/수금/미수, 품목별·고객별·담당자별 매출.

## A25. 대시보드 & 분석
- **핵심 지표 카드 + 수주율 링 + 파이프라인 + 상태분포** `[P0]` (§16.2).
- **전환 퍼널** `[P2]` — 문의→견적→발송→수락 단계별 전환율.
- **매출 추이/실적** `[P3]` — 월별 매출 추이, 영업사원별·품목별·고객별 랭킹, 평균 견적가·평균 수주가.

## A26. 팀 협업 & 권한
- **직원 다계정 + 역할 권한** `[P3]` — 관리자/영업/뷰어. 본인/팀 견적 범위. `users`, `roles`.
- **승인 워크플로** `[P3]` — 고액·고할인 견적은 관리자 승인 후 발송.
- **활동 로그(감사)** `[P2]` — 누가 언제 무엇을(작성·발송·수정·삭제) `activities`.

## A27. 연동 & 자동화
- **알림 연동** `[P3]` — Slack/이메일/카카오 알림톡.
- **캘린더 연동** `[P3]` — 설치·미팅 일정 구글 캘린더 동기화.
- **Zapier/웹훅 + API** `[P3]` — 외부 자동화(수락 시 웹훅 등), 공개 REST API.
- **엑셀 가져오기/내보내기** `[P1]` — 단가표·거래처·견적 목록 CSV/XLSX import·export.

## A28. 편의기능 (Custom & UX)
- **검색·상태필터·즐겨찾기** `[P0/P1]` — 목록 검색·필터(P0), 즐겨찾기/최근(P1).
- **자동저장 & 임시저장** `[P1]` — 작성 중 주기적 자동저장, 이탈 경고.
- **견적 복제·일괄작업** `[P0/P2]` — 복제(P0), 다건 선택 후 일괄 상태변경·발송(P2).
- **단축키 & 빠른추가** `[P2]` — 품목 행 단축키 추가, 명령 팔레트.
- **다크모드 / 모바일 / 접근성** `[P1]` — 토스 토큰 기반 다크 테마, 반응형(P0)·키보드 접근성.
- **알림센터** `[P2]` — 열람·수락·코멘트·만료 알림 모아보기.

---

# 부록 B. 데이터 모델 확장 (운영 버전 신규 엔티티)

§7의 기본 엔티티에 더해, 플러그형 전체 기능을 위한 확장:

```jsonc
// 견적 템플릿
Template { id, name, memo, payload:{items,constructions,permits,etcCosts,adjustments,paymentTerms} }

// 리드(문의)
Lead { id, source:"phone|form|kakao|walk-in", customerName, tel, memo,
       stage:"new|consult|quoted|won|lost", assignee_id, created_at, quote_id? }

// 거래처 확장
Client { ...기존, bizno, grade:"vip|normal", tags:[], contacts:[{name,role,tel,email}],
         history:[{at, type, memo}] }

// 품목·단가 확장
CatalogItem { ...기존, cost, options:[{name, add}], priceTiers:[{minQty, price}], taxable:true }

// 계약
Contract { id, quote_id, terms, parties:[{role:"갑|을", name, signature, signed_at}], status, created_at }

// 작업지시서
WorkOrder { id, quote_id, site, items, schedule:{installDate}, crew, status }

// 입금/정산
Payment { id, quote_id, kind:"deposit|interim|balance", amount, due_date, paid_at?, paid:false }

// 세금계산서
Invoice { id, quote_id, supplyAmount, vat, total, issued_at, status, provider:"popbill|barobill" }

// 사용자/권한
User { id, name, email, role:"admin|sales|viewer" }

// 활동 로그
Activity { id, actor_id, action, target_type, target_id, meta, at }

// 첨부
Attachment { id, quote_id, kind:"photo|drawing|mockup", url, name }

// 설정 확장
Settings { ...기존,
  branding:{ logoUrl, sealUrl, themeColor },
  tax:{ mode:"taxable|free|zero", vatIncluded:false },
  numbering:{ prefix:"Q", dateFormat:"YYYYMMDD", seqDigits:3 },
  terms:{ standard, as, disclaimer },
  discountRules:[ /* 부록 C */ ] }
```

---

# 부록 C. 자동화 규칙 엔진 (재현용 명세)

**자동 할인 규칙** — 평가 순서대로, 조건 충족 시 적용. 견적 합계 계산(§9) 직후 `adjustments.discount`에 자동 항목으로 주입.
```jsonc
DiscountRule {
  id, label,
  when: {  // 모두 AND
    subtotalGte?: number,      // 소계 이상
    totalQtyGte?: number,      // 총 수량 이상
    clientGrade?: "vip",       // 거래처 등급
    dateFrom?, dateTo?         // 기간(프로모션)
  },
  then: { mode:"pct|amt", value:number },
  stackable: false             // 다른 규칙과 중복 적용 여부
}
```
평가: 견적의 subtotal·수량·거래처·오늘 날짜로 `when` 검사 → 통과 규칙의 `then`을 할인으로 추가(중복 불가면 가장 큰 1개).

**견적번호 채번**: `prefix + "-" + format(today, dateFormat) + "-" + pad(dailySeq, seqDigits)`.

**유효기간 만료**: `now > sent_at + validityDays` 이고 미수락이면 표시 상태 `expired`(저장 상태와 별개의 파생 표시).

**리마인더**: `sent` 후 N일 미열람 → 알림; `viewed` 후 M일 미응답 → 알림. (운영: 스케줄러/Edge Function)

---

# 부록 D. 권한 매트릭스 `[P3]`

| 기능 | admin | sales | viewer |
|---|:--:|:--:|:--:|
| 견적 작성/수정 | ✅ | ✅(본인) | ❌ |
| 견적 삭제 | ✅ | 본인 | ❌ |
| 발송 | ✅ | ✅ | ❌ |
| 단가표/설정 변경 | ✅ | ❌ | ❌ |
| 거래처 관리 | ✅ | ✅ | 보기 |
| 정산/세금 | ✅ | 보기 | ❌ |
| 고액 견적 승인 | ✅ | ❌ | ❌ |
| 전체 통계 | ✅ | 본인 실적 | 보기 |

---

# 부록 E. 통합 로드맵 (기능 → 단계)

| 단계 | 포함 | 산출 |
|---|---|---|
| **P0**(완료, 프로토타입) | 자동단가·작성/발송/열람/수락·서명·대시보드·거래처·단가표·설정·로그인 | 현재 `app/` |
| **P1**(견적자동화·문서) | 템플릿·브랜딩(로고/직인/테마)·표준약관·옵션/구간단가·원가·마진·세금모드·자동할인규칙·엑셀 import/export·자동저장·PDF/워터마크·다크모드 | 견적 자동화 완성 |
| **P2**(CRM·발송·계약) | 리드/파이프라인·거래처확장·열람알림·고객코멘트·전자계약·발주서·버전관리·첨부·활동로그·전환퍼널·알림센터 | 영업·계약 운영 |
| **P3**(정산·연동·협업) | 입금/미수금·세금계산서·매출리포트·멀티채널 자동발송·Slack/캘린더/Zapier/API·다계정/권한·승인워크플로 | 풀 SaaS |

> 재구축 시: P0를 React로 이식 → P1로 "견적 자동화"를 완성 → P2/P3로 플러그 수준까지 확장. 각 단계는 §7·부록 B 데이터 모델과 부록 C 규칙을 따른다.

---

**참고 문서**: `docs/specs/2026-06-19-전자견적서-saas-design.md`(설계), `docs/구현계획-1단계.md`, `docs/SETUP-supabase-vercel.md`(셋업·카카오 연동), `supabase/schema.sql`.
