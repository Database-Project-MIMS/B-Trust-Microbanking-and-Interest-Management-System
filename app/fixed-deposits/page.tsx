import { requirePageRole } from '@/lib/auth/page-access';
import { FdList } from './fd-list';
import { listFdProducts } from '@/services/fd-product-service';
export default async function FixedDepositsPage(){
  const user=await requirePageRole('AGENT','BRANCH_MANAGER','CENTRAL_OPS','AUDITOR','CUSTOMER');
  const products=(await listFdProducts()).map(({fdPlanId,planName})=>({fdPlanId,planName}));
  return <FdList canOpen={['AGENT','BRANCH_MANAGER','CENTRAL_OPS'].includes(user.roleName)} products={products}/>;
}
