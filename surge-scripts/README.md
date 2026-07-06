# surge-scripts — Surge 自动化脚本合集

Surge 平台的实用自动化脚本与模块。

---

## 📦 NodeSeek 每日签到

自动签到领鸡腿 🍗，通过 MITM 自动捕获 Cookie。

### 🚀 一键安装（推荐）

Surge → 模块 → 安装新模块 → 输入下方 URL：

```
https://raw.githubusercontent.com/dawangLM/surge-scripts/main/surge-scripts/nodeseek.sgmodule
```

或扫描/导入本地文件：`surge-scripts/nodeseek.sgmodule`

### 📋 手动配置

如果你不想用模块，也可以直接在配置文件中添加：

```ini
[Script]
http-request ^https?:\/\/(?:www\.)?nodeseek\.com script-path=https://raw.githubusercontent.com/dawangLM/surge-scripts/main/surge-scripts/nodeseek.js, tag=NodeSeek-捕获Cookie
cron "0 8 * * *" script-path=https://raw.githubusercontent.com/dawangLM/surge-scripts/main/surge-scripts/nodeseek.js, tag=NodeSeek-每日签到
script-path=https://raw.githubusercontent.com/dawangLM/surge-scripts/main/surge-scripts/nodeseek.js, tag=NodeSeek-手动签到

[MITM]
hostname = %APPEND% www.nodeseek.com
```

### 🎯 首次使用

1. 确保 Surge 已开启 **MITM** 并信任证书
2. 在浏览器中打开 https://www.nodeseek.com 并登录
3. 脚本会自动捕获 Cookie（弹出通知 ✅）
4. 之后每天 **8:00** 自动签到
5. 也可在 Surge → 脚本 → 点击「NodeSeek-手动签到」随时触发

### ⚙️ 可选：显示鸡腿余额

编辑脚本 `nodeseek.js` 顶部 `CONFIG.memberId`，填入你的用户 ID（从个人空间 `/space/{id}` 获取），签到通知会额外显示鸡腿数。

或直接在 Surge 持久化存储中设置键 `nodeseek_member_id` 为你的 ID。

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `nodeseek.js` | 签到脚本核心（MITM 捕获 + 定时签到 + 面板触发） |
| `nodeseek.sgmodule` | Surge 模块（一键安装，引用远程 JS） |
| `nodeseek-readme.md` | 详细配置文档 |

---

## 📜 技术原理

基于对 www.nodeseek.com 的逆向分析：

| API | 方法 | 说明 |
|-----|------|------|
| `/api/attendance?random=false` | POST | 每日签到，返回鸡腿数 |
| `/api/account/getInfo/{member_id}` | GET | 获取用户信息与鸡腿余额 |
