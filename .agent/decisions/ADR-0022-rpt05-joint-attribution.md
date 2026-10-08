# ADR-0022: RPT-05 joint-account attribution

**Date:** 2026-10-08  
**Status:** Accepted for P05-M04-T01/T02 by the user

The user confirmed that each holder of a joint savings account receives that account's activity in RPT-05. The report therefore has one customer/account/transaction row per holder. A total across customer rows is a **holder-attributed total** and can exceed the bank's distinct-ledger total. The page and API must label this meaning; it must not be presented as a bank reconciliation total.

Compensating REVERSAL entries are reported on their own transaction date as a negative amount in the original transaction's category. Thus deposits, withdrawals, interest and net remain consistent with posted reversals for any date range. The report uses transaction_date because the ledger has no posted_at or status column.

This decision authorizes the user-requested RPT-05 work only. It does not approve general Phase 5 entry or another report.
