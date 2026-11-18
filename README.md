# Student Portal

The portal uses a React/Vite frontend, an Express API, and Microsoft Azure SQL
Database. Credentials and signing secrets belong only in the backend `.env` file.

## Project layout

```text
database/
  database.sql          Initial, idempotent schema (no sample data)
middleware/
  auth.js               JWT cookie authentication and role checks
public/                 Legacy static pages and public assets
scripts/
  create-admin.js       One-time first administrator setup
src/
  App.jsx               React registration, login, and role dashboards
  main.jsx
  style.css
test/
  auth.test.js          Authentication and role-guard tests
database.js             Azure SQL connection pool
server.js               Express API and production static hosting
vite.config.js           Development API proxy
.env.example             Backend configuration template
```

## Azure SQL setup

1. In Azure Portal, open your SQL server and go to **Networking**.
2. Enable public network access only if your deployment requires it. Add the
   developer machine's current public IP as a firewall rule for local work.
   For hosting, allow only the application's documented outbound IP addresses.
   Avoid broad firewall rules.
3. Confirm SQL authentication is enabled for your database user and that the
   account can create and modify tables in your portal database.
4. Back up or inspect the existing database before running
   `database/database.sql`. The script only creates missing tables; it does not
   alter existing tables. If existing tables with these names have a different
   shape, stop and reconcile the schema before using this API.
5. Run `database/database.sql` against your portal database using SQL Server
   Management Studio or Azure Data Studio. The script creates schema only; it
   inserts no fake users or sample production data. If the existing `Employees`
   table has a `Department` column, distinct department names are copied into
   `Departments`; existing employee rows are not changed. The script also adds
   missing query indexes idempotently; re-run it after pulling schema/index
   updates.
6. Copy `.env.example` to `.env`, then set the Azure SQL password and a unique
   random `JWT_SECRET` of at least 32 characters. Set `FRONTEND_ORIGIN` to the
   exact frontend origin when deployed. Do not commit `.env`.

## Create the first administrator

Set these variables in the PowerShell window where you run the command; avoid
putting the password directly in shell history:

```powershell
$env:ADMIN_NAME = "Portal Administrator"
$env:ADMIN_EMAIL = "admin@example.edu"
$secure = Read-Host "Administrator password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    npm run create-admin
}
finally {
    $env:ADMIN_PASSWORD = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL -ErrorAction SilentlyContinue
}
```

The setup command only creates an administrator if none exists. Once signed in,
add departments and subjects, approve teacher registrations, and assign
approved teachers to classes.

## Run locally

From the project directory:

```powershell
npm install
```

Run both the API and React development server from one terminal:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`. The development command stops both processes
together; the Vite server proxies `/api` requests to the backend on port 5000.
If port 5173 or 5000 is already in use, stop the other server before retrying.

For a production-style local run, use `npm run build` and then `npm start`;
Express serves the built React app at `http://localhost:5000`.

## Validation

```powershell
npm test
npm run build
npm audit
```

The automated tests cover authentication and role guards without requiring an
Azure connection. Registration, login against stored hashes, attendance, and
dashboard data require a reachable Azure SQL database with the schema applied,
an administrator created, and valid local `.env` credentials.

## API performance and operations

API requests emit JSON duration records to the server log for Azure Log Stream.
List endpoints accept `page` and `limit` query parameters (default 50, maximum
100) and return totals in `X-Total-Count`, `X-Page`, `X-Page-Size`, and
`X-Total-Pages` headers. The React app loads authenticated dashboards on demand.
Hashed build assets are cached as immutable; HTML stays revalidated so new
deployments are picked up. Authentication endpoints are rate limited.

Redis is not configured: the current portal has no measured cache bottleneck,
and introducing shared cache infrastructure would add operational cost and
invalidation complexity. Azure SQL execution plans and query latency must be
reviewed against the live database in Query Store or execution-plan tooling;
local tests do not have Azure access.

## Current implementation boundaries

Implemented: Azure SQL pooling from environment variables, normalized initial
schema, student and teacher registration, bcrypt password hashes, teacher
approval, JWT sessions in HTTP-only cookies, role-protected APIs, admin
provisioning, department/subject creation, teacher assignments, student
attendance and marks views, and attendance marking with audit history. The
React workspace has responsive role-specific navigation and dashboards for
student attendance/results, teacher class attendance (year, section, subject,
per-student present/absent) and grade entry, and administrator teacher
approvals, academic setup, and assignments.

Not implemented yet: full student/teacher CRUD and CSV import/export, bulk
attendance and date-range reports, comprehensive academic-year/course/class
management, timetable conflict detection, fees/payments, notifications,
announcements, and the complete production workflow/e2e test suite. The current
initial schema must also be reconciled with any pre-existing Azure tables before
deployment.
