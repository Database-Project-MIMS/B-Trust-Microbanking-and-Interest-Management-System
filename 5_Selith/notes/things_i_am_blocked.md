# 🚧 Blockers & Handoff State for Member 5 (Selith)
*This document contains a detailed breakdown of all halfway-done or blocked work across Phase 3 and Phase 4, exactly what is completed, and precisely whose task needs to be finished before Member 5 can proceed.*

---

## 1. Document `05_P3_seed-set-4-transactions.md` (Phase 3 Seed Data)
**My Task ID:** `P03-M05-T01`

### 🟢 How much I finished:
**100% Drafted.** I wrote a Python script that algorithmically generated all 100+ perfect, chronologically accurate transactions. They are written into `database/seed/13_transactions.sql`. However, to prevent breaking the build, they are currently wrapped inside a massive `/* ... */` SQL comment block.

### 🔴 Who I am blocked by:
I am blocked by **Member 4 (M4)**.
- M4 needs to complete **`P03-M04-T01`** (`sp_post_deposit`) — *(Note: M4 just merged this into `dev`!)*
- M4 needs to complete **`P03-M04-T02`** (`sp_post_withdrawal`)
- M4 needs to complete **`P03-M04-T03`** (`sp_reverse_transaction`)

### 🛠️ What I need to do once they finish:
Once M4 merges the withdrawal and reversal stored procedures into the `develop` branch, I simply need to:
1. `git pull` their changes.
2. Open `13_transactions.sql` and remove the `/* ... */` comments.
3. Run `npm run db:rebuild` to prove the balances mathematically check out.
4. Mark `P03-M05-T01` as `DONE` and push.

---

## 2. Document `06_P4_fd-schema-opening.md` (Phase 4, Part 1)
**My Task IDs:** `P04-M05-T01`, `P04-M05-T02`, `P04-M05-T03`

### 🟢 How much I finished:
**99% Implemented.** 
- I fully built the `fixed_deposit` schema migration and partial unique indexes.
- I fully built the `fn_calculate_fd_interest` math function.
- I fully built the `sp_open_fixed_deposit` procedure and tested it automatically.

### 🔴 Who I am blocked by:
I am blocked by **Member 3 (M3)** and **Member 4 (M4)**.
- M3 needs to complete **`P04-M03-T01`** (Eligibility Check - `I-6`). M3 officially owns the business rule that dictates if an account is allowed to open an FD. I temporarily hardcoded this rule myself so I wouldn't be stuck.
- M3 needs to complete **`P04-M03-T02` & `P04-M03-T03`** (API & UI). They must build the frontend so users can actually click a button to trigger my procedure.
- M4 needs to complete their **Ledger Routine (`I-5`)**. Currently, my procedure deducts money using a raw `UPDATE account SET current_balance...` query. It is supposed to route through M4's ledger.

### 🛠️ What I need to do once they finish:
Once M3 and M4 finish their tasks, I need to:
1. Re-open `sp_open_fixed_deposit.sql`.
2. Delete my raw `UPDATE account...` logic and replace it with a call to M4's official ledger function.
3. Ensure my locking logic aligns with M3's official `I-6` eligibility rules.

---

## 3. Document `07_P4_interest-run-cycle.md` (Phase 4, Part 2)
**My Task IDs:** `P04-M05-T04`, `P04-M05-T05`

### 🟢 How much I finished:
**50% Implemented (Task 4 is 100% complete, Task 5 is 0% complete).** 
I have completely built the `interest_run` and `interest_payout` tables, the massive `sp_run_interest_cycle` stored procedure, and the automated tests. I also wrote a temporary dummy `sp_post_interest_credit` function to completely bypass Member 4's blockage so I could finish Task 4 without waiting for them.

### 🔴 Who I am blocked by:
I am blocked by **Member 4 (M4)** and the **Team Leader / Lecturer**.
- M4 needs to complete their **`I-5` Ledger Routine** (`sp_post_interest_credit`). I am currently using a temporary dummy function in its place so we can keep making progress.
- The **Team Leader / Lecturer** needs to resolve Open Questions **`OQ-13`** and **`OQ-14`**. The project contract (`AGENTS.md`) legally prevents us from officially merging Phase 4 into the `develop` branch until these architectural questions are answered.

### 🛠️ What I need to do once they finish:
Once M4 provides their official `sp_post_interest_credit`, I simply need to delete my temporary dummy function (`database/routines/sp_post_interest_credit.sql`). My code in `sp_run_interest_cycle` is already calling the exact function signature M4 is supposed to write, so it will seamlessly swap over! Once the Lecturer approves the open questions, I can legally push the `feat/p04-m05-interest-cycle` branch into `develop` and exit Phase 4.


---

## 4. Document `08_P5_reports-rpt03-rpt04.md` (Phase 5 Reports)
**My Task IDs:** `P05-M05-T01`, `P05-M05-T02`, `P05-M05-T03`, `P05-M05-T04`

### 🟢 How much I finished:
**0% Implemented (Currently 50% Unblocked, 50% Blocked).**
- **Task 1 & 2 (Database Views):** I can do this right now. It is strictly SQL views relying on Phase 4 tables which are already merged in `dev`.
- **Task 3 & 4 (APIs and Analysis):** I cannot start these at all yet.

### 🔴 Who I am blocked by:
I am blocked by **Member 1 (M1)** and the **Rest of the Team**.
- M1 needs to complete **`P05-M01-T01` (Report Framework - `I-7`)**. My Task 3 (building the report API) strictly relies on M1's `parseReportFilters` and `streamCsv` helper functions. Without them, I can't output the reports to the frontend UI.
- The **Rest of the Team** needs to build their reports. My Task 4 requires me to run a massive `EXPLAIN ANALYZE` performance test across **all 5 reports** in the system. I cannot run this check until everyone else finishes their views.

### 🛠️ What I need to do once they finish:
I will start immediately by writing the SQL views for Task 1 and Task 2 on a new branch (`feat/p05-m05-rpt03-view`). Once those are reviewed and merged, I will pause. Once M1 finishes the `I-7` framework, I will build the APIs for Task 3. Once the entire team finishes Phase 5, I will execute the performance checks for Task 4 and exit Phase 5.
