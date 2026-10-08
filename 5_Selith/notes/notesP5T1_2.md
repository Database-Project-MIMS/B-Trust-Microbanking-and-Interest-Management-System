# Phase 5 - Reports (RPT-03 and RPT-04)

## Step 1: Creating RPT-03 Active FDs View
### What I Did
I created a new branch `feat/p05-m05-rpt03-view` and wrote the database view `vw_rpt03_active_fds` to power the "Active FDs" report. This view aggregates all fixed deposits, calculating the estimated next payout using our math function, and aggregating the names of all joint account holders into a single comma-separated string. I also committed the updated `things_i_am_blocked.md` document.

### Why I Did It
By using a SQL view, the backend API can query the massive report efficiently without having to join 6 different tables in JavaScript. Aggregating the `holder_names` directly in SQL saves the server from having to process N+1 queries. The `branch_id` is explicitly selected so that M1's `branchScope()` filter can be applied natively in the API's `WHERE` clause later.


## Step 2: Creating RPT-04 Interest Distribution View
### What I Did
I created the database view `vw_rpt04_interest_distribution` to power the monthly interest distribution report. This view specifically utilizes the `ROLLUP` SQL grouping function to automatically calculate the subtotals (by cycle, by savings plan, by product, and by branch) as well as the grand total directly within the PostgreSQL engine.

### Why I Did It
Using `ROLLUP` is explicitly required for grading (L13 SQL Technique), and it is incredibly powerful. By calculating all subtotals natively in PostgreSQL, the Node.js API doesn't have to loop over thousands of rows and perform math in JavaScript. The view returns exactly what the frontend table requires in a single query!
