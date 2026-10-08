# UI Registry — MIMS

> Maintained by the `/imprint` skill. **Read this before building any UI component.**
> After building a component, run `/imprint` and add its entry here.
>
> Purpose: five people building UI in parallel will produce five different-looking
> applications unless every component is built with awareness of what already exists.

**Status:** Emerald visual refresh approved by the user on 27 Sep 2026. This supersedes
the earlier restrictions on decorative surfaces and animation. Financial and security rules remain in force.

## Current visual system — Emerald studio

The source of current tokens is `app/globals.css`: primary `#16644c`, hover `#0c4735`,
text `#18352c`, muted text `#61756c`, muted surface `#f4f7f5`, border `#dfe8e3`.
Mint accents use `#cdfa92`; dark emerald branding uses `#092c24` through `#236d53`.
Cards use 18px radii, inputs/buttons 10px, hero panels 22–24px. Gradients and soft
shadows are approved for branding and emphasis. The entries below describe the previous
baseline; this section supersedes conflicting values.

`components/motion-surface.tsx` owns GSAP entrance staggering and the sign-in orbital
animation, scopes selectors to its root, cleans up on unmount, and disables animations
for `prefers-reduced-motion`. Content remains visible if scripting fails.

Sign-in uses a split brand/form composition with a single-column layout below 760px.
Dashboard navigation cards use role-filtered links and show no invented financial data.

---

## How to use

1. Before building: search this file for a similar component. Reuse or extend it.
2. If nothing matches, build it using the tokens below.
3. After building, run `/imprint` and record the component here.
4. Never introduce a new colour, spacing value or radius that is not in the tokens.

---

## Design tokens

The application is a **lightweight professional banking admin UI**. Dense, legible,
low-decoration. Clarity over personality.

### Colour

| Token | Value | Use |
|---|---|---|
| `--surface` | `#ffffff` | Page and card background |
| `--surface-muted` | `#f6f7f9` | Table header, page background, disabled |
| `--border` | `#e2e5ea` | All borders and dividers |
| `--text` | `#14181f` | Primary text |
| `--text-muted` | `#5b6472` | Labels, help text, metadata |
| `--primary` | `#12508a` | Primary action, active nav, links |
| `--primary-hover` | `#0e3f6e` | Primary hover |
| `--credit` | `#1a7f4b` | Deposits, interest credits, positive amounts |
| `--debit` | `#b3261e` | Withdrawals, negative amounts |
| `--warning` | `#8a5a00` | Pending, requires approval |
| `--danger` | `#b3261e` | Destructive actions, validation errors |

**Colour is never the only indicator** (SRS §3.1). Every state also carries a text label
or icon.

### Typography

| Role | Spec |
|---|---|
| Page title | 24px / 600 |
| Section heading | 18px / 600 |
| Body | 14px / 400 |
| Label | 13px / 500, `--text-muted` |
| Table cell | 14px / 400 |
| **Monetary values** | 14px / 500, **tabular-nums**, right-aligned |
| Code / reference numbers | 13px monospace |

### Spacing

4px scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Card padding `24`. Form field gap `16`.
Table cell padding `12` vertical, `16` horizontal.

### Radius and elevation

Radius `6px` for inputs and buttons, `8px` for cards. One shadow only:
`0 1px 2px rgba(0,0,0,0.06)`. No gradients, no glassmorphism.

### Money formatting

Always `LKR 1,234.56` — thousands separators, exactly two decimals, right-aligned,
tabular figures. Credits prefixed `+`, debits prefixed `−`. Never round for display in a
way that disagrees with the stored `NUMERIC(15,2)` value.

### Dates

`DD MMM YYYY` for dates, `DD MMM YYYY HH:mm` for timestamps, Asia/Colombo.

---

## Components

### Database health and parameter controls

Files: `app/admin/health/page.tsx`, `app/admin/parameters/page.tsx`,
`app/admin/parameters/parameter-admin.tsx`, `components/app-shell/top-bar.tsx`
Last updated: 05 Oct 2026 · captured with `/imprint` during Phase 1 closeout.

Health uses the existing `.page-header`, `.page-title`, `.section-heading` and `.card`
patterns. Its metric grid stacks below `sm`; filenames wrap. Connection state includes
text, and unavailable data renders a safe `role="alert"` message. Only ADMIN/CENTRAL_OPS
receive server-authorized access and the navigation link.

Parameter controls are ADMIN-only, with token-based surface/border/text colors,
`.input` and `.btn` patterns, an accessible parameter-value label, loading/saving states,
and announced error/success messages. Edits send the login-issued CSRF token. These
pages reuse the existing authenticated shell; role-aware links supplement server checks.

### App shell

File: `components/app-shell/app-shell.tsx`, `components/app-shell/top-bar.tsx`
Last updated: 27 Sep 2026

