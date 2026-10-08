# ADR-0007: Customer login is optional

**Date:** 2026-09-29 · **Status:** Accepted

## Decision

Customers are primarily agent-managed and can exist without login credentials.
`customer` has its own surrogate `customer_id` primary key. It may optionally reference
`app_user` through a nullable, unique `app_user_id` foreign key when self-service access
is provisioned.

The relationship is therefore zero-or-one login per customer and zero-or-one customer
profile per linked application user. Customer registration does not create placeholder
usernames, passwords or authentication records.

## Why

The brief describes customers conducting business through regional service agents, while
the SRS makes customer self-service conditional. Requiring a login for every customer
would create unused credential-bearing accounts and collect authentication data that is
not needed for agent-managed customers.

An optional link supports the current staff-operated system and allows inquiry-only
customer access to be added later without changing customer identity or downstream
foreign keys.

## What it rules out

- Using `customer.customer_id` as both the customer PK and an `app_user` FK
- Creating fake usernames or unusable password hashes during customer registration
- Requiring an `app_user` row before an agent can register a customer
- Using login identity as the permanent customer business identity

## Consequences

- `P02-M02-T01` creates `customer.customer_id` independently and adds nullable unique
  `app_user_id` with `ON DELETE RESTRICT`.
- Customer registration remains an agent/manager workflow and does not require login
  credentials.
- Any future customer portal provisioning must link an eligible `CUSTOMER` app user to
  the existing customer record without replacing its `customer_id`.
- Account ownership, documents, agent assignments and financial history reference
  `customer.customer_id`, never `app_user.user_id`.
