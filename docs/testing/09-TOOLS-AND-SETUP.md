# 09 — Tools and Setup for the Test Session

This page lists every tool you need to run the test plan in this folder. It explains how
to install each one on macOS and Windows, and how to use it for **our** tests.

Read this before the team testing session. The checklist at the bottom is what every
member must have working **before** the session starts.

> Test ID prefixes used below: `WF-…` = workflow tests (04), `UI-MOCK-…` = mockup page
> checks (04), `API-…` = API tests (05), `DB-…` = database tests (06).

---

## Summary table

| Tool | What we use it for | Already in the repo? | Test IDs |
|---|---|---|---|
| Node.js 22 (or 20) + npm | Run the app, scripts and the existing test suite | Yes — `.nvmrc` = `22`, `package.json` `engines: >=20` | All |
| PostgreSQL 16 (`psql`, `initdb`, `pg_ctl`) | The database; the existing test suite also needs `initdb`/`pg_ctl` | No — install yourself | All `DB-…`, data checks in `WF-…` |
| Browser (Chrome) + DevTools | Manual UI testing; watch network calls and console errors | Install yourself | All `WF-…` with Tool = Manual, all `UI-MOCK-…` |
| Node test runner (`node --test`) | The existing automated suite (`npm test`) | Yes — built into Node, no package | Rows marked "Covered by existing test" |
| Playwright | Optional: automate browser workflows later | **No — not installed, no config** | Rows with Tool = Playwright (none are automated yet) |
| curl | Run the API examples in 05 | Built into macOS and Windows 10+ | All `API-…` |
| Postman | Same API tests with a UI; save them in a collection | Install yourself | All `API-…` |
| pgAdmin (optional) | GUI alternative to `psql` | Install yourself | All `DB-…` |
| Google Sheets | Shared test tracker (`08-TEST-TRACKER.csv`) | Web app | All |
| ESLint / TypeScript / Next build | Static checks (`npm run lint`, `npm run typecheck`, `npx next build`) | Yes — devDependencies | 07 static review |

Nothing in this plan needs a new package added to `package.json`. Playwright is optional.
If the team wants it, agree first and add it in a separate PR (see the Playwright section).

---

## 1. Node.js and npm

**Used for:** running the app (`npm run dev`), the database scripts (`npm run db:*`) and
the existing tests (`npm test`).

**Already set up?** The repo pins Node **22** in `.nvmrc`. `package.json` accepts Node 20 or
newer. Dependencies are listed in `package.json`; run `npm install` once.

### macOS

```bash
# Install nvm (Node Version Manager) if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart the terminal, then in the project folder:
nvm install 22
nvm use          # reads .nvmrc
node -v          # v22.x
npm -v           # 10.x
npm install
```

### Windows

1. Install **nvm-windows** from <https://github.com/coreybutler/nvm-windows/releases>
   (`nvm-setup.exe`).
2. Open a new PowerShell window:

```powershell
nvm install 22
nvm use 22
node -v
npm install
```

### Use for our tests

| Command | What it does | Touches your dev database? |
|---|---|---|
| `npm run dev` | Start the app at <http://localhost:3000> | Yes (reads/writes through `DATABASE_URL`) |
| `npm test` | All DB + API + e2e tests in a **throwaway** PostgreSQL cluster | **No** |
| `npm run test:db` / `test:api` / `test:security` | One suite only, same throwaway cluster | No |
| `npm run typecheck` / `npm run lint` | Static checks | No |
| `npm run db:rebuild` | Build schema + seed into the **empty** database in `.env` | Yes |
| `npm run db:rebuild -- --reset` | **Wipes** and rebuilds `mims_dev` (or `mims_test_*`) | **Yes — deletes all data** |

---

## 2. PostgreSQL 16 (`psql`, `initdb`, `pg_ctl`)

**Used for:** the application database and every `DB-…` test. `npm test` also calls
`initdb` and `pg_ctl` to create its own temporary cluster, so these programs must be on
your `PATH`.

**Already set up?** No. Install PostgreSQL 16 (15 also works).

