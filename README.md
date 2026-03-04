# ElimuLink Connect

Monorepo structure:
- `connect-calendar/frontend` (React + Vite)
- `connect-calendar/backend` (FastAPI)
- `connect-meet/frontend` (React + Vite)
- `connect-meet/backend` (FastAPI)
- `shared/*` (auth, ai, notifications stubs)

## Connect Calendar

Frontend:
```bash
cd connect-calendar/frontend
npm install
npm run dev -- --port 5173
```

Backend:
```bash
cd connect-calendar/backend
# activate venv then:
uvicorn app.main:app --reload --port 8000
```

## Connect Meet

Frontend:
```bash
cd connect-meet/frontend
npm install
npm run dev -- --port 5174
```

Backend:
```bash
cd connect-meet/backend
# activate venv then:
uvicorn app.main:app --reload --port 8001
```