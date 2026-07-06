/*
 * NodeSeek 每日签到脚本 for Surge
 * 功能：捕获 Cookie → 定时签到领鸡腿 → 推送结果
 *
 * 使用方式（Surge 配置）：
 *
 *   [Script]
 *   # 1) MITM 捕获 Cookie — 当访问 nodeseek.com 任意页面时自动保存 Cookie
 *   http-request ^https?:\/\/(?:www\.)?nodeseek\.com script-path=surge-scripts/nodeseek.js, tag=NodeSeek-捕获Cookie
 *
 *   # 2) 定时签到 — 每天 8:00 自动执行
 *   cron "0 8 * * *" script-path=surge-scripts/nodeseek.js, tag=NodeSeek-每日签到
 *
 *   # 3) 面板按钮（可选）— 在 Surge 面板点击手动触发签到
 *   script-path=surge-scripts/nodeseek.js, tag=NodeSeek-手动签到
 *
 *   [MITM]
 *   hostname = %APPEND% www.nodeseek.com
 *
 * 首次使用：
 *   1. 先启用 MITM 并信任证书
 *   2. 在浏览器中打开 https://www.nodeseek.com 并登录
 *   3. 脚本会自动捕获并保存 Cookie（通知提示 "Cookie 已捕获"）
 *   4. 之后每天定时自动签到
 *   5. 如果 Cookie 过期，重新登录即可自动更新
 *
 * 可选配置（在脚本顶部的 CONFIG 区域修改）：
 *   - memberId: 填写你的用户 ID（从个人空间 URL 获取，如 /space/12345），填了会额外显示鸡腿余额
 */

// ================ 配置区 ================
const CONFIG = {
  memberId: '',               // 可选：你的用户 ID，如 '12345'
  signUrl: 'https://www.nodeseek.com/api/attendance?random=false',
  infoUrl: 'https://www.nodeseek.com/api/account/getInfo/',
  storageKey: 'nodeseek_cookie',
  memberKey: 'nodeseek_member_id',
};
// ========================================

async function main() {
  // 判断触发方式
  if (typeof $request !== 'undefined' && typeof $response === 'undefined') {
    // 模式 1: http-request — 捕获 Cookie
    await captureCookie();
  } else if (typeof $trigger !== 'undefined') {
    // 模式 2: cron 定时触发 — 执行签到
    await doSignIn();
  } else {
    // 模式 3: 面板手动触发 — 执行签到并显示状态
    await doSignIn();
  }
  $done();
}

/**
 * MITM 捕获 Cookie：从请求头中提取 Cookie 并持久化存储
 */
async function captureCookie() {
  const cookie = $request.headers['Cookie'] || $request.headers['cookie'];
  if (!cookie) {
    console.log('[NodeSeek] 请求中未发现 Cookie');
    $done();
    return;
  }

  // 如果和已存储的相同则跳过通知
  const oldCookie = $persistentStore.read(CONFIG.storageKey);
  if (cookie === oldCookie) {
    console.log('[NodeSeek] Cookie 未变化，跳过更新');
    $done();
    return;
  }

  $persistentStore.write(cookie, CONFIG.storageKey);
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`[NodeSeek] Cookie 已捕获更新 (${now})`);

  // 尝试从 Cookie 中提取 member_id（如果有 k_user_id 之类的字段）
  extractMemberIdFromCookie(cookie);

  $notification.post(
    '✅ NodeSeek Cookie 已更新',
    `捕获时间: ${now}`,
    `Cookie: ${cookie.substring(0, 40)}...`
  );
  $done();
}

/**
 * 尝试从 Cookie 中自动提取用户 ID
 */
function extractMemberIdFromCookie(cookie) {
  // 常见论坛 Cookie 中可能包含 member_id / user_id 等字段
  const patterns = [/member_id[=:](\d+)/i, /user_id[=:](\d+)/i, /uid[=:](\d+)/i, /k_user_id[=:](\d+)/i];
  for (const p of patterns) {
    const m = cookie.match(p);
    if (m && m[1]) {
      $persistentStore.write(m[1], CONFIG.memberKey);
      console.log(`[NodeSeek] 自动提取 memberId: ${m[1]}`);
      return m[1];
    }
  }
  return null;
}

/**
 * 执行签到操作
 */