### macOS (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
psql --version     # psql (PostgreSQL) 16.x
which initdb pg_ctl
```

**macOS note for `npm test`:** the temporary cluster may fail to start unless the locale
is set. Run tests like this:

```bash
LC_ALL=en_US.UTF-8 npm test
```

### Windows

1. Download the PostgreSQL 16 installer from <https://www.postgresql.org/download/windows/>
   (EDB installer). Keep the default components (Server, pgAdmin 4, Command Line Tools).
2. Remember the password you set for the `postgres` superuser.
3. Add `C:\Program Files\PostgreSQL\16\bin` to your `PATH`
   (Start → "Edit the system environment variables" → Environment Variables → Path → New).
4. New PowerShell window: `psql --version`.

The test runner also finds PostgreSQL 15–18 under `Program Files` automatically. If it
cannot, set `PG_BIN` to the `bin` folder.

### Create the project database (both systems)

Follow `docs/10_local-setup.md`. In short:

```bash
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: set real local passwords in DATABASE_URL and DATABASE_MIGRATION_URL,
# and generate SESSION_SECRET, CSRF_SECRET, INTEREST_WORKER_TOKEN
# (openssl rand -base64 32)
npm run db:create             # creates roles mims_owner + mims_app and database mims_dev
npm run db:rebuild            # migrations → routines → views → grants → seed
npm run db:verify             # all checks must pass
```

The variables come from `.env.example`. Never commit `.env`.

| Variable | Example value (local only) | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://mims_app:<pw>@localhost:5432/mims_dev` | App role (least privilege) |
| `DATABASE_MIGRATION_URL` | `postgresql://mims_owner:<pw>@localhost:5432/mims_dev` | Owner role, scripts only |
| `PGPOOL_MAX`, `PGPOOL_IDLE_TIMEOUT_MS`, `PGPOOL_CONNECTION_TIMEOUT_MS`, `PGSTATEMENT_TIMEOUT_MS` | `10`, `30000`, `5000`, `10000` | Pool limits |
| `SESSION_SECRET`, `CSRF_SECRET` | random 32 bytes | Security secrets |
| `SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_ABSOLUTE_TIMEOUT_HOURS` | `20`, `8` | Session limits (the DB values in `system_parameter` win) |
| `PASSWORD_HASH_ALGORITHM` | `argon2id` | |
| `INTEREST_WORKER_TOKEN` | random 32 bytes | Worker token for `POST /api/interest-runs` |
| `BUSINESS_HOURS_START`, `BUSINESS_HOURS_END`, `BANK_TIMEZONE` | `08:30`, `16:30`, `Asia/Colombo` | Not read by the posting routines. The real values are `system_parameter` keys `BUSINESS_HOUR_START` = `08:30` and `BUSINESS_HOUR_END` = `17:00` (see 07) |
| `NODE_ENV`, `APP_BASE_URL`, `LOG_LEVEL` | `development`, `http://localhost:3000`, `info` | |

### Use `psql` for the 06 queries

```bash
# Connect as the app role (what the website uses) — most tests
psql "postgresql://mims_app:<pw>@localhost:5432/mims_dev"

# Connect as the owner role — needed for tests marked "run as mims_owner"
psql "postgresql://mims_owner:<pw>@localhost:5432/mims_dev"
```

Useful `psql` commands:

| Command | Meaning |
|---|---|
| `\dt` | List tables |
| `\d account` | Show columns, constraints and triggers of `account` |
| `\df fn_*` / `\df sp_*` | List functions / procedures |
| `\dv` | List views |
| `\x auto` | Readable output for wide rows |
| `\i path/to/file.sql` | Run a file of queries |
| `\set ON_ERROR_STOP on` | Stop at the first error (turn **off** for negative tests) |
| `\q` | Quit |

Every 06 test is wrapped in `BEGIN; … ROLLBACK;` so it leaves **no data behind**. For a
negative test, the error message itself is the expected result. After an error inside a
transaction, type `ROLLBACK;` before the next test.

---

## 3. Browser (manual testing) and DevTools

**Used for:** every `WF-…` row with Tool = *Manual (browser)* and every `UI-MOCK-…` row.

**Which browser:** Google Chrome (latest). Edge works the same way. Use a **separate
profile or an Incognito window per role**, because the session cookie is shared per
browser profile. Example: Chrome window for `agent_c1`, Incognito window for `bm_colombo`.

### Install

- macOS: <https://www.google.com/chrome/> → drag to Applications.
- Windows: <https://www.google.com/chrome/> → run the installer.

### DevTools — what to check on every page

