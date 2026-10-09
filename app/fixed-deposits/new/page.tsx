import { requirePageRole } from '@/lib/auth/page-access';
import { FdOpening } from './fd-opening';
export default async function NewFixedDepositPage(){
  await requirePageRole('AGENT','BRANCH_MANAGER','CENTRAL_OPS');return <FdOpening/>;
}
