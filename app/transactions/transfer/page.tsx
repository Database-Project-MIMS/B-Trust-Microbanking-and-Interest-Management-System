import {requirePageRole} from '@/lib/auth/page-access';
import {TransferScreen} from './transfer-screen';
import {CustomerTransferScreen} from './customer-transfer-screen';
import {getPostingChoices} from '@/services/transaction-service';
export default async function TransferPage(){
  const user=await requirePageRole('AGENT','BRANCH_MANAGER','CUSTOMER');
  if(user.roleName==='CUSTOMER'){
    const {ownAccounts}=await getPostingChoices(user);
    return <CustomerTransferScreen ownAccounts={ownAccounts??[]}/>;
  }
  return <TransferScreen/>;
}
