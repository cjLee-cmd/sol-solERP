// 차일드 프로그램이 한 줄로 불러다 쓰는 연동 SDK.
//
//   <script src="https://<마더주소>/solerp-child.js"></script>
//
// 정적 파일이 아니라 라우트 핸들러인 이유: Supabase 접속 정보를 배포 환경에서
// 주입해야 하기 때문. publishable 키는 브라우저에 공개되도록 설계된 키다.

const POLL_MS = 3000

function sdk(url: string, key: string) {
  return `(() => {
  'use strict';
  var SUPABASE_URL = ${JSON.stringify(url)};
  var SUPABASE_KEY = ${JSON.stringify(key)};
  var POLL_MS = ${POLL_MS};

  var params = new URLSearchParams(location.search);
  var session = params.get('solerp_session');
  var token = params.get('solerp_token');

  function rpc(fn, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('[solERP] ' + fn + ' 실패: ' + res.status);
      return res.status === 204 ? null : res.json();
    });
  }

  if (!session || !token) {
    console.warn('[solERP] 세션 파라미터가 없습니다. 마더 프로그램을 통해 열어주세요.');
    window.SolERP = { session: null, connected: false, log: function () { return Promise.resolve(); } };
    return;
  }

  function overlay() {
    if (document.getElementById('solerp-closed')) return;
    var el = document.createElement('div');
    el.id = 'solerp-closed';
    el.setAttribute('role', 'alertdialog');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:10px;background:rgba(30,27,29,.72);' +
      'backdrop-filter:blur(8px);color:#fff;font:400 14px -apple-system,BlinkMacSystemFont,system-ui,sans-serif';
    el.innerHTML = '<div style="font-weight:700;font-size:17px">연결이 종료되었습니다</div>' +
      '<div style="opacity:.75;font-size:12.5px">마더 프로그램에서 이 프로그램의 연결을 끊었습니다. 창을 닫아주세요.</div>';
    document.body.appendChild(el);
  }

  var stopped = false;
  function shutdown() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    window.SolERP.connected = false;
    window.close();                     // 마더가 window.open 으로 연 창이면 닫힌다
    setTimeout(overlay, 150);           // 브라우저가 막으면 오버레이로 대체
  }

  function check() {
    return rpc('session_status', { p_session: session, p_token: token })
      .then(function (status) {
        // null = 세션이 없거나 토큰 불일치 → 유효하지 않으므로 종료로 간주
        if (status === 'closed' || status === null) shutdown();
      })
      .catch(function () { /* 네트워크 일시 장애는 무시하고 다음 주기에 재시도 */ });
  }

  // 로드되자마자 마더에 "떴다"고 알린다 → 마더의 '연결 중'이 '연결됨'으로 바뀐다
  var timer = setInterval(check, POLL_MS);
  rpc('session_ack', { p_session: session, p_token: token })
    .then(function (status) {
      if (status === 'closed' || status === null) shutdown();
    })
    .catch(function () { return check(); });

  window.SolERP = {
    session: session,
    connected: true,
    log: function (message) {
      return rpc('session_log', { p_session: session, p_token: token, p_message: String(message) });
    }
  };
})();
`
}

export async function GET() {
  const body = sdk(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // 차일드는 다른 오리진에서 로드한다
      'Access-Control-Allow-Origin': '*',
      // 차일드 팀들이 물고 가는 계약 파일이라 캐시된 옛 버전이 돌아다니면 안 된다.
      // (개발 중 실제로 이것 때문에 ack 가 누락됐다.)
      'Cache-Control': 'no-cache',
    },
  })
}
