-- 차일드 프로그램은 마더에 로그인되어 있지 않다(별도 주소의 별도 브라우저 창, 스펙 9줄).
-- 따라서 sessions 테이블에 RLS로 직접 접근할 수 없다.
--
-- 대신 세션 토큰을 '능력 토큰(capability token)'으로 삼는다. 마더가 차일드를 열 때
-- URL로 넘긴 (session_id, token) 쌍을 아는 쪽만 아래 두 함수를 통해 자기 세션을
-- 조회하거나 로그를 남길 수 있다. 토큰이 틀리면 아무것도 반환하지 않는다.

-- 세션 상태 조회 — 차일드가 종료 신호를 확인하는 통로 (스펙 11줄)
create or replace function public.session_status(p_session uuid, p_token uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.status
  from public.sessions s
  where s.id = p_session and s.token = p_token;
$$;

-- 차일드가 활동 로그를 남기는 통로 (스펙 7줄 '실시간으로 서로의 작업 내용 확인')
create or replace function public.session_log(p_session uuid, p_token uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions;
begin
  select * into s
  from public.sessions
  where id = p_session and token = p_token and status <> 'closed';

  if not found then
    raise exception '유효하지 않거나 이미 종료된 세션입니다';
  end if;

  insert into public.activity_log (profile_id, program_id, message)
  values (s.profile_id, s.program_id, left(p_message, 500));
end;
$$;

revoke execute on function public.session_status(uuid, uuid) from public;
revoke execute on function public.session_log(uuid, uuid, text) from public;
grant execute on function public.session_status(uuid, uuid) to anon, authenticated;
grant execute on function public.session_log(uuid, uuid, text) to anon, authenticated;
