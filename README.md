# solERP 마더 프로그램 (Mother SW v1)

여러 도메인 프로그램(차일드)을 연결하는 허브 소프트웨어입니다.
요구사항 출처: `../01_Design/test_Design.md`

**배포: https://solerp-hub.vercel.app** → 도메인 정리 후 **https://hub.solideos.com**

## 도메인 전환 (진행 중)

차일드를 메인 창 iframe으로 띄우려면 마더와 차일드가 **같은 등록 도메인** 아래 있어야
합니다. `*.vercel.app`은 Public Suffix라 서브도메인끼리 서로 남남 사이트 취급이라,
차일드의 `SameSite=Lax` 세션 쿠키가 iframe 안에서 전송되지 않습니다.

목표 구조 (solideos.com은 회사 소유 확인됨 · solideo.app은 회사 소유가 아님):

```
hub.solideos.com   ← solERP 마더
insa.solideos.com  ← INSA Flow
...
```

### 완료된 것

- [x] Vercel `solerp-hub` 프로젝트에 `hub.solideos.com` 등록 (DNS 대기)
- [x] Supabase Auth: site_url = `https://hub.solideos.com`,
      허용 목록에 localhost · vercel.app · hub.solideos.com 모두 등록

### 남은 것 — DNS 관리자 (solideos.com, whoisdomain.kr)

레코드 2개 추가:

```
A     hub.solideos.com   76.76.21.21
CNAME insa.solideos.com  cname.vercel-dns.com
```

### 남은 것 — INSA Flow 담당 (eastpoet0405 Vercel 계정)

1. Vercel 프로젝트 → Settings → Domains 에 `insa.solideos.com` 추가
2. 코드 수정 불필요 — `SameSite=Lax` 쿠키가 같은 사이트가 되면서 그대로 동작
3. (선택) 이후 `X-Frame-Options`를 켠다면 대신
   `Content-Security-Policy: frame-ancestors https://hub.solideos.com` 사용
   — 같은 사이트여도 오리진은 달라서 `SAMEORIGIN`은 마더의 iframe을 차단합니다

### DNS 반영 후 마지막 단계

- solERP 환경설정에서 INSA Flow URL을 `https://insa.solideos.com`으로 변경 (✎ 버튼)
- `https://hub.solideos.com`에서 로그인 → INSA Flow 연결 → iframe 안 로그인 확인

## 배포

Vercel CLI로 배포합니다. 프로젝트는 `1234s-projects-dfa77a26/solerp-hub`에 연결되어 있습니다.

```bash
vercel deploy --prod
```

환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)는
Production·Development에 등록되어 있습니다. Preview 환경은 비어 있습니다 — CLI 50.x가
비대화형 등록을 지원하지 않아서이고, git 저장소가 아니라 브랜치 preview가 생기지 않으므로
당장은 문제되지 않습니다. git 연동을 붙일 때 채워야 합니다.

`MOCK Window` / `MOCK Frame`은 개발용 픽스처라 배포본에서 꺼져 있습니다(`enabled=false`).
로컬에서 다시 쓰려면 환경설정에서 켜세요.

## 실행

```bash
npm run dev
```

`.env.example`을 `.env.local`로 복사한 뒤 Supabase 값을 채워야 합니다.

와이어프레임을 참조용으로 띄우려면:

```bash
python3 -m http.server 5173 --directory design
```

## 구조

| 경로 | 설명 |
| --- | --- |
| `src/app/` | Next.js App Router |
| `src/proxy.ts` | 세션 갱신 + 보호 라우트 (Next.js 16에서 `middleware.ts`가 `proxy.ts`로 바뀜) |
| `src/lib/supabase/` | `@supabase/ssr` 클라이언트 — browser / server / proxy |
| `src/components/` | 공용 컴포넌트 |
| `src/styles/tokens.css` | Modernist 디자인 시스템 토큰 (와이어프레임 원본 그대로) |
| `public/` | 정적 자산 |
| `supabase/migrations/` | 스키마 마이그레이션 |
| `supabase/seed_dev_users.sql` | 개발용 테스트 계정 (운영 적용 금지) |
| `public/dev/mock-child.html` | 연결 검증용 목 차일드 (테스트 픽스처, 제품 아님) |
| `design/` | **와이어프레임 원본** — 7개 화면 참조용, 편집하지 않음 |

`design/index.html`은 구현 이전 단계의 와이어프레임입니다. 화면 ID(2a~2g)는 아래 표를 따릅니다.

