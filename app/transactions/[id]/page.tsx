import { requirePageRole } from '@/lib/auth/page-access';
import { TransactionDetail } from '../transaction-detail';
export default async function TransactionPage({params}:{params:Promise<{id:string}>}) {
  const user=await requirePageRole('AGENT','BRANCH_MANAGER','AUDITOR','CUSTOMER');
  return <TransactionDetail id={(await params).id} canReverse={user.roleName==='BRANCH_MANAGER'}/>;
}
