import { requirePageRole } from '@/lib/auth/page-access';
import { FdReport } from '../fd-report';
export default async function InterestDistributionReportPage(){
  const user=await requirePageRole('ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AUDITOR');
  return <FdReport interest scopeLabel={user.branchId?'Your branch':'All permitted branches'}/>;
}
