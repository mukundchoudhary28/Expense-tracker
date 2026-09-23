# Expense Tracker — Frontend

React + TypeScript + Vite client for the FastAPI backend in `../backend`.

It uses the two backend endpoints:

- `GET /api/expenses`: lists expenses, newest first
- `POST /api/expenses`: creates an expense (`description`, `amount`, `category`, `date`)

The backend has no CORS configuration, so the frontend always calls `/api/...` on its
own origin. In development the Vite server proxies those requests, and in Docker nginx does.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173. API calls are proxied to `http://localhost:8000` by default.
To use another address, set `API_URL`, for example `API_URL=http://localhost:9000 npm run dev`.

## Production build

```bash
npm run build     # outputs to dist/
```

## Docker

`Dockerfile` builds the static bundle and serves it with nginx. nginx proxies `/api/` to
`http://backend:8000`, so run the container on the same Docker network as a backend
service named `backend`.

The currency is set in `src/format.ts` (`CURRENCY`).
