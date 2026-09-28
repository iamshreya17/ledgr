# Ledgr

Ledgr is a manual-entry investment tracker built for Indian portfolios: stocks, mutual funds, crypto, fixed deposits, recurring deposits, real estate, gold, sovereign gold bonds, bonds, PPF, EPF, NPS, and other assets. You can group investments into multiple portfolios and view each group or all portfolios together. It uses Django REST Framework, PostgreSQL, and a React/Vite frontend. No market price service is used.

## Complete project explanation

New to this codebase? Read [PROJECT_GUIDE.md](PROJECT_GUIDE.md). It explains the architecture, database tables and relationships, backend and frontend files, API endpoints, authentication, calculations, user workflows, setup, tests, and troubleshooting from the beginning.

## Requirements

- Python 3.10+
- PostgreSQL with a database and user you can access
- Node.js 20+

## Backend

Create a PostgreSQL database named `ledgr` (or use another name in your environment file). From the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` with your PostgreSQL credentials and a random `DJANGO_SECRET_KEY`. Then run:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

The API is at `http://localhost:8000/api/` and Django admin is at `http://localhost:8000/admin/`. The admin investment list flags gains above 5,000% for review; high gains remain allowed.

## Frontend

In a **second terminal**, from the project root:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/`. Keep both servers running concurrently on their separate ports. `VITE_API_URL` defaults to `http://localhost:8000/api/`; `VITE_CURRENCY` defaults to INR. The frontend uses Indian digit grouping (for example ₹12,34,567.00) and lakh/crore summaries. Hover over abbreviated headline values or chart points to see full amounts. All monetary values are entered and stored as rupees; Ledgr does not convert currencies. Set `FRONTEND_URL` in the backend environment if the app is served from another address; share links use it.

The app includes portfolio groups, a performer leaderboard, CSV import/export, financial goals, recurring investment plans, stale valuation reminders, and read-only aggregate share links. Recurring installments become individual investments when logged. The dashboard and investment pages show an illustrative sale-today tax estimate. Asset subtype, tax slab, annual gains, and other filing details are not recorded, so the estimate may be incomplete. Consult a tax professional before relying on it.

## Tests

With the backend environment active and PostgreSQL running:

```bash
cd backend
python manage.py test
```

Frontend tests and production build:

```bash
cd frontend
npm test
npm run build
```

The test user needs permission to create a PostgreSQL test database.

## API notes

Register with `username`, `email`, and `password` at `POST /api/auth/register/`. Log in with `username` and `password` at `POST /api/auth/login/`; use the returned access token as `Authorization: Bearer <token>`. Refresh with `POST /api/auth/refresh/` and `{"refresh":"..."}`. Each account has a default Personal portfolio. Manage portfolios with `GET/POST /api/portfolios/` and `GET/PUT/PATCH/DELETE /api/portfolios/{id}/`. Pass `?portfolio={id}` to the investment list and dashboard endpoints to view one portfolio; omit it for combined data. A portfolio containing investments cannot be deleted. Investment list responses are paginated. Dashboard history includes dates with logged valuations and carries each investment's last recorded value forward on later snapshot dates. Add a valuation at `POST /api/investments/{id}/snapshot/`; edit or delete one with `PUT`, `PATCH`, or `DELETE /api/investments/{id}/snapshots/{snapshot_id}/`. Editing or removing the newest valuation updates the investment's current value. When the last valuation is removed, its current value resets to the original invested amount.

Additional endpoints: `GET /api/dashboard/performers/`, `GET/POST /api/goals/` and `GET /api/goals/{id}/progress/`, `GET/POST /api/recurring-investments/`, `GET /api/recurring-investments/upcoming/?days=30`, `POST /api/recurring-investments/{id}/log-installment/`, `GET /api/investments/{id}/tax-estimate/`, `GET /api/dashboard/tax-estimate/`, `GET /api/investments/stale/?threshold_days=90`, `GET/POST /api/shared-snapshots/`, and public `GET /api/public/snapshot/{token}/`. CSV endpoints are `GET /api/investments/export/` and `POST /api/investments/import/` with a multipart `file` field. The public snapshot response contains only aggregate summary and history; deleting a shared link revokes its token.