| ID | 화면 |
| --- | --- |
| 2a | 통합 툴바 · 자동 슬라이드 사이드바 · 허브 워크스페이스 |
| 2g | 허브 아이들 — 선택된 프로그램 없음 |
| 2b | 로그아웃 상태 + 로그인 시트 |
| 2c | 연결 중 → 연결됨 |
| 2d | 환경설정 — 프로그램 연결 |
| 2e | 연결 끊기 확인 얼럿 |
| 2f | 권한 차이 — Master vs Sub |

## 사이드바 레일

핀으로 고정했거나 마우스가 올라가면 펼쳐지고(212px), 아니면 48px 거터로 접힙니다.
접힘 상태에서는 라벨만 페이드아웃하고 내부 폭은 212px로 고정되어 있어 전환 중 내용이
리플로우되지 않습니다. 와이어프레임 `design/app.js`의 동작을 그대로 옮긴 것입니다.

## 활동 로그 (스펙 7줄)

화면 하단 상태바에 최신 활동 1건이 뜨고, '전체 로그 ›'로 전체 목록을 엽니다.
`activity_log`를 Realtime으로 구독하므로 다른 프로그램·다른 사용자의 활동이
새로고침 없이 올라옵니다.

**Realtime에도 RLS가 적용됩니다.** Master는 전체 로그를, Sub는 본인 것만 받습니다.
(Master가 남긴 로그를 Sub 화면에서 실시간 수신하지 않는 것까지 확인했습니다.)

와이어프레임 2g(아이들)에는 상태바가 없지만, 활동 피드는 연결 여부와 무관하게
유효해서 항상 표시합니다.

## 환경설정 (Master 전용)

타이틀바의 ⚙ 버튼으로 엽니다. **프로그램 연결** 탭에서 차일드 프로그램을 등록·편집합니다.

- **연결 테스트** — 대상 URL을 서버에서 실제로 호출해 응답하는지 확인합니다. 차일드의
  `X-Frame-Options`·CSP `frame-ancestors`는 중계가 걷어내므로(아래 참고) 판정에 쓰지 않습니다.
- **✎ 편집** — 행이 폼으로 펼쳐져 영문/한글 제목, URL, 실행 모드를 그 자리에서 고칩니다.
  편집 중에도 연결 테스트를 돌릴 수 있고, 결과에 따라 실행 모드가 자동으로 맞춰집니다.
  바뀐 값이 없으면 저장 버튼이 비활성이고, 취소하면 변경이 버려집니다.
- **on/off 토글** — 끄면 사이드바에서 사라지고 목록에는 남습니다
- **↑ ↓** — 순서 변경. 와이어프레임은 드래그 핸들이지만 버튼으로 구현했습니다
  (키보드로도 쓸 수 있고 검증도 쉬워서)

`일반` 외 나머지 탭은 스펙 25줄("환경설정 내용은 추후 추가")에 따라 자리만 잡아뒀습니다.
Sub는 `일반` 탭만 보이고, 서버 액션을 직접 호출하더라도 RLS(`is_master()`)가 막습니다.

## 차일드 프로그램 연동 (SDK 계약)

차일드 프로그램은 스크립트 한 줄만 넣으면 됩니다.

```html
<script src="https://<마더주소>/solerp-child.js"></script>
```

마더가 차일드를 열 때 URL에 `solerp_session`과 `solerp_token`을 붙입니다. SDK가 이 둘을 읽어:

- 로드 직후 **ack** — 마더의 '연결 중'이 '연결됨'으로 바뀝니다
- 3초마다 세션 상태 확인 — `closed`가 되면 `window.close()`, 브라우저가 막으면 종료 오버레이
- `SolERP.log('메시지')` — 마더 활동 로그에 기록 (`SolERP.session`, `SolERP.connected`도 제공)

`solerp-child.js`는 정적 파일이 아니라 라우트 핸들러라 배포 환경의 Supabase 접속 정보가
주입됩니다. 차일드 팀이 물고 가는 계약 파일이므로 `Cache-Control: no-cache`입니다.

### SDK 없이도 연결은 된다

SDK는 **선택**입니다. 넣지 않아도 연결·표시는 정상 동작합니다.

| 기능 | SDK 없이 | SDK 넣으면 |
| --- | --- | --- |
| 연결 / 탭 표시 | ✓ | ✓ |
| 연결 끊기 (새 창) | ✓ 마더가 창 핸들로 닫음 | ✓ |
| 연결 끊기 (마더 새로고침 후) | ✗ 창이 남음 | ✓ 차일드가 스스로 닫음 |
| 활동 로그 남기기 | ✗ | ✓ |

### 모든 차일드는 메인 창 안(iframe)에서 뜬다

