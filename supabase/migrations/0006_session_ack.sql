-- 차일드가 "떴다"고 알리는 통로.
--
-- 마더는 차일드가 언제 실제로 로드됐는지 알 수 없다. 새 창은 교차 출처라 관측이
-- 불가능하고, iframe 의 load 이벤트는 리스너가 붙기 전에 끝나면 놓친다.
-- 그래서 차일드 SDK 가 직접 ack 하고, 마더는 Realtime 으로 그 변화를 받는다.
-- iframe/새 창 두 모드가 같은 경로를 쓴다.

create or replace function public.session_ack(p_session uuid, p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions;
begin
  select * into s from public.sessions
  where id = p_session and token = p_token;

  if not found then
    return null;
  end if;

  if s.status = 'connecting' then
    update public.sessions set status = 'connected' where id = p_session
    returning status into s.status;
  end if;

  return s.status;
end;
$$;

revoke execute on function public.session_ack(uuid, uuid) from public;
grant execute on function public.session_ack(uuid, uuid) to anon, authenticated;
