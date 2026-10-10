# 19 — Implemented API Permission Matrix

Independent contract used by the security suite; a completeness guard compares every exported route handler.
Allowed means the role reaches validation/business processing; valid-operation tests separately prove success.
Unauthenticated requests are denied except login, the public reset-CSRF initializer, token-authorized CSRF-protected password reset and CSRF-protected idempotent logout. Worker interest requests require their separate bearer credential.

Roles: ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM. SYSTEM is internal, not a human QA role.

| Method | Endpoint | Allowed roles | Input positions probed |
| --- | --- | --- | --- |
| POST | /api/auth/login | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | body.username, body.password, header.x-forwarded-for, header.user-agent |
| GET | /api/auth/reset | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | query.probe |
| POST | /api/auth/reset | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | body.token, body.password |
| POST | /api/admin/users/{id}/reset | ADMIN | path.id |
| POST | /api/auth/logout | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | cookie.mims_session |
| GET | /api/health | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | query.probe |
| GET | /api/branches | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | query.status |
| POST | /api/branches | ADMIN | body.branchCode, body.branchName, body.address, body.district, body.phone |
| PATCH | /api/branches/{id} | ADMIN | path.id, body.branchName, body.address, body.district, body.phone, body.status |
| GET | /api/agents | ADMIN, CENTRAL_OPS, BRANCH_MANAGER | query.status |
| POST | /api/agents | ADMIN, BRANCH_MANAGER | body.branchId, body.employeeNo, body.nicPassportNo, body.fullName, body.dateOfBirth, body.gender, body.phone, body.address, body.email, body.hiredDate, body.username, body.password |
| PATCH | /api/agents/{id} | ADMIN, BRANCH_MANAGER | path.id, body.branchId, body.employeeNo, body.nicPassportNo, body.fullName, body.dateOfBirth, body.gender, body.phone, body.address, body.email, body.hiredDate, body.status |
| GET | /api/agents/{id}/activity | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT | path.id, query.from, query.to |
| GET | /api/customers | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | query.q, query.name, query.nicPassportNo, query.branchId, query.agentId, query.status, query.sortBy, query.sortDirection, query.page, query.pageSize |
| POST | /api/customers | AGENT, BRANCH_MANAGER | body.fullName, body.nicPassportNo, body.dateOfBirth, body.gender, body.phone, body.address, body.email, body.branchId, body.agentId, body.documents.0.docType, body.documents.0.filePath |
| GET | /api/customers/{id} | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER | path.id |
| GET | /api/customers/{id}/fixed-deposits | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER | path.id, query.probe |
| POST | /api/customer-documents/{id}/verify | AGENT, BRANCH_MANAGER | path.id |
| GET | /api/plans | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | query.probe |
| PATCH | /api/plans/{id} | ADMIN, CENTRAL_OPS | path.id, body.interestRate, body.minBalance, body.description, body.minAgeYears, body.maxAgeYears, body.minHolders, body.maxHolders, body.requiresAllAdult, body.status |
| GET | /api/accounts | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | query.q, query.status, query.planId, query.branchId, query.sortBy, query.sortDirection, query.page, query.pageSize |
| POST | /api/accounts | AGENT, BRANCH_MANAGER | header.idempotency-key, body.planId, body.branchId, body.holders.0.customerId, body.holders.0.holderType, body.mandate.type, body.mandate.requiredSignatories, body.initialDeposit |
| GET | /api/accounts/{id} | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER | path.id |
| POST | /api/accounts/{id}/holders | BRANCH_MANAGER | path.id, body.customerId |
| POST | /api/accounts/{id}/close | BRANCH_MANAGER | path.id |
| GET | /api/accounts/{id}/transactions | AGENT, BRANCH_MANAGER, AUDITOR, CUSTOMER | path.id, query.page, query.pageSize |
| GET | /api/transactions/{id} | AGENT, BRANCH_MANAGER, AUDITOR, CUSTOMER | path.id |
| POST | /api/transactions/deposits | AGENT, BRANCH_MANAGER | header.idempotency-key, body.accountId, body.amount, body.channelId, body.narration |
| POST | /api/transactions/transfers | AGENT, BRANCH_MANAGER | header.idempotency-key, body.sourceAccountId, body.destinationAccountId, body.amount, body.signerCustomerIds.0, body.narration |
| POST | /api/transactions/withdrawals | AGENT, BRANCH_MANAGER, CUSTOMER | header.idempotency-key, body.accountId, body.amount, body.channelId, body.narration, body.onBehalfOfCustomerId, body.signerCustomerIds, body.signerCustomerIds.0 |
| POST | /api/transactions/{id}/reverse | BRANCH_MANAGER | path.id, header.idempotency-key, body.reason |
| GET | /api/fd-products | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, AUDITOR, CUSTOMER, SYSTEM | query.probe |
| PATCH | /api/fd-products/{id} | ADMIN | path.id, body.interestRate, body.status, body.description |
| GET | /api/fixed-deposits | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR, CUSTOMER | query.accountId, query.status, query.page, query.pageSize |
| POST | /api/fixed-deposits | AGENT, BRANCH_MANAGER, CENTRAL_OPS | header.idempotency-key, body.accountId, body.fdPlanId, body.principalAmount |
| GET | /api/fixed-deposits/quote | AGENT, BRANCH_MANAGER, CENTRAL_OPS | query.accountId, query.fdPlanId, query.principalAmount |
| GET | /api/interest-runs | ADMIN, CENTRAL_OPS, AUDITOR | query.probe |
| POST | /api/interest-runs | ADMIN, CENTRAL_OPS | body.cycleDate, body.dryRun, header.authorization |
| GET | /api/admin/users | ADMIN | query.q, query.roleName, query.page |
| POST | /api/admin/users | ADMIN | body.username, body.password, body.roleName, body.customerId, body.profile.branchId |
| PATCH | /api/admin/users/{id} | ADMIN | path.id, body.status, body.password, body.roleName |
| GET | /api/admin/parameters | ADMIN | query.probe |
| PUT | /api/admin/parameters/{key} | ADMIN | path.key, body.value |
| GET | /api/audit | ADMIN, AUDITOR | query.actorId, query.entityType, query.entityId, query.action, query.from, query.to, query.page, query.pageSize |
| GET | /api/reports/agent-transactions | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | query.from, query.to, query.branchId, query.agentId, query.accountId, query.planId, query.status, query.format, query.page, query.pageSize, query.sort, query.direction |
| GET | /api/reports/account-summary | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | query.from, query.to, query.branchId, query.agentId, query.accountId, query.planId, query.status, query.format, query.page, query.pageSize, query.sort, query.direction |
| GET | /api/reports/customer-activity | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | query.from, query.to, query.branchId, query.agentId, query.accountId, query.planId, query.status, query.format, query.page, query.pageSize, query.sort, query.direction |
| GET | /api/reports/active-fds | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | query.from, query.to, query.branchId, query.agentId, query.accountId, query.planId, query.status, query.format, query.page, query.pageSize, query.sort, query.direction |
| GET | /api/reports/interest-distribution | ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AUDITOR | query.from, query.to, query.branchId, query.agentId, query.accountId, query.planId, query.status, query.format, query.page, query.pageSize, query.sort, query.direction |

Read [endpoint contracts](05_api-and-pages.md) for payloads and success/error semantics. Branch and holder scope still applies to allowed roles.
