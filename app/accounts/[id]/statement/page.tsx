import { requirePageRole } from '@/lib/auth/page-access';
import { StatementScreen } from './statement-screen';
export default async function StatementPage({params}:{params:Promise<{id:string}>}) {
  await requirePageRole('AGENT','BRANCH_MANAGER','AUDITOR','CUSTOMER');
  return <StatementScreen id={(await params).id}/>;
}
