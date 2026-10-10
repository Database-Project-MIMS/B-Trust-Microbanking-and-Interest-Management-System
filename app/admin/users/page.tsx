import {requirePageRole} from '@/lib/auth/page-access';
import {UserScreen} from './user-screen';
export default async function UsersPage(){await requirePageRole('ADMIN');return <UserScreen/>;}
