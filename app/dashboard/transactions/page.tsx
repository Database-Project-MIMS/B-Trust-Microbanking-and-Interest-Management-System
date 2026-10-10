import {redirect} from 'next/navigation';
import {requirePageRole} from '@/lib/auth/page-access';
export default async function TransactionsPage(){const user=await requirePageRole('AGENT','BRANCH_MANAGER','CUSTOMER');redirect(user.roleName==='CUSTOMER'?'/transactions/withdraw':'/transactions/deposit');}
