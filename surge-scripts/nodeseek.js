/*
 * NodeSeek 每日签到脚本 for Surge
 * 原理：MITM 拦截 HTML 页面并注入 JS，在浏览器上下文（已过 Cloudflare）中执行签到
 *
 * 使用方式（Surge 模块）：
 *
 *   [Script]
 *   # 捕获 Cookie + 自动签到（二合一）
 *   http-request ^https?:\/\/(?:www\.)?nodeseek\.com script-path=nodeseek.js, tag=NodeSeek-捕获Cookie
 *   http-response ^https?:\/\/(?:www\.)?nodeseek\.com script-path=nodeseek.js, requires-body=true, tag=NodeSeek-自动签到
 *
 *   [MITM]
 *   hostname = %APPEND% www.nodeseek.com
 *
 * 首次使用：
 *   1. 开启 MITM 并信任证书
 *   2. 打开 https://www.nodeseek.com 并登录
 *   ✅ 之后每次访问 nodeseek.com，页面加载时自动签到，顶部会显示结果横幅
 */

// ================ 配置区 ================
const CONFIG = {
  storageKey: 'nodeseek_cookie',
  signUrl: '/api/attendance?random=false',
};
// ========================================

function main() {
  // 模式判断
  if (typeof $request === 'undefined') {
    // Cron 或面板模式：通知用户访问网站
    $notification.post('🍗 NodeSeek 签到', '打开 nodeseek.com 自动签到', '访问网站时页面加载后会自动执行签到，顶部会显示结果');
    $done();
    return;
  }

  const isResponse = typeof $response !== 'undefined' && $response.status;
  const url = $request.url || '';

  if (!isResponse) {
    // HTTP-REQUEST 模式：捕获 Cookie
    captureCookie();
    return;
  }

  // HTTP-RESPONSE 模式
  const contentType = ($response.headers && (
    $response.headers['Content-Type'] ||
    $response.headers['content-type'] ||
    ''
  )) || '';

  // 只处理 HTML 页面（不处理 API、图片等）
  if (!contentType.includes('text/html')) {
    $done();
    return;
  }

  const body = $response.body;
  if (!body || typeof body !== 'string') {
    $done();
    return;
  }

  // 注入签到脚本
  const injectedScript = [
    '(function(){',
    'var k="ns_signed_today";',
    'if(localStorage.getItem(k))return;',          // 每天只签一次
    'var d=document;',
    'fetch("' + CONFIG.signUrl + '",{',
    '  method:"POST",',
    '  credentials:"include",',
    '  headers:{"Content-Type":"application/x-www-form-urlencoded"}',
    '})',
    '.then(function(r){return r.json()})',
    '.then(function(j){',
    '  localStorage.setItem(k,"1");',
    '  var msg=j.message||(j.success?"成功":"失败");',
    '  var ok=j.success===true;',
    '  var c=d.createElement("div");',
    '  c.style.cssText="position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px 20px;text-align:center;font-size:15px;font-weight:bold;'+'background:"+(ok?"#4CAF50":"#f44336")+";color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.2)";',
    '  c.textContent=(ok?"✅ NodeSeek 签到成功: ":"❌ 签到失败: ")+msg;',
    '  d.body.appendChild(c);',
    '  setTimeout(function(){c.remove()},6000);',
    '})',
    '.catch(function(e){',
    '  var c=d.createElement("div");',
    '  c.style.cssText="position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px 20px;text-align:center;font-size:15px;font-weight:bold;background:#f44336;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.2)";',
    '  c.textContent="❌ 签到请求失败: "+e.message;',
    '  d.body.appendChild(c);',
    '  setTimeout(function(){c.remove()},6000);',
    '});',
    '})();',
  ].join('');

  const newBody = body.replace(
    /<\/body>/i,
    `<script>${injectedScript}</script></body>`
  );

  if (newBody === body) {
    // 没找到 </body>，追加到末尾
    $done({ body: body + `<script>${injectedScript}</script>` });
  } else {
    $done({ body: newBody });
  }
}

/**
 * MITM 捕获 Cookie：从请求头中提取 Cookie 并持久化存储
 */
function captureCookie() {
  const cookie = $request.headers['Cookie'] || $request.headers['cookie'];
  if (!cookie) {
    $done();
    return;
  }

  const oldCookie = $persistentStore.read(CONFIG.storageKey);
  if (cookie === oldCookie) {
    $done();
    return;
  }

  $persistentStore.write(cookie, CONFIG.storageKey);
  $notification.post(
    '✅ NodeSeek Cookie 已更新',
    '',
    '下次访问 nodeseek.com 时将自动签到'
  );
  $done();
}

main();
