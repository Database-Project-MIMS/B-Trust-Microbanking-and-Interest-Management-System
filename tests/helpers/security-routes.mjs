// Independent endpoint contract. New handlers must be added explicitly to this matrix.
export const roles = ['ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AGENT','AUDITOR','CUSTOMER','SYSTEM'];
const staffRead = ['AGENT','BRANCH_MANAGER','CENTRAL_OPS','AUDITOR'];
const detailRead = [...staffRead,'CUSTOMER'];
const reports = ['ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AUDITOR'];
const ledger = ['AGENT','BRANCH_MANAGER','AUDITOR','CUSTOMER'];
function route(path, method, allowed, fields = [], body = {}) {
  return { path, method, allowed, fields, body };
}
export const routes = [
  route('auth/login','POST',roles,['body.username','body.password','header.x-forwarded-for','header.user-agent']),
  route('auth/logout','POST',roles,['cookie.mims_session']),
  route('health','GET',roles,['query.probe']),
  route('branches','GET',['ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AUDITOR'],['query.status']),
  route('branches','POST',['ADMIN'],['body.branchCode','body.branchName','body.address','body.district','body.phone']),
  route('branches/[id]','PATCH',['ADMIN'],['path.id','body.branchName','body.address','body.district','body.phone','body.status']),
  route('agents','GET',['ADMIN','CENTRAL_OPS','BRANCH_MANAGER'],['query.status']),
  route('agents','POST',['ADMIN','BRANCH_MANAGER'],['body.branchId','body.employeeNo','body.nicPassportNo','body.fullName','body.dateOfBirth','body.gender','body.phone','body.address','body.email','body.hiredDate','body.username','body.password']),
  route('agents/[id]','PATCH',['ADMIN','BRANCH_MANAGER'],['path.id','body.branchId','body.employeeNo','body.nicPassportNo','body.fullName','body.dateOfBirth','body.gender','body.phone','body.address','body.email','body.hiredDate','body.status']),
  route('agents/[id]/activity','GET',['ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AGENT'],['path.id','query.from','query.to']),
  route('customers','GET',staffRead,['query.q','query.name','query.nicPassportNo','query.branchId','query.agentId','query.status','query.sortBy','query.sortDirection','query.page','query.pageSize']),
  route('customers','POST',['AGENT','BRANCH_MANAGER'],['body.fullName','body.nicPassportNo','body.dateOfBirth','body.gender','body.phone','body.address','body.email','body.branchId','body.agentId','body.documents.0.docType','body.documents.0.filePath']),
  route('customers/[id]','GET',detailRead,['path.id']),
  route('customers/[id]/fixed-deposits','GET',detailRead,['path.id','query.probe']),
  route('plans','GET',roles,['query.probe']),
  route('plans/[id]','PATCH',['ADMIN','CENTRAL_OPS'],['path.id','body.interestRate','body.minBalance','body.description','body.minAgeYears','body.maxAgeYears','body.minHolders','body.maxHolders','body.requiresAllAdult','body.status']),
  route('accounts','GET',staffRead,['query.q','query.status','query.planId','query.branchId','query.sortBy','query.sortDirection','query.page','query.pageSize']),
  route('accounts','POST',['AGENT','BRANCH_MANAGER'],['header.idempotency-key','body.planId','body.branchId','body.holders.0.customerId','body.holders.0.holderType','body.mandate.type','body.mandate.requiredSignatories','body.initialDeposit']),
  route('accounts/[id]','GET',detailRead,['path.id']),
  route('accounts/[id]/holders','POST',['BRANCH_MANAGER'],['path.id','body.customerId']),
  route('accounts/[id]/close','POST',['BRANCH_MANAGER'],['path.id']),
  route('accounts/[id]/transactions','GET',ledger,['path.id','query.page','query.pageSize']),
  route('transactions/[id]','GET',ledger,['path.id']),
  route('transactions/deposits','POST',['AGENT','BRANCH_MANAGER'],['header.idempotency-key','body.accountId','body.amount','body.channelId','body.narration']),
  route('transactions/withdrawals','POST',['AGENT','BRANCH_MANAGER','CUSTOMER'],['header.idempotency-key','body.accountId','body.amount','body.channelId','body.narration','body.onBehalfOfCustomerId','body.signerCustomerIds','body.signerCustomerIds.0']),
  route('transactions/[id]/reverse','POST',['BRANCH_MANAGER'],['path.id','header.idempotency-key','body.reason']),
  route('fd-products','GET',roles,['query.probe']),
  route('fd-products/[id]','PATCH',['ADMIN'],['path.id','body.interestRate','body.status','body.description']),
  route('fixed-deposits','GET',['AGENT','BRANCH_MANAGER','CENTRAL_OPS','AUDITOR','CUSTOMER'],['query.accountId','query.status','query.page','query.pageSize']),
  route('fixed-deposits','POST',['AGENT','BRANCH_MANAGER','CENTRAL_OPS'],['header.idempotency-key','body.accountId','body.fdPlanId','body.principalAmount']),
  route('fixed-deposits/quote','GET',['AGENT','BRANCH_MANAGER','CENTRAL_OPS'],['query.accountId','query.fdPlanId','query.principalAmount']),
  route('interest-runs','GET',['ADMIN','CENTRAL_OPS','AUDITOR'],['query.probe']),
  route('interest-runs','POST',['ADMIN','CENTRAL_OPS'],['body.cycleDate','body.dryRun','header.authorization']),
  route('admin/parameters','GET',['ADMIN'],['query.probe']),
  route('admin/parameters/[key]','PUT',['ADMIN'],['path.key','body.value']),
  route('audit','GET',['ADMIN','AUDITOR'],['query.userId','query.entityType','query.entityId','query.action','query.from','query.to','query.page','query.pageSize']),
  ...['agent-transactions','account-summary','customer-activity','active-fds','interest-distribution'].map(name =>
    route(`reports/${name}`,'GET',reports,['query.from','query.to','query.branchId','query.agentId','query.accountId','query.planId','query.status','query.format','query.page','query.pageSize','query.sort','query.direction'])),
];
