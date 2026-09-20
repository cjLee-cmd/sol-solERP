-- 0001의 prevent_role_escalation 은 최초 Master 지정까지 막아버린다
-- (Master가 없으면 아무도 Master를 만들 수 없는 닭-달걀 문제).
--
-- auth.uid() 가 null 이면 사용자 JWT 없이 들어온 백엔드 컨텍스트
-- (service_role / DB 관리자)이므로 통과시킨다. anon 은 profiles RLS 정책이
-- 전부 `to authenticated` 라 애초에 이 UPDATE 에 도달하지 못한다.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if (select auth.uid()) is null then
      return new;  -- 백엔드에서의 권한 지정 (최초 Master 부트스트랩 포함)
    end if;
    if not public.is_master() then
      raise exception '권한 변경은 Master만 가능합니다';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_role_escalation() from public, anon, authenticated;
