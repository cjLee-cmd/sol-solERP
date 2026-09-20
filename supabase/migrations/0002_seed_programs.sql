-- 초기 차일드 프로그램 7개 (스펙 15–21줄)
-- accent_token 순서는 와이어프레임 사이드바 색 순서를 그대로 따름

insert into public.programs (name_en, name_ko, url, accent_token, sort_order) values
  ('INSA Flow',       '인사관리',                  'https://insa.solideo.app',     'var(--color-accent)',      1),
  ('Finance Flow',    '재무관리',                  'https://finance.solideo.app',  'var(--color-accent-500)',  2),
  ('Nara Finder',     '나라장터 입찰/개찰 자동화', 'https://nara.solideo.app',     'var(--color-accent-600)',  3),
  ('CREATIVE STUDIO', '콘텐츠제작',                'https://studio.solideo.app',   'var(--color-accent-400)',  4),
  ('GAME',            '장돌배기',                  'https://game.solideo.app',     'var(--color-neutral-700)', 5),
  ('TRAVEL',          'KTX 자동예약',              'https://travel.solideo.app',   'var(--color-neutral-500)', 6),
  ('SECURITY',        '보안 규정 질의',            'https://security.solideo.app', 'var(--color-neutral-600)', 7);
