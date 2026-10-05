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
