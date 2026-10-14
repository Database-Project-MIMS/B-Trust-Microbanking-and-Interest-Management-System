# 11 — UI Rules

A lightweight professional banking admin UI. The UI exists so a QA tester can exercise and
demonstrate the database. Dense, legible, low-decoration. **Do not over-engineer the
frontend at the expense of the database.**

Current design tokens live in `app/globals.css`. Read these rules before building
UI and record `/imprint` guidance here; the former root `ui-registry.md` was retired
by the project cleanup.

## New password field — 2026-10-13 /imprint

File: `components/mims/new-password-input.tsx`. Used by agent creation,
Users and access (including optional customer logins), and reset-password.

Reuses `field` labels, `input` styling and native `small` help with existing muted
text/spacing. Guidance is linked with a unique `aria-describedby`; existing
descriptions are preserved. Native min/max/pattern and tooltip share the server
policy: 8–128 characters plus uppercase/lowercase/number/symbol. Optional password
changes permit an empty field, which the form omits. Required creation/reset fields
remain required. Use `new-password` autocomplete; sign-in retains `current-password`.
No new colors, radius, typography, shadow or dependency.

---

## Shared layout

Every authenticated page uses the app shell (`components/app-shell/`, **owned by M1**):

```
┌──────────────────────────────────────────────┐
│ B-Trust MIMS      [branch]   user ▾  Sign out │
├────────────┬─────────────────────────────────┤
│ Nav        │ Page title                       │
│ Dashboard  │ ┌─────────────────────────────┐ │
│ Customers  │ │ content                     │ │
│ Accounts   │ └─────────────────────────────┘ │
│ Transactions                                  │
│ Fixed Dep. │                                  │
│ Reports    │                                  │
│ Admin      │                                  │
└────────────┴─────────────────────────────────┘
```

Navigation is **role-aware**: sections the user cannot access are not rendered. This is
convenience, not security — the server authorizes every request regardless (BR-S1).

## Forms

- One column. Label above the field. Related fields grouped with a heading.
- Required fields carry a visible marker **and** the label says so — colour is never the
  only indicator (SRS §3.1).
- Validation on blur for format, on submit for everything. Errors appear **beside the
  field**, not only in a banner.
- Error text is plain language: "Amount must be greater than zero", never
  `ERR_CHECK_VIOLATION` or a SQL message (NFR-SEC-05).
- **Every financial action requires a confirmation step** showing account, amount and
  resulting balance before it is committed (NFR-USE-02).
- Submit buttons disable while in flight and show a spinner — this is also the first line
  of defence against accidental double submission (the real one is the idempotency key).

## Tables

- Column headers in `--surface-muted`, sticky on scroll.
- **Monetary columns are right-aligned with tabular figures.** Always `LKR 1,234.56`.
- Credits `+` in `--credit`, debits `−` in `--debit`, **with the sign as well as the
  colour**.
- Sortable columns only where the server supports it — sort keys come from a server-side
  allow-list (NFR-SEC-02).
- Server-side pagination, default 25 rows. Never load a full report into browser memory
  (REP-COM-05).
- Empty state is an explicit message ("No transactions in this date range"), not a blank
  area.

## Dialogs

Used for confirmation and short forms only; anything longer gets its own page. Focus traps
on open, `Esc` closes, focus returns to the trigger. Destructive or financial confirmations
name the exact effect: "Withdraw LKR 5,000.00 from 100-2-0000123? Balance will be LKR
12,340.00."

## Validation and errors

| Situation | Behaviour |
|---|---|
| Field format invalid | Inline message on blur |
| Business rule violated (`409`) | Message beside the relevant field where possible, else at the top of the form |
| Not authorized (`403`) | "You do not have access to this action." No hint about what exists |
| Session expired (`401`) | Redirect to sign-in, preserving the intended destination |
| Server error (`500`) | Generic apology + a correlation id. **Never** a stack trace or SQL |

Error messages must not reveal whether a record exists when the user is not entitled to
know (FR-AUTH-03 applies the same idea to sign-in).

## Money and dates

- Amounts: `LKR 1,234.56` — thousands separators, exactly two decimals.
- **Money arrives from the API as a string and is never parsed into a JavaScript number**
  for arithmetic. Format for display only; all arithmetic happens in SQL.
- Dates `DD MMM YYYY`; timestamps `DD MMM YYYY HH:mm`, Asia/Colombo.

## Responsiveness

Desktop-first — this is an admin tool. Usable down to a 768px tablet: navigation collapses
to a drawer, tables scroll horizontally rather than reflowing (a misaligned financial table
is worse than a scrolling one).

## Accessibility

Every input has a `<label>`. Interactive elements are keyboard-reachable in a sensible
order with a visible focus ring. Contrast ≥ 4.5:1 for text. Status is conveyed by text or
icon **in addition to** colour. Errors are announced via `aria-live`.

## Consistency

1. Check `../ui-registry.md` for an existing component before building a new one.
2. Use only the defined tokens. No new colour, spacing value or radius without updating the
   registry.
3. After building, run **`/imprint`** and record the component.
4. If two members build similar components, **M1 resolves** and one is removed.

## What not to build

No dashboards with animated charts, no dark mode, no design-system dependency, no
client-side state management library, no icon library beyond `lucide-react` if needed. Time
spent here is time not spent on the database.

## Customer transfer and Method forms — 2026-10-14 /imprint

Files: app/transactions/transfer/customer-transfer-screen.tsx and
app/transactions/posting-screen.tsx. Reuse page-header/page-title/page-description,
card, confirmation-card, field/input, amount and btn-primary/btn-secondary tokens;
space-y-4 fields and space-y-6 page sections. No new visual tokens.

Customer source is a native select of owned active accounts; recipient is a required
account-number input, with no account search or recipient details. Review names source,
recipient and exact formatted amount. Posting disables controls, retains the retry key,
shows a source-only receipt and catches network failures. Empty source lists show an
explicit message. Staff methods use labeled Cash/Cheque options and show the method
in confirmation. Customer menus/dashboard show Transfers and exclude Withdraw.