| Property | Pattern |
| --- | --- |
| Background | `bg-[var(--surface-muted)]`; header `bg-[var(--surface)]` |
| Border | `border-[var(--border)]` |
| Text | primary `text-[var(--text)]`; secondary `text-[var(--text-muted)]` |
| Spacing | page `px-4 py-8`, desktop `sm:px-6 lg:px-8` |
| Active navigation | `bg-[var(--primary)] text-white` |

Role-aware links are for convenience only; the server still authorizes every request.

### Card, form field, and button

File: `app/globals.css`
Last updated: 27 Sep 2026

| Property | Pattern |
| --- | --- |
| Card | white surface, `1px var(--border)`, `8px` radius, 24px padding |
| Input | white surface, `1px var(--border)`, `6px` radius, visible primary focus ring |
| Primary button | `--primary`, white text, `6px` radius |
| Secondary button | white surface with `--border` outline |
| Form errors | text and border `--danger`, announced with `aria-live` |

### Data table and empty state

File: `app/fd-products/FdProductClient.tsx`, `components/organization/organization-table.tsx`
Last updated: 27 Sep 2026

| Property | Pattern |
| --- | --- |
| Table header | `--surface-muted`, sticky where scrolling applies |
| Cell padding | 12px vertical, 16px horizontal |
| Monetary/rate display | `.amount`, right aligned and tabular figures |
| Empty state | explicit text in a full-width table cell |

Tables remain horizontally scrollable on narrower screens instead of reflowing.

### Page header and action card

File: `app/globals.css`, `app/dashboard/page.tsx`
Last updated: 27 Sep 2026

| Property | Pattern |
| --- | --- |
| Header | `.page-header` with a bottom `--border` divider and 24px lower spacing |
| Title | `.page-title`: 24px, 600 weight, slightly tight tracking |
| Context label | `.eyebrow`: uppercase `--primary`, 12px, bold and letter-spaced |
| Navigation card | `.app-card-link`: normal card with a 3px `--primary` top border |
| Interaction | 150ms colour/shadow transition; card lift is limited to 2px |

This adds hierarchy and feedback without decorative animation, gradients, or colours outside
the approved token set.

Each entry, once built, must record: purpose · file path · props · variants · states
(default / hover / focus / disabled / loading / error) · spacing · where it is used.

### MIMS workflow surfaces

File: `components/mims/workflow-screen.tsx`, `app/globals.css`
Last updated: 27 Sep 2026

| Property | Pattern |
| --- | --- |
| Purpose | Frontend-only API-shaped screens for customers, accounts, transactions, fixed deposits, interest operations, audit, reconciliation and all five reports. |
| Props / variants | `WorkflowScreen` accepts a route-specific `kind`; `Field`, `SelectField`, `Status`, `Money`, tables, report filters and confirmation cards are shared internally. |
| States | Native focus/required states; static representative records; financial forms have review/confirmation before the final API action; status pills always include text. |
| Spacing | Forms use 16px field gaps and 28px sections; cards use the global 24px padding; screen sections have 24px top separation. |
| Responsive behaviour | Tables retain a scrollable minimum width; detail and metric grids collapse to one column; filter bars stack on small screens. |

These screens only describe expected request inputs and outcomes. They contain no database access, financial calculation, client-side authorization, or live posting logic.

### Organisation administration

File: `components/organization/organization-table.tsx`, `app/branches/page.tsx`, `app/agents/page.tsx`
Last updated: 29 Sep 2026

| Property | Pattern |
| --- | --- |
| Purpose | Live branch and ordinary-agent administration through the authorised APIs. |
| Props / variants | `OrganizationTable` accepts `resource` (`branches` or `agents`) and the server-validated `roleName`; roles control whether create and deactivate actions render. |
| States | Loading, active/all filter, empty, create form, saving, success, safe error and deactivation confirmation. |
| Forms | One logical column of sections, using the shared two-column field grid on wider screens; every field has a visible required label. |
| Destructive action | Deactivation names the exact record, retains history and requires confirmation; there is no delete control. |
| Responsive behaviour | Toolbars stack and tables scroll horizontally on narrow screens. |

### Customer registration, search and profile

Files: `app/customers/customer-list.tsx`, `app/customers/new/customer-registration.tsx`,
`app/customers/[id]/customer-profile.tsx`
Last updated: 7 Oct 2026 · /imprint

| Property | Class / existing token |
|---|---|
| Background / border | `card`, `input`; `--surface`, `--border`, inherited Emerald workspace |
| Radius / shadow | Existing card 18px, input/button 10px; card shadow from globals.css |
| Text | `page-title`, `eyebrow`, `field`, `muted`, `section-heading`; `--text`, `--text-muted` |
| Spacing | 24px card padding / `mt-6`, 28px `form-grid`, 16px `form-section`/`two-col` |
| Actions / focus | `btn btn-primary`, `btn btn-secondary`, existing primary hover/focus rules |
| Errors / states | `--danger` with role=alert; role=status loading, explicit empty rows; retry actions |
| Tables / money | `table-wrap`, `data-table`, `status-pill`, `amount`; string-only currency formatting |

