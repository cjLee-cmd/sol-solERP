-- 모든 차일드 프로그램을 메인 창 안(iframe)에서 띄운다.
--
-- 마더의 동일 오리진 중계(/x/<program-id>/...)가 붙은 뒤로는 교차 사이트 쿠키
-- 문제가 사라져 iframe 이 기본 동작이 되어야 맞다. '새 창'은 X-Frame-Options: DENY
-- 처럼 임베드가 전면 차단된 사이트를 위한 수동 예외로만 남긴다.

alter table public.programs alter column embed_mode set default 'iframe';

update public.programs set embed_mode = 'iframe' where embed_mode <> 'iframe';
