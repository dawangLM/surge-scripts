# NodeSeek Surge 签到脚本

自动签到领鸡腿 🍗，通过 MITM 自动捕获 Cookie。

## 背景

基于对 https://www.nodeseek.com 的反向工程，核心 API：

| 接口 | 方法 | 用途 |
|------|------|------|
| `/api/attendance?random=false` | POST | 每日签到（领鸡腿） |
| `/api/account/getInfo/{member_id}` | GET | 获取用户信息（鸡腿余额） |

## Surge 配置

### 1. 添加脚本

在 Surge 配置文件（`.conf`）中添加以下内容：

```ini
[Script]
# MITM 捕获 Cookie — 访问 nodeseek.com 时自动保存
http-request ^https?:\/\/(?:www\.)?nodeseek\.com script-path=surge-scripts/nodeseek.js, tag=NodeSeek-捕获Cookie

# 定时签到 — 每天早上 8 点自动签到
cron "0 8 * * *" script-path=surge-scripts/nodeseek.js, tag=NodeSeek-每日签到

# 手动签到（面板按钮）
script-path=surge-scripts/nodeseek.js, tag=NodeSeek-手动签到

[MITM]
hostname = %APPEND% www.nodeseek.com
```

将 `script-path` 指向你存放脚本的实际路径，支持本地路径或远程 URL。

### 2. 启用 MITM

1. 在 Surge 的 **MITM** 设置中开启 MITM
2. 生成并安装 CA 证书到你的设备并信任
3. 确认 `hostname` 包含 `www.nodeseek.com`

### 3. 首次使用

1. 在浏览器中打开 https://www.nodeseek.com
2. 登录你的账号
3. Surge 会弹出通知 **「✅ NodeSeek Cookie 已更新」**
4. 之后每天会自动签到，并在通知中显示结果

### 4.（可选）显示鸡腿余额

编辑 `nodeseek.js` 顶部的 `CONFIG` 区域：

```javascript
const CONFIG = {
  memberId: '12345',  // 从你的个人空间 URL 获取，如 /space/12345
  // ...
};
```

填写后签到通知会额外显示用户名、鸡腿余额、等级等信息。

或者，脚本也会尝试从 Cookie 中自动提取用户 ID（部分场景有效）。

## 通知示例

**签到成功时：**
> ✅ NodeSeek 签到成功
> 签到成功，获得 5 鸡腿
> 👤 zsir | 🍗 128 鸡腿 | 🏅 Lv.5 | 📝 42 帖 | 💬 156 评论

**重复签到：**
> ℹ️ NodeSeek 签到
> 今天已完成签到，请勿重复操作

**Cookie 过期：**
> ❌ NodeSeek 签到失败
> Cookie 未捕获
> 请先在浏览器中登录 nodeseek.com，脚本会自动捕获 Cookie

## 多账号支持

Surge 本身不原生支持多账号存储。如果需要多账号签到，有两种方式：

1. **方式一：复制脚本**，为每个账号创建独立的脚本文件，使用不同的 `storageKey`
2. **方式二：单账号**，脚本默认只管理一个 Cookie，切换账号时重新登录即可自动覆盖

## 常见问题

**Q: 签到显示「请先登录」？**
A: Cookie 已过期。重新打开 https://www.nodeseek.com 登录即可自动更新 Cookie。

**Q: 请求被 Cloudflare 拦截？**
A: 确保脚本的 `User-Agent` 和请求头与你实际浏览器一致（脚本已提供常用配置）。如果仍有问题，在浏览器中访问一次 nodeseek.com 建立信任后再试。

**Q: 如何获取 memberId？**
A: 打开你的个人空间，URL 类似 `https://www.nodeseek.com/space/12345`，其中 `12345` 就是你的 memberId。

## 技术细节

- 签到 API 返回格式：`{"success": true/false, "message": "签到成功，获得 X 鸡腿"}`
- 用户信息 API 返回格式：`{"success": true, "detail": {"member_name": "...", "coin": 123, "rank": "...", "nPost": 10, "nComment": 20}}`
- 脚本通过检测 `$request` / `$trigger` 对象自动判断运行模式
- Cookie 存储在 Surge 的 `$persistentStore` 中，跨重启持久化