Open DevTools with **⌥⌘I** (macOS) or **F12 / Ctrl+Shift+I** (Windows).

1. **Console tab:** there must be **no red errors** when the page loads or when you click.
   Hydration warnings or failed fetches count as a failure. Copy the message into Notes.
2. **Network tab:** tick *Preserve log*. Filter by **Fetch/XHR**. When you submit a form,
   click the request and check:
   - **Headers → Status:** e.g. `201`, `200`, `400`, `403`, `409`.
   - **Headers → Request headers:** state-changing requests must send `x-csrf-token`.
   - **Response:** must be `{ "data": … }` or `{ "error": { "code", "message" } }`, and must
     **not** contain SQL text, stack traces or password hashes.
3. **Application tab → Cookies → http://localhost:3000:** you should see `mims_session`
   (HttpOnly ✓) and `mims_csrf` (not HttpOnly) after sign-in. After sign-out,
   `mims_session` must be gone or rejected.
4. **Responsive check:** toggle the device toolbar (**⇧⌘M** / **Ctrl+Shift+M**). At width 375
   there must be no horizontal page scroll. Wide tables should scroll inside their card.

---

## 4. Existing automated suite (Node test runner)

**Used for:** the rows whose *Automated?* column names a test file.

**Already set up?** Yes. Tests use `node:test` and `node:assert`. There is no Jest,
Vitest, Cypress or Playwright in the repo.

```bash
LC_ALL=en_US.UTF-8 npm test                 # everything (macOS needs LC_ALL)
npm run test:db                             # tests/db only
npm run test:api                            # tests/api only
npm run test:security                       # tests/security only
npm run verify:phase1                       # rebuild + all tests + typecheck + lint + build
npm run verify:master-data-integrity        # focused M2 integrity suite
npm run verify:seed-validation              # focused seed validation suite
```

These commands start a **temporary PostgreSQL cluster in your system temp folder**, build
the schema there, run the tests and delete the cluster afterwards. They do **not** touch
`mims_dev`. They need `initdb` and `pg_ctl` (section 2).

Run one file directly (only for tests that need no database — the `tests/e2e/*` model and
render tests):

```bash
node --test tests/e2e/accounts-ui-model.test.mjs
```

DB and API test files expect the cluster created by the runner, so run them through the
npm scripts, not one by one.

---

## 5. Playwright (optional — not installed)

**Used for:** future automation of the browser workflows in 04 (Tool = Playwright). **No
test in this plan is automated with Playwright yet**, because Playwright is not in the
repo.

**Already set up?** No. There is no `playwright.config.*`, no `@playwright/test` in
`package.json` and no browsers installed. **Ask the team before adding it.** AGENTS.md does
not ban it, but it changes `package.json`, which every member shares.

### Option A — add to the repo (after team agreement, in its own PR)

```bash
npm init playwright@latest
# choose: TypeScript, tests folder = tests/playwright, no GitHub Actions, install browsers = yes
```

### Option B — try it without touching the repo

```bash
mkdir ~/mims-playwright && cd ~/mims-playwright
npm init playwright@latest
```

Windows: run the same commands in PowerShell. Browsers download to your user folder.

### Use

```bash
npx playwright install                    # download Chromium/Firefox/WebKit (once)
npx playwright test                       # run all tests
npx playwright test tests/playwright/sign-in.spec.ts   # run one file
npx playwright test --headed              # watch the browser
npx playwright show-report                # open the HTML report
npx playwright codegen http://localhost:3000/sign-in   # record a new test by clicking
```

**Recording a test with codegen:** start the app (`npm run dev`), run the codegen command,
sign in as `agent_c1` in the window that opens, and click through the workflow (for example
WF-CUS-01). Copy the generated code into a new `.spec.ts` file. Add `expect(...)` checks
for the expected result in the 04 table.

Good first candidates: WF-AUTH-01…05 (sign-in), WF-CUS-01/02 (register + duplicate),
WF-ACC-01 (open account), WF-RPT-01 (RPT-01 filter + CSV), and all UI-MOCK rows.

---

## 6. curl

**Used for:** every `API-…` test in 05, and the API steps inside `WF-TXN-…`, `WF-FD-…` and
`WF-INT-…`. Those workflows have **no working UI**, because the transaction, FD and
interest pages are mockups.

