import {requirePageRole} from '@/lib/auth/page-access';
import {AuditScreen} from './audit-screen';
export default async function AuditPage(){await requirePageRole('ADMIN','AUDITOR');return <AuditScreen/>;}
