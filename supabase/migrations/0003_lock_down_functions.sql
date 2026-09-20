-- SECURITY DEFINER 함수가 REST RPC(/rest/v1/rpc/...)로 노출되지 않게 차단.
-- 트리거 함수는 EXECUTE 권한을 회수해도 트리거로는 정상 동작한다
-- (Postgres는 트리거 실행 시 호출자의 EXECUTE 권한을 검사하지 않음).

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_escalation() from public, anon, authenticated;

-- is_master()는 RLS 정책 안에서 평가되므로 authenticated 에게는 필요하다.
revoke execute on function public.is_master() from public, anon;
grant execute on function public.is_master() to authenticated;
