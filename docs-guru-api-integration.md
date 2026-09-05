# Guru API 對接規格

給前端的後端契約。後端 repo：`guru-core`。有疑問或要改路徑，先講一聲——路徑同時寫在後端設定和 Google Console 裡。

## Base URL

| 環境 | 值 |
|---|---|
| 本機後端 | `http://localhost:8000` |
| 部署後端（Droplet） | `http://178.128.92.13:8000` |

放進 `NEXT_PUBLIC_API_BASE_URL`，不含 `/v1`、不含尾斜線。

除了 `POST /v1/auth/google` 和 `GET /health`，每個端點都要帶：

```
Authorization: Bearer <access_token>
```

## 你要實作的兩個 callback 頁

| 路徑 | 用途 |
|---|---|
| `/oauth/callback` | 登入 |
| `/integrations/google/callback` | 行事曆 / 試算表授權 |

開發環境固定 `http://localhost:3000`。這兩個 URL 已經登記在 Google Console 與後端的 `GOOGLE_REDIRECT_URI`。

## 1. 登入

Google OAuth 的 flow **由前端跑**，後端只負責兌換 code。Google 的 token 不會經過瀏覽器。

```
1. 導向 Google authorize，scope 至少 openid email
   redirect_uri = http://localhost:3000/oauth/callback
2. Google 導回該頁，帶 ?code=xxx
3. POST /v1/auth/google
   { "code": "xxx", "redirect_uri": "http://localhost:3000/oauth/callback" }
```

步驟 3 的 `redirect_uri` 必須跟步驟 1 用的**逐字元相同**，否則 Google 拒絕兌換，後端回 401。

回應：

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user_id": "uuid",
  "email": "a@b.com",
  "is_new_user": true
}
```

- `is_new_user: true` → 導去 onboarding（`PUT /v1/profile`），否則直接進 app
- token 效期 30 天，**沒有 refresh 端點**；過期就重跑整條 flow
- 任何 401 一律當成「重新登入」

`GET /v1/me` 可以驗證手上的 token 還有效。

## 2. 行事曆 / 試算表授權

登入**不**附帶行事曆權限，這是第二次、獨立的同意流程。

```
1. GET  /v1/integrations/google/authorize   → { "authorize_url": "..." }
2. 導向 authorize_url（原封不動，裡面有 state nonce）
3. Google 導回 /integrations/google/callback?code=xxx
4. POST /v1/integrations/google/callback
   { "code": "xxx" }
```

步驟 2 不要改動 `authorize_url`。步驟 4 只送 `code`，`redirect_uri` 由後端自己帶。一次同意涵蓋讀行事曆、寫行事曆、建立試算表三件事。

放棄同意不會留下任何紀錄——第 4 步之前什麼都不寫入。

`GET /v1/integrations` 查目前連了什麼；剛登入的帳號回空陣列是正常的。

## 錯誤格式

```json
{ "error": { "code": "unauthorized", "message": "..." } }
```

| 狀態 | code | 意思 |
|---|---|---|
| 401 | `unauthorized` | token 無效／過期，或 Google 拒絕兌換 |
| 422 | `invalid_input` | 缺欄位或值不合法 |
| 429 | `rate_limited` | 每個來源 IP 每分鐘 60 次 |

## 完整 API

Swagger UI 在 `<base>/docs`。

## 兩個現在就會擋到你的限制

**1. 後端沒有 CORS。** `services/api` 完全沒有掛 `CORSMiddleware`，所以**瀏覽器直接打 API 一定會被擋**。兩條路：

- 前端從 server 端呼叫（Next route handler / server component 轉發），瀏覽器不跨源——目前 `app/lib/guru-api.ts` 只要跑在 server 就沒事
- 需要瀏覽器直接打的話跟我說，我在後端加上 CORS 白名單

**2. 後端是純 HTTP，沒有 TLS、沒有域名。** 前端若部署到 `https://`，瀏覽器會擋掉對 `http://` API 的請求（mixed content）。開發期請跑 `http://localhost:3000`。正式上線前要先幫後端掛域名和憑證。
