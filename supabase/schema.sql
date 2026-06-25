-- ============================================================================
-- 옥외광고 전자견적서 SaaS — Supabase 스키마 (운영 전환용)
-- 블루프린트 §15 + P0 보조 테이블(clients/catalog/settings) + 부록 B 확장 엔티티
-- 그대로 SQL Editor 에서 실행하면 됩니다.
-- ============================================================================

-- 1) 견적 -------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  quote_no text,
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','rejected')),
  supplier jsonb default '{}'::jsonb,
  customer jsonb default '{}'::jsonb,
  site jsonb default '{}'::jsonb,
  items jsonb default '[]'::jsonb,
  constructions jsonb default '[]'::jsonb,
  permits jsonb default '[]'::jsonb,
  etc_costs jsonb default '[]'::jsonb,
  adjustments jsonb default '{}'::jsonb,
  totals jsonb default '{}'::jsonb,
  payment_terms jsonb default '{}'::jsonb,
  validity text,
  notes text,
  dim_unit text,
  customer_response jsonb,
  signature text,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  first_viewed_at timestamptz,
  responded_at timestamptz
);
-- 기존 설치본 업그레이드(재실행 안전): dim_unit 컬럼 보강
alter table public.quotes add column if not exists dim_unit text;

-- 2) 이벤트 -----------------------------------------------------------------
create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null check (event_type in ('created','sent','viewed','accepted','rejected')),
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotes_owner on public.quotes(owner_id);
create index if not exists idx_quotes_token on public.quotes(public_token);
create index if not exists idx_events_quote on public.quote_events(quote_id);

-- 3) 거래처(CRM) ------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text, tel text, addr text, manager text, memo text,
  -- 부록 B 확장
  bizno text, grade text, tags jsonb default '[]'::jsonb,
  contacts jsonb default '[]'::jsonb, history jsonb default '[]'::jsonb,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- 4) 품목·단가 -------------------------------------------------------------
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  type text, grade text, unit text, price numeric, memo text,
  -- 부록 B 확장
  cost numeric, options jsonb default '[]'::jsonb,
  price_tiers jsonb default '[]'::jsonb, taxable boolean default true,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- 5) 설정 -------------------------------------------------------------------
create table if not exists public.settings (
  owner_id uuid primary key references auth.users(id) default auth.uid(),
  supplier jsonb default '{}'::jsonb,
  defaults jsonb default '{}'::jsonb,
  branding jsonb default '{}'::jsonb,
  tax jsonb default '{}'::jsonb,
  numbering jsonb default '{}'::jsonb,
  terms jsonb default '{}'::jsonb,
  discount_rules jsonb default '[]'::jsonb,
  promo_codes jsonb default '[]'::jsonb,
  approval jsonb default '{}'::jsonb,
  cover_letter text,
  units jsonb default '{}'::jsonb,
  menu_hidden jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
-- 기존 설치본 업그레이드(재실행 안전): units / menu_hidden / promo_codes / approval / cover_letter 컬럼 보강
alter table public.settings add column if not exists units jsonb default '{}'::jsonb;
alter table public.settings add column if not exists menu_hidden jsonb default '[]'::jsonb;
alter table public.settings add column if not exists promo_codes jsonb default '[]'::jsonb;
alter table public.settings add column if not exists approval jsonb default '{}'::jsonb;
alter table public.settings add column if not exists cover_letter text;

-- 6) 부록 B 확장 엔티티(P1~P3 기반) -----------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text, memo text, payload jsonb default '{}'::jsonb,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  source text, customer_name text, tel text, memo text,
  stage text default 'new', assignee_id uuid, quote_id uuid references public.quotes(id),
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete cascade,
  terms text, parties jsonb default '[]'::jsonb, status text default 'draft',
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete cascade,
  kind text, amount numeric, due_date date, paid_at timestamptz, paid boolean default false,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, action text, target_type text, target_id uuid, meta jsonb default '{}'::jsonb,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- 6b) 부록 B 확장 엔티티 제네릭 저장소 (앱이 사용하는 단일 테이블) ---------
