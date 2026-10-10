import {requirePageRole} from '@/lib/auth/page-access';
import {UserScreen} from '../users/user-screen';
export default async function RolesPage(){await requirePageRole('ADMIN');return <UserScreen rolesOnly/>;}
