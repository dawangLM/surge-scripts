/**
 * AnyRouter Surge 自动签到
 *
 * 首次登录网站时捕获会话 Cookie 与 New-API-User；定时任务随后重放
 * POST /api/user/sign_in。脚本不会保存用户名、密码或第三方 OAuth 凭据。
 */

const TITLE = "AnyRouter 自动签到";
const STORE_KEY = "anyrouter_signin_auth";
const SIGN_IN_URL = "https://anyrouter.top/api/user/sign_in";

if (typeof $request !== "undefined") {
  captureCredential();
} else {
  signIn();
}

function captureCredential() {
  const headers = normalizeHeaders($request.headers || {});
  const credential = {
    cookie: headers.cookie || "",
    userId: headers["new-api-user"] || "",
    userAgent: headers["user-agent"] || "Mozilla/5.0",
    capturedAt: new Date().toISOString(),
  };

  if (!isValidCredential(credential)) {
    console.log("未捕获到完整会话，请确认已经登录 AnyRouter。");
    return $done({});
  }

  const old = readCredential();
  const changed = !old || old.cookie !== credential.cookie || old.userId !== credential.userId;
  const saved = $persistentStore.write(JSON.stringify(credential), STORE_KEY);

  if (saved && changed) {
    $notification.post(TITLE, "凭证获取成功", "已保存站点会话，后续将按计划自动签到。");
  }
  $done({});
}

function signIn() {
  const credential = readCredential();
  if (!isValidCredential(credential)) {
    $notification.post(TITLE, "尚未获取凭证", "请开启 Surge 后登录 anyrouter.top，并进入一次控制台。", {
      url: "https://anyrouter.top/console",
    });
    return $done();
  }

  $httpClient.post(
    {
      url: SIGN_IN_URL,
      headers: {
        Accept: "application/json, text/plain, */*",
        Cookie: credential.cookie,
        "New-API-User": credential.userId,
        "User-Agent": credential.userAgent,
        Origin: "https://anyrouter.top",
        Referer: "https://anyrouter.top/console",
        "Cache-Control": "no-store",
      },
      body: "",
      timeout: 15,
      "auto-cookie": false,
    },
    (error, response, data) => {
      if (error) {
        $notification.post(TITLE, "请求失败", String(error));
        return $done();
      }

      let result;
      try {
        result = JSON.parse(data || "{}");
      } catch (_) {
        $notification.post(TITLE, "响应解析失败", `HTTP ${response ? response.status : "未知"}`);
        return $done();
      }

      const message = result.message || "服务器未返回说明";
      if (result.success) {
        $notification.post(TITLE, "签到成功", message);
      } else if (/已.*签到|重复|今日/.test(message)) {
        $notification.post(TITLE, "今日已完成", message);
      } else if ((response && response.status === 401) || /登录|会话|认证|未授权|过期/.test(message)) {
        $notification.post(TITLE, "凭证已失效", "请重新登录 AnyRouter，并进入一次控制台以更新会话。", {
          url: "https://anyrouter.top/console",
        });
      } else {
        $notification.post(TITLE, "签到未成功", message);
      }
      $done();
    }
  );
}

function readCredential() {
  try {
    return JSON.parse($persistentStore.read(STORE_KEY) || "null");
  } catch (_) {
    return null;
  }
}

function isValidCredential(value) {
  return Boolean(
    value &&
      typeof value.cookie === "string" &&
      value.cookie.length > 0 &&
      /^\d+$/.test(String(value.userId || ""))
  );
}

function normalizeHeaders(headers) {
  return Object.keys(headers).reduce((result, key) => {
    result[key.toLowerCase()] = String(headers[key]);
    return result;
  }, {});
}
