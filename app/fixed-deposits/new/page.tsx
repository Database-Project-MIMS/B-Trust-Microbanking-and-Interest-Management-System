import { requirePageRole } from '@/lib/auth/page-access';
import { FdOpening } from './fd-opening';
export default async function NewFixedDepositPage({searchParams}:{searchParams:Promise<{accountId?:string}>}){
  await requirePageRole('AGENT','BRANCH_MANAGER','CENTRAL_OPS');return <FdOpening initialId={(await searchParams).accountId}/>;
}
