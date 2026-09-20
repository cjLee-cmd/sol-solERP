-- 개발용 테스트 계정. 마이그레이션이 아니므로 운영 DB에 적용하지 마세요.
-- master@solideo.local / sub@solideo.local — 비밀번호 solERP-dev-2026!
-- .local 도메인이라 확인 메일이 실제로 발송되지 않고, email_confirmed_at 을 직접 채워 확인 완료 상태로 만듭니다.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'master@solideo.local', extensions.crypt('solERP-dev-2026!', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"김솔데"}', '', '', '', ''),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sub@solideo.local', extensions.crypt('solERP-dev-2026!', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"이사원"}', '', '', '', '');

-- 최초 Master 지정 (0004 부트스트랩 경로)
update public.profiles set role = 'master'
where id = (select id from auth.users where email = 'master@solideo.local');

-- Sub에게 2개만 허용 — 권한 차이를 눈으로 확인하기 위한 설정
insert into public.program_access (profile_id, program_id)
select (select id from auth.users where email = 'sub@solideo.local'), p.id
from public.programs p
where p.name_en in ('INSA Flow', 'Nara Finder');