**Already set up?** curl ships with macOS and Windows 10/11. On Windows, use
**`curl.exe`** in PowerShell, because plain `curl` is an alias for `Invoke-WebRequest`. Or
use Git Bash, where the examples work unchanged.

### How authentication works (read this once)

1. `POST /api/auth/login` returns two cookies:
   - `mims_session` — the session (HttpOnly).
   - `mims_csrf` — a 64-character hex token (readable).
2. Every **state-changing** request (POST/PATCH/PUT) must send the same value in the
   header **`x-csrf-token`**, together with both cookies. This is the "double-submit cookie"
   pattern in `lib/auth/csrf.ts`. A missing or different token gives `403 FORBIDDEN`.
3. Money-moving POSTs (deposits, withdrawals, account opening) also need an
   **`Idempotency-Key`** header. Repeating the same key must **not** post twice.

```bash
# 1. Sign in and save cookies (replace <password> with the one in database/seed/02_users.sql)
curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"agent_c1","password":"<password>"}' \
  http://localhost:3000/api/auth/login

# 2. Read the CSRF token out of the cookie jar
CSRF=$(awk '$6=="mims_csrf"{print $7}' cookies.txt)

# 3. Call a protected endpoint
curl -s -b cookies.txt http://localhost:3000/api/accounts

# 4. Call a state-changing endpoint
curl -s -b cookies.txt -H "x-csrf-token: $CSRF" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ ... }' http://localhost:3000/api/transactions/deposits
```

PowerShell equivalent of step 2:

```powershell
$CSRF = (Select-String -Path cookies.txt -Pattern "mims_csrf").Line.Split("`t")[6]
```

Tip: pipe output into `| python3 -m json.tool` (or `jq`, if installed) to make it readable.

---

## 7. Postman

**Used for:** the same `API-…` tests with a GUI, saved as a shared team collection.

**Already set up?** No. Download from <https://www.postman.com/downloads/> (macOS `.zip` →
drag to Applications; Windows installer). A free account is enough. The web version
cannot reach `localhost`, so use the desktop app.

### Import the curl examples from 05

1. Open 05-API-AND-BACKEND-TEST-PLAN.md and copy one curl example.
2. Postman → **Import** (top left) → **Raw text** → paste → **Continue** → **Import**.
3. The request opens with method, URL, headers and body filled in.
4. **Save** (Ctrl/⌘+S) → *New collection* → name it `MIMS API tests` → save the request
   under a folder per area (Auth, Customers, Accounts, Transactions, Reports…).

### Environment

1. **Environments** (left sidebar) → **+** → name `MIMS local`.
2. Add variables:

| Variable | Initial value |
|---|---|
| `baseUrl` | `http://localhost:3000` |
| `username` | `agent_c1` |
| `password` | (the seed password, kept in your own copy only) |
| `csrf` | (empty — filled by the script below) |

3. Select `MIMS local` in the environment drop-down (top right).
4. Replace `http://localhost:3000` in your requests with `{{baseUrl}}`.

### Cookies and the CSRF token

Postman stores cookies automatically per domain. After calling **Login**, check them under
**Cookies** (below the Send button) → `localhost`.

Add this to the **Login** request → **Scripts → Post-response**:

```javascript
const csrf = pm.cookies.get("mims_csrf");
pm.environment.set("csrf", csrf);
```

Then in every POST/PATCH/PUT request add the header `x-csrf-token: {{csrf}}`. For
deposits/withdrawals/account opening also add `Idempotency-Key: {{$guid}}`. To test
**replay**, type a fixed value instead, e.g. `demo-key-001`, and send twice.

To switch role, change `username` in the environment and send Login again. Login replaces
both cookies.

### Collection runner

**Collections → MIMS API tests → Run** runs the saved requests in order. Add simple checks
in each request's *Post-response* script, for example:

```javascript
pm.test("status is 403", () => pm.response.to.have.status(403));
```

Export the collection (… → **Export**) and share the JSON in the team drive, **not** in
git if it contains passwords.

---

## 8. pgAdmin (optional GUI for the 06 queries)

**Used for:** the same queries as `psql`, if you prefer a GUI.

**Install:** included with the Windows PostgreSQL installer. On macOS:
`brew install --cask pgadmin4` or download from <https://www.pgadmin.org/download/>.

