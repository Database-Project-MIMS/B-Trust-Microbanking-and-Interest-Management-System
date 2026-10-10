import { requirePageRole } from '@/lib/auth/page-access';
import { getPostingChoices } from '@/services/transaction-service';
import { PostingScreen } from '../posting-screen';
export default async function WithdrawPage({searchParams}:{searchParams:Promise<{accountId?:string}>}) {
  const user=await requirePageRole('AGENT','BRANCH_MANAGER','CUSTOMER');
  return <PostingScreen kind="withdraw" {...await getPostingChoices(user)} initialId={(await searchParams).accountId}/>;
}
