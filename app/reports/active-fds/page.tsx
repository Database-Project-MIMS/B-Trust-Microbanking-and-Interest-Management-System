import { requirePageRole } from '@/lib/auth/page-access';
import { FdReport } from '../fd-report';
export default async function ActiveFdsReportPage(){
  const user=await requirePageRole('ADMIN','CENTRAL_OPS','BRANCH_MANAGER','AUDITOR');
  return <FdReport scopeLabel={user.branchId?'Your branch':'All permitted branches'}/>;
}
