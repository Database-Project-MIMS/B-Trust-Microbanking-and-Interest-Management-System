import { requirePageRole } from '@/lib/auth/page-access';
import { CustomerActivityReport } from './customer-activity-report';

export default async function CustomerActivityReportPage() {
  await requirePageRole('BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN');
  return <CustomerActivityReport />;
}
