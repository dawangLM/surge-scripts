# AnyRouter Surge 自动签到

脚本调用的是网站前端当前使用的官方签到接口：`POST https://anyrouter.top/api/user/sign_in`。网站在已登录用户打开页面时会自动调用此接口，脚本只复现这一步，不模拟 LinuxDO OAuth，也不保存账号密码。

## 一键安装

Surge → 模块 → 安装新模块，输入：

```text
https://raw.githubusercontent.com/dawangLM/surge-scripts/main/surge-scripts/anyrouter-signin.sgmodule
```

## 首次使用

1. 安装并启用模块。
2. 确认 Surge 的脚本、重写和 MITM 功能已开启，Surge 证书已由你本人安装并信任。
3. 保持 Surge 运行，用 Safari 打开 [AnyRouter 控制台](https://anyrouter.top/console)，正常登录并进入一次控制台。
4. 收到“凭证获取成功”通知后，在 Surge 的脚本列表中长按“AnyRouter 每日自动签到”手动执行一次，核对返回消息。

默认每天 `09:05` 执行，并设置 `wake-system=true`。如需调整时间，编辑模块中的 `cronexp="5 9 * * *"`；五段依次表示分钟、小时、日期、月份、星期，时间按设备所在时区运行。

## 凭证与隐私

脚本只在 Surge 本机持久存储中保存 AnyRouter 会话 Cookie、数字用户 ID 和浏览器 User-Agent。这些内容不会写入脚本、模块或日志，也不会发送给 AnyRouter 之外的地址。

Cookie 仍属于敏感凭证，请勿分享 Surge 的持久存储或包含请求头的调试记录。收到“凭证已失效”后，重新登录网站并进入控制台一次即可更新。

## 常见问题

- 没有“凭证获取成功”：确认模块已启用、MITM 主机名包含 `anyrouter.top`、证书已信任，然后重新进入控制台。
- 页面正常但捕获不到：检查是否有另一条更早的 `http-request` 脚本匹配同一接口。Surge 对一次请求只运行首个匹配的请求脚本。
- 定时任务未执行：确认 Surge 允许通知。iOS 的后台调度可能受系统状态影响，可先长按脚本手动验证。
- 签到返回失败：以网站返回的中文消息为准。网站接口或登录机制以后变化时，需要更新脚本。

## 核查依据

核查日期：2026-09-17。

- AnyRouter 当前前端公开资源中，已登录用户进入页面会调用 `POST /api/user/sign_in`，响应字段为 `success` 和 `message`。
- 前端为已登录 API 请求添加 `New-API-User` 用户 ID，并依赖站点会话 Cookie。
- [Surge 官方脚本文档](https://manual.nssurge.com/scripting/overview.html)说明 `script-path` 支持 HTTP(S) URL；[请求脚本文档](https://manual.nssurge.com/scripting/http-request.html)说明 HTTPS 请求捕获需要 MITM；[定时脚本文档](https://manual.nssurge.com/scripting/cron.html)说明 cron 与 `wake-system` 的行为。

静态检查无法替代真实账号领取验证。首次安装后请手动执行一次，确认网站返回“签到成功”或“今日已完成”。
