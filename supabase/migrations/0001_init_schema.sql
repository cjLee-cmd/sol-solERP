-- solERP 마더 프로그램 — 초기 스키마
-- 스펙: 01_Design/test_Design.md (11, 14, 26줄)

-- ─────────────────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'sub' check (role in ('master', 'sub')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is '사용자 프로필. 권한은 Master/Sub, 기본값 sub (스펙 26줄)';

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ko text not null,
  url text not null,
  embed_mode text not null default 'window' check (embed_mode in ('iframe', 'window')),
  accent_token text not null default 'var(--color-accent)',
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.programs is '차일드 프로그램 등록부. embed_mode는 frame-ancestors 판정 결과';

create table public.program_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  primary key (profile_id, program_id)
);
comment on table public.program_access is 'Sub 사용자에게 허용된 프로그램. Master는 이 표와 무관하게 전체 열람';

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  status text not null default 'connecting' check (status in ('connecting', 'connected', 'closed')),
  token uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
comment on table public.sessions is '마더-차일드 연결. status=closed 가 차일드 종료 신호 (스펙 11줄)';

create table public.activity_log (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);
comment on table public.activity_log is '실시간 활동 로그 (스펙 7줄)';

create index programs_sort_order_idx on public.programs (sort_order);
create index sessions_profile_status_idx on public.sessions (profile_id, status);
create index activity_log_created_at_idx on public.activity_log (created_at desc);

-- ─────────────────────────────────────────────────────────
-- 헬퍼 — RLS 정책에서 재귀를 피하려면 security definer 여야 함
-- ─────────────────────────────────────────────────────────

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'master'
  );
$$;

-- 가입 시 프로필 자동 생성 (기본 권한 sub)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 본인이 스스로 Master로 승격하는 것을 차단 (스펙 26줄 '승격은 Master가 지정')
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_master() then
    raise exception '권한 변경은 Master만 가능합니다';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ─────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.programs       enable row level security;
alter table public.program_access enable row level security;
alter table public.sessions       enable row level security;
alter table public.activity_log   enable row level security;

-- profiles: 본인 행 read/update. Master는 전체 read/update (role 지정)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_master());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_master())
  with check (id = (select auth.uid()) or public.is_master());

-- programs: Master는 전체, Sub는 program_access 로 허용된 것만
create policy programs_select on public.programs for select to authenticated
  using (
    public.is_master()
    or (
      enabled
      and exists (
        select 1 from public.program_access pa
        where pa.program_id = programs.id and pa.profile_id = (select auth.uid())
      )
    )
  );
create policy programs_insert on public.programs for insert to authenticated
  with check (public.is_master());
create policy programs_update on public.programs for update to authenticated
  using (public.is_master()) with check (public.is_master());
create policy programs_delete on public.programs for delete to authenticated
  using (public.is_master());

-- program_access: 본인 행 read, 쓰기는 Master만
create policy program_access_select on public.program_access for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_master());
create policy program_access_insert on public.program_access for insert to authenticated
  with check (public.is_master());
create policy program_access_delete on public.program_access for delete to authenticated
  using (public.is_master());

-- sessions: 본인 세션 read/write. Master는 전체 read + 강제 종료 (스펙 2f)
create policy sessions_select on public.sessions for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_master());
create policy sessions_insert on public.sessions for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy sessions_update on public.sessions for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_master())
  with check (profile_id = (select auth.uid()) or public.is_master());

-- activity_log: Master는 전체, Sub는 본인 것만 (스펙 2f '본인 활동 로그만')
create policy activity_log_select on public.activity_log for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_master());
create policy activity_log_insert on public.activity_log for insert to authenticated
  with check (profile_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.activity_log;
