import { requirePageRole } from '@/lib/auth/page-access';
import { FdList } from './fd-list';
export default async function FixedDepositsPage(){
  const user=await requirePageRole('AGENT','BRANCH_MANAGER','CENTRAL_OPS','AUDITOR','CUSTOMER');
  return <FdList canOpen={['AGENT','BRANCH_MANAGER','CENTRAL_OPS'].includes(user.roleName)}/>;
}
