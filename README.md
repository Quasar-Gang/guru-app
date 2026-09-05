# guru web

The React MVP client for `guru-core`. It sends a goal, availability, imported context, and optional role models to the backend; presents three plan difficulties; and supports daily tasks, check-ins, progress, revisions, and exports.

## Getting started

Node.js 22.13 or newer is required.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the `guru-core` origin in `.env.local`. Do not include `/v1` or a trailing slash.

```dotenv
GURU_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=/api/guru
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

In the web app, open the connection panel at the bottom left and enter the API origin. Use Google OAuth when a client ID is configured, or paste a JWT issued by `guru-core` during development. These values are stored only in the current browser. If no backend is configured, the app uses the 5K sample data from the product specification and keeps the main interactions available as a demo.

The default `/api/guru` proxy forwards requests to the server-configured
`GURU_API_BASE_URL`. This supports a backend without browser CORS and keeps browser
requests same-origin. It forwards bearer authorization, not browser cookies, and
rewrites backend-signed file URLs through the same proxy. The upstream origin is
server configuration and cannot be selected by a request parameter.

Google login returns to `/oauth/callback`; integration authorization returns to
`/integrations/google/callback`. Register the exact origin and paths with Google
and the backend. Local development uses `http://localhost:3000`. An HTTPS frontend
can proxy an HTTP backend, but transport between the frontend server and backend
still requires TLS for production confidentiality.

The client uses these `/v1` endpoints:

- `GET /plans` and `PATCH /plans/{id}`
- `PUT /profile`
- `POST /plan-sessions` and the session polling/answer endpoints
- `GET /role-models?kind=trait|persona`
- Import presigning, upload completion, and Google authorization endpoints
- Task update and daily check-in endpoints
- Plan revision, archive, delete, and export endpoints

## Validation

```bash
npm test
npm run check:language
```

`check:language` rejects Han characters outside the explicitly approved frontend display files and their rendered-output test. This keeps source comments, documentation, configuration, and internal strings English-only while preserving the Traditional Chinese product interface.

The project uses React 19, Next 16, and vinext, producing Cloudflare Worker-compatible ESM output.
