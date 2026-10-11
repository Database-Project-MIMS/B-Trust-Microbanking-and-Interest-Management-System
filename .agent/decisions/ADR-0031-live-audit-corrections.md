# ADR-0031 — Live audit navigation and CSP corrections

Date: 2026-10-10. Status: accepted for local implementation by the user's request
to create a branch and fix the audit issues, followed by explicit cross-owner permission.

All five report pages already work; their discoverability is the defect. A guarded
`/reports` catalogue and shared report navigation expose them without changing API
permissions. Staff withdrawals and savings plans reuse their existing server role
gates. Account details link to the existing scoped statement route only after a
successful account load. No database migration or financial rule change is needed.

Use an enforced nonce CSP instead of allowing arbitrary inline JavaScript. Middleware
generates a fresh UUID-based nonce and replaces incoming nonce/CSP headers. The same
policy reaches Next.js and the response. Root `connection()` opts every HTML page into
request-time rendering so framework bootstrap scripts receive that nonce. This follows
the [Next.js 15 CSP guide](https://nextjs.org/docs/15/app/guides/content-security-policy).
Static HTML/ISR caching is consequently unavailable; banking workspaces already require
session-based rendering. Static JS/CSS assets keep their existing delivery and caching.

Production scripts allow only nonce-authorized execution with strict-dynamic; eval is
development-only for HMR. Styles retain unsafe-inline for existing React/GSAP styles.
Connections/forms/base URLs are same-origin; framing/plugins are denied. CSP applies
to routes and prefetch responses, excluding Next static/image assets and favicon.
No external analytics, script host or new dependency is introduced.

Verification uses a disposable PostgreSQL cluster and a production Next.js preview.
Live deployment, financial posting and privileged final-action acceptance remain separate.
Original file owners retain ownership. The user subsequently authorized a local commit
of the completed changes. Push, PR and deployment remain unauthorized.
