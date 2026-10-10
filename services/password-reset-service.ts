import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {withTransaction,ValidationError,NotAuthorizedError,NotFoundError} from '@/lib/db';
import {setRlsContext} from '@/lib/db/rls-context';
import {hashPassword} from '@/lib/auth/password';
import type {AuthenticatedUser} from '@/lib/auth/rbac';
const schema=z.object({token:z.string().regex(/^[0-9a-f]{64}$/),password:z.string().min(12).max(128)}).strict();
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
/** One transaction invalidates prior reset tokens and issues a bounded, hashed reset control. */
export async function issuePasswordReset(id:string,actor:AuthenticatedUser){
 if(actor.roleName!=='ADMIN')throw new NotAuthorizedError();
 if(!z.string().uuid().safeParse(id).success)throw new ValidationError('Invalid user identifier.');
 const token=randomBytes(32).toString('hex');
 return withTransaction(async tx=>{await setRlsContext(tx,actor);try{
  const r=(await tx.query('SELECT fn_issue_password_reset($1,$2) AS expiry',[id,digest(token)])).rows[0];
  return {token,expiresAt:r.expiry};
 }catch(e){const code=typeof e==='object'&&e!==null&&'code' in e?e.code:null;
  if(code==='P0002')throw new NotFoundError('Active user');if(code==='42501')throw new NotAuthorizedError();throw e;}});
}
/** One atomic consume transaction owns password change, single use and session invalidation. */
export async function consumePasswordReset(input:unknown){
 const v=schema.parse(input),hash=digest(v.token);
 const valid=await withTransaction(async tx=>(await tx.query('SELECT fn_password_reset_valid($1) AS valid',[hash])).rows[0].valid);
 if(!valid)throw new ValidationError('The reset link is invalid or expired.');
 const passwordHash=await hashPassword(v.password);
 return withTransaction(async tx=>{try{
  await tx.query('SELECT fn_consume_password_reset($1,$2)',[hash,passwordHash]);return {reset:true};
 }catch(e){if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P0001')throw new ValidationError('The reset link is invalid or expired.');throw e;}});
}