프로그램 카드를 누르면 새 창이 아니라 **메인 창 안**에 뜹니다. `programs.embed_mode`
기본값도 `iframe`이고, '새 창'은 수동 예외로만 남겨두었습니다(환경설정 ✎에서 변경).

차일드가 보내는 `X-Frame-Options`와 CSP `frame-ancestors`는 **중계 단계에서 제거**합니다.
차일드는 마더 오리진의 `/x/...`로 서빙되므로 "누가 프레임에 넣을 수 있는가"는 마더가 정할
일이고, 그대로 두면 마더 자신의 iframe이 막힙니다(TRAVEL이 `frame-ancestors 'none'`을 보내
"연결이 안 된다"고 나온 원인). CSP의 나머지 지시어는 그대로 유지합니다.

### 동일 오리진 중계 (`/x/<program-id>/...`)

iframe 모드 차일드는 원래 주소가 아니라 **마더의 중계 경로**로 띄웁니다.
[src/app/x/[program]/[[...path]]/route.ts](src/app/x/[program]/[[...path]]/route.ts)

브라우저 입장에서 차일드가 마더와 같은 오리진이 되므로, 차일드의 `SameSite=Lax` 세션
쿠키가 1st-party가 되어 **차일드 코드 수정 없이** iframe 안 로그인이 동작합니다.
Safari·Firefox처럼 서드파티 쿠키를 막는 브라우저에서도 마찬가지입니다.

중계가 하는 일:

- 차일드 응답의 절대경로(`/_next/`, `/api/`, `/icon.svg`)를 `/x/<id>/...`로 재작성
- `Location` 헤더를 중계 경로로 변환
- `Set-Cookie`의 이름에 `cx_<id축약>_` 접두사를 붙이고 `Path`를 `/x/<id>`로 좁힘
- 업스트림에 보내는 `Origin`/`Referer`를 차일드 프론트 자신의 주소로 바꿈(마더 주소가
  그대로 가면 자기 주소만 허용하는 백엔드에 걸림)
- **별도 백엔드 중계** — 차일드가 프론트와 다른 오리진의 API를 부르고 그 API가 Origin을
  검사하면(TRAVEL: `east.tailcd3906.ts.net`, preflight 400 + `403 origin_rejected`),
  `route.ts`의 `API_ORIGINS`에 `프론트 오리진 → 백엔드 오리진`을 등록합니다. JS 안의
  백엔드 주소가 `/x/<id>/__api`로 재작성되어 API 호출도 같은 오리진이 되고, 중계가
  차일드 Origin으로 백엔드에 전달합니다. 백엔드 응답은 데이터라 재작성하지 않습니다.
  호스트를 경로로 받지 않는 건 열린 프록시가 되지 않게 하기 위해서입니다.
- **런타임 절대경로 되돌리기** ([src/proxy.ts](src/proxy.ts)) — 템플릿 리터럴·문자열
  결합으로 런타임에 만든 루트 절대경로(INSA Flow `/demo/staff/f30-01.webp` 사진,
  `/api/...` 호출)는 본문 재작성이 잡지 못해 마더 오리진으로 요청됩니다. 마더에 없는
  경로인데 `Referer`가 `/x/<id>/...`이면 그 프로그램의 중계 경로로 rewrite 합니다.
  이 때문에 matcher가 정적 확장자도 거치며, 정적 파일은 `updateSession`에서 공개 처리합니다.

**쿠키 격리** — 원본 `Cookie` 헤더는 절대 전달하지 않고, 위 접두사가 붙은 차일드
쿠키만 원래 이름으로 되돌려 보냅니다. 마더의 Supabase 세션 쿠키가 차일드로 새지
않는 것을 에코 엔드포인트로 실증했습니다(브라우저→마더 `sb-*-auth-token` 전송,
차일드 수신 쿠키 `(없음)`). 중계 경로 자체도 로그인해야 접근할 수 있고, RLS로
볼 수 없는 프로그램은 404입니다.

**이건 임시 다리입니다.** `hub.solideos.com` / `insa.solideos.com`으로 도메인이
정리되면 중계 없이도 동작하므로, 그때 `childSrc()`에서 iframe 분기를 지우면 됩니다.

### 차일드 세션 쿠키는 iframe에서 살아남아야 한다 (배경)

마더는 차일드를 **메인 창 안 iframe**으로 띄웁니다. 이때 차일드가 로그인 세션을
`SameSite=Lax` 쿠키에 담으면 **브라우저가 그 쿠키를 교차 사이트 iframe 요청에 실어주지
않습니다.** 결과적으로 iframe 안에서 로그인해도 세션이 안 붙어 로그인 화면으로 되돌아옵니다.
마더 쪽에서는 우회할 수 없는 브라우저 정책입니다.

