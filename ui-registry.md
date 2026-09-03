# UI Registry — MIMS

> Maintained by the `/imprint` skill. **Read this before building any UI component.**
> After building a component, run `/imprint` and add its entry here.
>
> Purpose: five people building UI in parallel will produce five different-looking
> applications unless every component is built with awareness of what already exists.

**Status:** Phase 0 — tokens defined, no components built yet.

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

_None yet. Phase 1 will add the first entries: App Shell, Sign-in Card, Data Table,
Form Field, Button, Badge, Empty State._

Each entry, once built, must record: purpose · file path · props · variants · states
(default / hover / focus / disabled / loading / error) · spacing · where it is used.