-- templates/leads/contracts/workorders/payments/invoices/activities/
-- attachments/notifications/comments/versions/team 을 collection 으로 구분 저장.
create table if not exists public.app_collections (
  id uuid primary key default gen_random_uuid(),
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  owner_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_appcoll_owner on public.app_collections(owner_id, collection);

-- 7) RLS --------------------------------------------------------------------
alter table public.app_collections enable row level security;
drop policy if exists "owner_all_appcoll" on public.app_collections;
create policy "owner_all_appcoll" on public.app_collections for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.quotes enable row level security;
alter table public.quote_events enable row level security;
alter table public.clients enable row level security;
alter table public.catalog_items enable row level security;
alter table public.settings enable row level security;
alter table public.templates enable row level security;
alter table public.leads enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.activities enable row level security;

drop policy if exists "owner_select" on public.quotes;
create policy "owner_select" on public.quotes for select using (auth.uid() = owner_id);
drop policy if exists "owner_insert" on public.quotes;
create policy "owner_insert" on public.quotes for insert with check (auth.uid() = owner_id);
drop policy if exists "owner_update" on public.quotes;
create policy "owner_update" on public.quotes for update using (auth.uid() = owner_id);
drop policy if exists "owner_delete" on public.quotes;
create policy "owner_delete" on public.quotes for delete using (auth.uid() = owner_id);
drop policy if exists "owner_events" on public.quote_events;
create policy "owner_events" on public.quote_events for all using (
  exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid()));

-- 공통 owner 정책(보조 테이블)
drop policy if exists "owner_all_clients"   on public.clients;
create policy "owner_all_clients"  on public.clients       for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_catalog"   on public.catalog_items;
create policy "owner_all_catalog"  on public.catalog_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_settings"  on public.settings;
create policy "owner_all_settings" on public.settings      for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_templates" on public.templates;
create policy "owner_all_templates"on public.templates     for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_leads"     on public.leads;
create policy "owner_all_leads"    on public.leads         for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_contracts" on public.contracts;
create policy "owner_all_contracts"on public.contracts     for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_payments"  on public.payments;
create policy "owner_all_payments" on public.payments      for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "owner_all_activity"  on public.activities;
create policy "owner_all_activity" on public.activities    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 8) 고객 열람용(익명, draft 차단) -----------------------------------------
create or replace function public.get_quote_by_token(p_token uuid)
returns public.quotes language sql security definer set search_path = public as $$
  select * from public.quotes where public_token = p_token and status <> 'draft' limit 1;
$$;

-- 9) 열람 기록 -------------------------------------------------------------
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

-- 10) 고객 응답(수락/거절 + 서명) — 익명 허용 -----------------------------
create or replace function public.mark_response(p_token uuid, p_accept boolean, p_name text, p_signature text)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare v_row public.quotes;
begin
  select * into v_row from public.quotes where public_token = p_token and status <> 'draft' limit 1;
  if v_row.id is null then return null; end if;
  update public.quotes set
    status = case when p_accept then 'accepted' else 'rejected' end,
    responded_at = now(),
    customer_response = jsonb_build_object('name', p_name, 'accepted', p_accept, 'at', now()),
    signature = case when p_accept then p_signature else signature end
  where id = v_row.id returning * into v_row;
  insert into public.quote_events(quote_id, event_type, meta)
    values (v_row.id, case when p_accept then 'accepted' else 'rejected' end,
            jsonb_build_object('name', p_name));
  return v_row;
end; $$;

grant execute on function public.get_quote_by_token(uuid) to anon;
grant execute on function public.mark_viewed(uuid) to anon;
grant execute on function public.mark_response(uuid, boolean, text, text) to anon;
