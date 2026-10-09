import { requirePageRole } from '@/lib/auth/page-access';
import { InterestConsole } from './interest-console';
export default async function InterestRunsPage(){
  const user=await requirePageRole('ADMIN','CENTRAL_OPS','AUDITOR');
  return <InterestConsole canRun={['ADMIN','CENTRAL_OPS'].includes(user.roleName)}/>;
}