**Connect:**

1. Right-click **Servers → Register → Server…**
2. *General → Name:* `MIMS local`.
3. *Connection:* Host `localhost`, Port `5432`, Maintenance database `mims_dev`, Username
   `mims_app` (or `mims_owner` for owner-only tests), Password = the one in your `.env`.
4. Save → expand **Databases → mims_dev → Schemas → public**.
5. **Tools → Query Tool** → paste a query block from 06 → **Execute (F5)**.

pgAdmin runs each execution in its own transaction unless auto-commit is off. Keep the
`BEGIN; … ROLLBACK;` lines from 06 so nothing is saved. Turn **off** *Auto commit* in the
Query Tool toolbar drop-down for safety.

---

## 9. Google Sheets (team tracker)

**Used for:** recording Status (Pass/Fail) for every test in `08-TEST-TRACKER.csv`.

1. Open <https://sheets.google.com> → **Blank spreadsheet** → name it
   `MIMS test tracker`.
2. **File → Import → Upload** → choose `docs/testing/08-TEST-TRACKER.csv`.
3. Import location: **Replace current sheet**. Separator: **Detect automatically**
   (comma). Untick *Convert text to numbers, dates and formulas*. → **Import data**.
4. **View → Freeze → 1 row**, so the header stays visible.
5. **Share** (top right) → add the four teammates' emails as **Editor** → Send.

### Status drop-down (Data validation)

1. Select the whole **Status** column (click the column letter), then Ctrl/⌘-click the
   header cell to unselect it.
2. **Data → Data validation → Add rule**.
3. *Criteria:* **Dropdown** → options `Not run`, `Pass`, `Fail`, `Blocked`.
4. *If the data is invalid:* **Reject the input** → **Done**.

Repeat for **Tester** with the five names, if you like.

### Colour Pass / Fail (conditional formatting)

1. Select the Status column again.
2. **Format → Conditional formatting**.
3. Rule 1: *Text is exactly* `Pass` → green fill → **Done**.
4. **Add another rule:** *Text is exactly* `Fail` → red fill.
5. Optional: `Blocked` → yellow, `Not run` → grey.

Optional: **Data → Create a filter**, so each tester can filter by their name.

---

## 10. Static checks (already in the repo)

```bash
npm run lint        # ESLint 9, config eslint.config.mjs
npm run typecheck   # tsc --noEmit
npx next build      # production build into .next (does not disturb the dev server's .next-dev)
```

Results from the documentation run are in `07-STATIC-REVIEW-FINDINGS.md`.

---

## Before the team testing session — checklist

Every member ticks every line **before** the session:

- [ ] `node -v` shows v22.x (v20.x also works) and `npm install` finished without errors.
- [ ] `psql --version` shows 15 or 16+; `which initdb pg_ctl` (Windows: `where initdb`)
      finds both.
- [ ] `.env` exists (copied from `.env.example`) with your own local passwords and secrets.
      **Do not share it.**
- [ ] `npm run db:create` done once; `npm run db:rebuild` finished; `npm run db:verify`
      shows all checks passing.
- [ ] `npm run dev` starts and <http://localhost:3000> redirects to `/sign-in`.
- [ ] You can sign in as `admin`, `agent_c1` and `bm_colombo` (password from
      `database/seed/02_users.sql`).
- [ ] Chrome installed; you can open DevTools and see the Network and Console tabs.
- [ ] curl works (`curl --version`; Windows: `curl.exe --version`). Postman desktop is
      optional.
- [ ] `psql` (or pgAdmin) connects to `mims_dev` as `mims_app` and `\dt` lists about 25 tables.
- [ ] You can open the shared Google Sheet and edit the Status column.
- [ ] Optional: `LC_ALL=en_US.UTF-8 npm test` runs to the end on your machine (takes
      several minutes).
- [ ] **Business hours:** deposits and withdrawals are refused outside business hours.
      The database allows 08:30–17:00 Asia/Colombo (`system_parameter`
      `BUSINESS_HOUR_START` / `BUSINESS_HOUR_END`), unless a `business_calendar` row says
      otherwise. If the session is outside those hours, an ADMIN must widen them first
      (see WF-ADM-03 in 04).
- [ ] Before you start, agree who resets the database. `npm run db:rebuild -- --reset`
      wipes `mims_dev`.
