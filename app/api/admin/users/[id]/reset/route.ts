import {NextRequest,NextResponse} from 'next/server';
import {requireUser,requireRole} from '@/lib/auth/rbac';
import {verifyCsrf} from '@/lib/auth/csrf';
import {errorResponse} from '@/lib/http/error-response';
import {issuePasswordReset} from '@/services/password-reset-service';
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){
 try{const user=await requireUser(request);requireRole(user,'ADMIN');verifyCsrf(request);
  return NextResponse.json({data:await issuePasswordReset((await context.params).id,user)});
 }catch(e){return errorResponse(e);}
}
