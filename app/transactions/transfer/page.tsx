import {requirePageRole} from '@/lib/auth/page-access';
import {TransferScreen} from './transfer-screen';
export default async function TransferPage(){await requirePageRole('AGENT','BRANCH_MANAGER');return <TransferScreen/>;}
