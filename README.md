# guru web

`guru-core` 的 React MVP 前端。將目標、可投入時間與 role model 送至後端，呈現三種難度的計畫，並提供每日任務、進度、重新排程與匯出操作。

## 開始使用

需要 Node.js 22.13 以上。

```bash
npm install
cp .env.example .env.local
npm run dev
```

在 `.env.local` 設定 guru-core 的 origin（不要包含 `/v1`）：

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

開啟網頁後，點左下角的「展示模式」，填入 API 網址和 guru-core 登入後簽發的 JWT。設定只保存在目前瀏覽器。若沒有設定後端，介面會使用 PRD 中的 5K 範例資料，所有主要互動仍可展示。

後端需要允許前端 origin 的 CORS，並接受 `Authorization: Bearer <JWT>`。前端會呼叫以下 `/v1` 端點：

- `GET /plans`、`PATCH /plans/{id}`
- `PUT /profile`
- `POST /plan-sessions`
- `GET /role-models?kind=trait|persona`
- `PATCH /plans/{id}/tasks/{task_id}`
- `POST /plans/{id}/revisions`
- `POST /plans/{id}/export`

## 檢查

```bash
npm test
```

專案採 React 19、Next 16 與 vinext，可部署為 Cloudflare Worker 相容的 ESM 輸出。
