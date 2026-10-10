import 'server-only';
import {z} from 'zod';
import {withTransaction,NotAuthorizedError,NotFoundError,BusinessRuleError,ValidationError} from '@/lib/db';
import {setRlsContext} from '@/lib/db/rls-context';
import {hashPassword} from '@/lib/auth/password';
import {createAgentSchema} from '@/lib/validation/organization';
import type {AuthenticatedUser} from '@/lib/auth/rbac';
const names=['ADMIN','CENTRAL_OPS','AUDITOR','AGENT','BRANCH_MANAGER','CUSTOMER'] as const;
const profile=createAgentSchema.omit({username:true,password:true});
const create=z.object({username:z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._-]+$/),password:z.string().min(12).max(128),roleName:z.enum(names),profile:profile.optional(),customerId:z.string().uuid().optional()}).strict()
 .refine(v=>(['AGENT','BRANCH_MANAGER'].includes(v.roleName)?!!v.profile?.branchId:!v.profile)&&(v.roleName==='CUSTOMER'?!!v.customerId:!v.customerId));
const update=z.object({roleName:z.enum(['ADMIN','CENTRAL_OPS','AUDITOR']).optional(),status:z.enum(['ACTIVE','INACTIVE','SUSPENDED']).optional(),password:z.string().min(12).max(128).optional()}).strict().refine(v=>Object.keys(v).length>0);
const list=z.object({q:z.string().trim().max(100).default(''),roleName:z.enum(names).optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
const columns=`u.user_id AS "userId",u.username,r.role_name AS "roleName",u.status,a.branch_id AS "branchId",b.branch_name AS "branchName"`;
async function authorize(tx:import('@/lib/db/pool').PoolClient,actor:AuthenticatedUser){
 if(actor.roleName!=='ADMIN')throw new NotAuthorizedError();
 const live=(await tx.query("SELECT 1 FROM app_user u JOIN role r USING(role_id) WHERE u.user_id=$1 AND u.status='ACTIVE' AND r.status='ACTIVE' AND r.role_name='ADMIN' FOR SHARE OF u",[actor.userId])).rows[0];
 if(!live)throw new NotAuthorizedError();await setRlsContext(tx,actor);
}
/** One snapshot reads a bounded user page and active role definitions, without password hashes. */
export async function listAdminUsers(input:unknown,actor:AuthenticatedUser){const v=list.parse(input);return withTransaction(async tx=>{
 await authorize(tx,actor);const args=[v.q,v.roleName??null];const where="WHERE u.username ILIKE '%'||$1||'%' AND ($2::text IS NULL OR r.role_name=$2) AND r.role_name<>'SYSTEM'";
 const joins='FROM app_user u JOIN role r USING(role_id) LEFT JOIN agent a ON a.agent_id=u.user_id LEFT JOIN branch b ON b.branch_id=a.branch_id';
 const total=(await tx.query(`SELECT count(*)::int AS n ${joins} ${where}`,args)).rows[0].n;
 const rows=(await tx.query(`SELECT ${columns} ${joins} ${where} ORDER BY u.username,u.user_id LIMIT 25 OFFSET $3`,[...args,(v.page-1)*25])).rows;
 const roles=(await tx.query("SELECT role_name AS name,status FROM role WHERE role_name<>'SYSTEM' ORDER BY role_name")).rows;
 return {rows,total,page:v.page,roles};},{isolationLevel:'REPEATABLE READ'});}
/** One transaction creates a hashed login and its required branch or customer profile link. */
export async function createAdminUser(input:unknown,actor:AuthenticatedUser){if(actor.roleName!=='ADMIN')throw new NotAuthorizedError();const v=create.parse(input),hash=await hashPassword(v.password);
 return withTransaction(async tx=>{await authorize(tx,actor);
 const role=(await tx.query("SELECT role_id FROM role WHERE role_name=$1 AND status='ACTIVE'",[v.roleName])).rows[0];if(!role)throw new ValidationError('Select an active role.');
 if(v.profile){const b=(await tx.query("SELECT 1 FROM branch WHERE branch_id=$1 AND status='ACTIVE' FOR SHARE",[v.profile.branchId])).rows[0];if(!b)throw new ValidationError('Choose an active branch.');}
 if(v.customerId){const c=(await tx.query("SELECT app_user_id FROM customer WHERE customer_id=$1 AND status='ACTIVE' FOR UPDATE",[v.customerId])).rows[0];if(!c)throw new NotFoundError('Customer');if(c.app_user_id)throw new BusinessRuleError('CUSTOMER_LOGIN_EXISTS','This customer already has a login.');}
 const id=(await tx.query("INSERT INTO app_user(role_id,username,password_hash,status) VALUES($1,$2,$3,'ACTIVE') RETURNING user_id",[role.role_id,v.username,hash])).rows[0].user_id;
 if(v.profile){const p=v.profile;await tx.query(`INSERT INTO agent(agent_id,branch_id,employee_no,nic_passport_no,full_name,date_of_birth,gender,phone,address,email,hired_date,status)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ACTIVE')`,[id,p.branchId,p.employeeNo,p.nicPassportNo,p.fullName,p.dateOfBirth,p.gender,p.phone,p.address,p.email,p.hiredDate]);}
 if(v.customerId)await tx.query('UPDATE customer SET app_user_id=$1 WHERE customer_id=$2',[id,v.customerId]);
 return {userId:id,username:v.username,roleName:v.roleName,status:'ACTIVE'};});}
/** One locked transaction changes status/password and revokes all existing sessions atomically. */
export async function updateAdminUser(id:string,input:unknown,actor:AuthenticatedUser){if(!z.string().uuid().safeParse(id).success)throw new ValidationError('Invalid user identifier.');const v=update.parse(input);const hash=v.password?await hashPassword(v.password):null;
 return withTransaction(async tx=>{await authorize(tx,actor);const row=(await tx.query("SELECT u.user_id,r.role_name FROM app_user u JOIN role r USING(role_id) WHERE u.user_id=$1 AND r.role_name<>'SYSTEM' FOR UPDATE OF u",[id])).rows[0];if(!row)throw new NotFoundError('User');
 if(v.roleName && !['ADMIN','CENTRAL_OPS','AUDITOR'].includes(row.role_name))throw new ValidationError('Branch and customer roles require their existing profile; create the appropriate login instead.');
 if(id===actor.userId && v.roleName && v.roleName!=='ADMIN')throw new BusinessRuleError('SELF_DEMOTION_DENIED','Another administrator must change your role.');
 if(id===actor.userId && v.status && v.status!=='ACTIVE')throw new BusinessRuleError('SELF_DEACTIVATION_DENIED','Another administrator must deactivate your login.');
 if(v.status && v.status!=='ACTIVE' && (await tx.query('SELECT 1 FROM customer_agent WHERE agent_id=$1 AND is_active LIMIT 1',[id])).rowCount)throw new BusinessRuleError('ACTIVE_ASSIGNMENTS','Reassign active customers before disabling this agent.');
 await tx.query(`UPDATE app_user SET status=COALESCE($2,status),password_hash=COALESCE($3,password_hash),role_id=COALESCE((SELECT role_id FROM role WHERE role_name=$4 AND status='ACTIVE'),role_id) WHERE user_id=$1`,[id,v.status??null,hash,v.roleName??null]);
 if(['AGENT','BRANCH_MANAGER'].includes(row.role_name)&&v.status)await tx.query('UPDATE agent SET status=$2 WHERE agent_id=$1',[id,v.status]);
 await tx.query('DELETE FROM user_session WHERE user_id=$1',[id]);return {userId:id,status:v.status??undefined,sessionsRevoked:true};});}