`X-Frame-Options`가 없어서 '연결 테스트'가 "임베드 가능"이라고 해도 마찬가지입니다 —
**프레임에 넣을 수 있는 것과 그 안에서 로그인이 유지되는 것은 별개**입니다.

해결책은 둘 중 하나입니다.

**① 차일드에서 쿠키 속성 변경 (한 줄, 즉시 적용 가능)**

```ts
// 차일드의 로그인 응답
cookies().set('세션쿠키', value, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',   // ← Lax 이면 iframe 안에서 로그인이 안 됩니다
  path: '/',
})
```

**② 마더와 차일드를 같은 등록 도메인 아래 두기 (근본 해결)**

`hub.solideo.app` + `insa.solideo.app` 처럼 같은 `solideo.app` 아래면 교차 사이트가 아니라
`SameSite=Lax` 그대로도 정상 동작합니다. Safari(ITP)나 서드파티 쿠키를 끈 브라우저에서는
①이 막힐 수 있으므로 최종적으로는 ②를 권합니다.

### 차일드는 로그인하지 않는다

차일드는 별도 주소의 별도 창에서 도는 남남입니다(스펙 9줄). 그래서 `sessions` 테이블에
RLS로 접근할 수 없고, 대신 **세션 토큰을 능력 토큰(capability token)으로** 씁니다.
`session_ack` / `session_status` / `session_log` 세 함수는 `(session_id, token)` 쌍이
맞을 때만 동작하고, 틀리면 `null`을 돌려주거나 예외를 냅니다.

## 연결 끊기가 동작하는 방식 (스펙 11줄)

두 겹입니다.

1. 마더가 `window.open`으로 연 창이면 **핸들로 즉시 닫습니다**
2. 동시에 세션을 `closed`로 바꿉니다 → 차일드 SDK가 감지해 **스스로 닫습니다**

2번이 있어서 마더를 새로고침해 핸들을 잃은 뒤에도, 사용자가 URL로 직접 연 창에서도
종료가 동작합니다. 최대 지연은 3초(SDK 폴링 주기)입니다.

## 데이터 모델

| 테이블 | 역할 |
| --- | --- |
| `profiles` | 사용자 · 권한(`master`/`sub`, 기본 `sub`) |
| `programs` | 차일드 프로그램 등록부 |
| `program_access` | Sub에게 허용된 프로그램 |
| `sessions` | 마더-차일드 연결. `status='closed'`가 종료 신호 |
| `activity_log` | 실시간 활동 로그 |

RLS 요지 — Master는 전체 열람/편집, Sub는 `program_access`로 허용된 프로그램과 본인 세션·로그만.
권한 변경은 `prevent_role_escalation` 트리거가 막고, 최초 Master만 백엔드(service_role)에서 지정할 수 있습니다.

## 인증

`@supabase/ssr` 기반이며 인증 검사는 **`getClaims()`**를 씁니다. `getSession()`은 서버 코드에서
토큰 재검증을 보장하지 않으므로 쓰지 않습니다. `src/lib/supabase/proxy.ts`에서
`createServerClient`와 `getClaims()` 사이에 코드를 넣으면 무작위 로그아웃이 발생하니 주의하세요.

### 알려진 린터 경고

전부 의도된 설정입니다.

- `is_master()` — RLS 정책 안에서 평가되어야 하므로 `authenticated`에게 열려 있어야 합니다.
  호출자 본인이 Master인지만 반환합니다.
- `session_ack` / `session_status` / `session_log` — 차일드가 비로그인 상태로 호출해야 하므로
  `anon`에게 열려 있습니다. 유효한 `(session_id, token)` 쌍이 없으면 아무것도 하지 않습니다.
- `Leaked Password Protection Disabled` — 아직 켜지 않았습니다. Supabase 대시보드에서
  켜면 HaveIBeenPwned 대조로 유출된 비밀번호를 막습니다. (켜면 개발용 계정 비밀번호를
  바꿔야 할 수 있습니다.)

## 개발용 계정

`supabase/seed_dev_users.sql`로 생성됩니다. 비밀번호는 둘 다 `solERP-dev-2026!`.

| 이메일 | 이름 | 권한 | 보이는 프로그램 |
| --- | --- | --- | --- |
| `master@solideo.local` | 김솔데 | Master | 7개 전체 |
| `sub@solideo.local` | 이사원 | Sub | INSA Flow, Nara Finder |