async function doSignIn() {
  const cookie = $persistentStore.read(CONFIG.storageKey);
  if (!cookie) {
    $notification.post(
      '❌ NodeSeek 签到失败',
      'Cookie 未捕获',
      '请先在浏览器中登录 nodeseek.com，脚本会自动捕获 Cookie'
    );
    return;
  }

  // 1. 执行签到
  const signResult = await signInRequest(cookie);
  if (!signResult) return; // 网络错误等已在函数内通知

  // 2. 尝试获取用户信息（如果配置了 memberId 或自动提取到了）
  let userInfo = '';
  const memberId = CONFIG.memberId || $persistentStore.read(CONFIG.memberKey) || '';
  if (memberId) {
    userInfo = await getUserInfo(cookie, memberId);
  }

  // 3. 组装通知内容
  const title = signResult.success ? '✅ NodeSeek 签到成功' : 'ℹ️ NodeSeek 签到';
  let subtitle = signResult.message || '';
  let body = userInfo || '';

  // 如果签到成功且有鸡腿数信息
  if (signResult.success && signResult.data) {
    const detail = parseSignReward(signResult.data);
    if (detail) subtitle = subtitle || detail;
  }

  if (!body && !subtitle) {
    subtitle = '签到已完成（无详细消息）';
  }

  $notification.post(title, subtitle, body);
}

/**
 * 发送签到 POST 请求
 */
async function signInRequest(cookie) {
  const headers = {
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://www.nodeseek.com',
    'Referer': 'https://www.nodeseek.com/board',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Cookie': cookie,
  };

  headers['Content-Length'] = '0'; // 明确指定无 body，避免 Surge 误判为 GET

  return new Promise((resolve) => {
    $task.fetch({
      method: 'POST',
      url: CONFIG.signUrl,
      headers: headers,
      body: '',
    }).then(response => {
      const { statusCode, body, headers: respHeaders } = response;
      // $task.fetch 的 body 可能是 Base64 编码的，尝试解码
      let data = body;
      if (respHeaders && respHeaders['Content-Encoding'] === 'base64') {
        try { data = $base64.decode(body); } catch (e) {}
      }

      try {
        const result = JSON.parse(data);
        resolve({
          success: result.success === true,
          message: result.message || '',
          data: result,
        });
      } catch (e) {
        // 解析失败 — 显示完整原始响应，便于调试
        const isHTML = /^\s*</.test(data);
        const isMethodError = /Cannot\s+(GET|POST|PUT|DELETE)/i.test(data);
        let notice;
        if (isHTML && isMethodError) {
          notice = `❌ 请求被当作 ${data.match(/Cannot\s+(\w+)/i)?.[1] || '?'} 发送 — Cloudflare 可能拦截了 POST 方法`;
        } else if (isHTML) {
          notice = `❌ 收到 HTML 而非 JSON — Cloudflare 拦截\n请手动访问 nodeseek.com 一次再重试`;
        } else {
          notice = `❌ 响应不是 JSON\nHTTP ${statusCode}\n${data.substring(0, 400)}`;
        }
        console.log(`[NodeSeek] 签到响应解析失败\nStatus: ${statusCode}\nBody: ${data}`);
        $notification.post('❌ NodeSeek 签到 — 响应解析失败', '', notice);
        resolve(null);
      }
    }, error => {
      $notification.post('❌ NodeSeek 签到网络错误', '', error.message || String(error));
      resolve(null);
    });
  });
}

/**
 * 解析签到返回的奖励信息
 * 期望格式: { success: true, message: "签到成功，获得 5 鸡腿", ... }
 */
function parseSignReward(data) {
  if (data.message && data.message.includes('鸡腿')) {
    return data.message;
  }
  if (data.reward) {
    return `获得奖励: ${data.reward}`;
  }
  return '';
}

/**
 * 获取用户信息（鸡腿余额等）
 */
async function getUserInfo(cookie, memberId) {
  const headers = {
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': `https://www.nodeseek.com/space/${memberId}`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Cookie': cookie,
  };

  return new Promise((resolve) => {
    $httpClient.get(`${CONFIG.infoUrl}${memberId}?readme=1`, {
      headers: headers,
    }, (error, response, data) => {
      if (error) {
        resolve('');
        return;
      }
      try {
        const result = JSON.parse(data);
        if (result.success && result.detail) {
          const u = result.detail;
          const parts = [];
          if (u.member_name) parts.push(`👤 ${u.member_name}`);
          if (u.coin !== undefined) parts.push(`🍗 ${u.coin} 鸡腿`);
          if (u.rank) parts.push(`🏅 ${u.rank}`);
          if (u.nPost !== undefined) parts.push(`📝 ${u.nPost} 帖`);
          if (u.nComment !== undefined) parts.push(`💬 ${u.nComment} 评论`);
          resolve(parts.join(' | '));
        } else {
          resolve(result.message || '');
        }
      } catch (e) {
        console.log(`[NodeSeek] 用户信息解析失败\nStatus: ${response.status}\nBody: ${data.substring(0, 300)}`);
        resolve('[JSON 解析失败，请检查 memberId 或 Cookie]');
      }
    });
  });
}

// 执行入口
main();