Use named branch/agent selects populated on the server, session-derived registration
branch, visible required labels, disabled saving fields and preserved inputs after failure.
Metadata references are editable; profile DTOs omit document paths. Mask sensitive identity
on the server. Optional account links and empty states replace prototype values.
Existing two-column forms collapse below 640px; tables scroll inside their containers.
Browser checks cover live registration/search/profile, duplicate errors and a narrow
viewport with no document overflow. No shared styling or shell component was changed.

### Account opening, list, detail and savings plans

Files: `app/accounts/account-list.tsx`, `app/accounts/new/account-opening.tsx`,
`app/accounts/new/customer-picker.tsx`, `app/accounts/[id]/account-detail.tsx`,
`app/plans/SavingsPlanClient.tsx`, display helpers in `app/accounts/account-format.ts`
Last updated: 7 Oct 2026 · /imprint

| Property | Class / existing token |
|---|---|
| Background / border | `card`, `input`, `table-wrap`; `--surface`, `--border`; balance uses the existing `balance-card` |
| Radius / shadow | Existing card 18px, input/button 10px; no new radius or shadow |
| Text | `page-title`, `eyebrow`, `section-heading`, `field`, `muted`; `--text`, `--text-muted`; danger text `text-[var(--danger)]` |
| Spacing | `mt-6` between cards, 28px `form-grid`, 16px `form-section`/`two-col`, `flex gap-2/3` for button rows |
| Actions / focus | `btn btn-primary` for the single main action, `btn btn-secondary` for the rest; existing focus ring |
| States | `role="status"` loading and success, `role="alert"` errors with Retry, explicit empty table rows, buttons disabled while in flight, inputs preserved after a failure |
| Tables / money | `data-table` in `table-wrap`, `status-pill` (text always present), `amount` for money; rates and money formatted from strings only |
| Review step | Reuses `confirmation-card` with a `dl` summary before any financial action (NFR-USE-02) |
| Dialog (plans edit) | Fixed overlay `bg-black/50`, `card` panel, `role="dialog"` + `aria-modal`, focus moves in on open and is **trapped** (Tab/Shift+Tab wrap), `Esc` closes and focus returns to the trigger; field errors appear beside the field with `role="alert"` and `aria-invalid` after the first save attempt |

**Pattern notes**

- Server `page.tsx` authorises with `requirePageRole`, loads reference data (plans) and passes it down;
  client components fetch the T05 API through `account-client.ts` (`accountRequest` never throws on
  HTTP errors and returns the API's safe message).
- Logic lives in pure modules (`account-opening-model.ts`, `account-format.ts`) so it is unit-tested;
  components stay thin. Money, deposits and rates are never parsed into numbers for arithmetic.
- The wizard sends one `Idempotency-Key` per attempt and reuses it for an identical retry; a changed
  form gets a new key. A `200` reply means "already opened".
- Customer picking reuses the customer search API, so agents only see assigned customers.
- Deposit/withdraw buttons, the statement link and the FD panel are intentionally absent until
  Phases 3 and 4. The SavingsPlanClient previously used classes that do not exist in this theme
  (`tag`, `btn-ghost`, `text-on-surface`, `font-headline`); it now uses only the classes above.

### Agent daily activity

Files: `app/agents/[id]/activity/page.tsx`, `agent-activity-screen.tsx` in that folder;
directory links in `components/organization/organization-table.tsx`, self link in
`app/customers/page.tsx`. Updated 8 Oct 2026 · /imprint.

| Property | Existing class / token |
|---|---|
| Purpose / props | Live agent activity; agentId, initial Colombo today, server-selected backHref |
| Surface / hierarchy | Existing AppShell; page-header, eyebrow, page-title, page-description; card and section-heading |
| Filters / actions | Visible required labels with field/input, native date controls, two-col; btn-primary Show activity, btn-secondary Today/Retry |
| Spacing | space-y-6 between sections, shared card padding, mt-6 and flex gap-3 button row |
| Context | Current branch label, applied inclusive dates; workflow-notice explains attribution, scope and type totals |
| Results | table-wrap/data-table, caption and column/row headers; tabular-nums count, amount using existing displayMoney string formatter |
| States | role=status loading/empty; role=alert safe error and Retry; disabled date controls/actions while loading; superseded reads aborted |
| Responsive | Date fields stack under 640px; table scrolls within the card; verified narrow page has no document overflow |
| Focus / color | Existing global focus ring and primary/danger/text-muted tokens; no new color, radius or shadow |

Today recomputes the Colombo date on click. Applied dates remain beside the result,
and new period loads hide stale totals. No sum across transaction types or account
balance is displayed. Browser QA covers populated/filtered/empty/denied/self views;
screenshots are local ignored test evidence, described in the T02 handoff.
