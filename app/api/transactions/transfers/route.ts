import {NextRequest,NextResponse} from 'next/server';
import {requireUser,requireRole,branchScope} from '@/lib/auth/rbac';
import {verifyCsrf} from '@/lib/auth/csrf';
import {requireIdempotencyKey} from '@/lib/api/idempotency';
import {errorResponse} from '@/lib/http/error-response';
import {postTransfer} from '@/services/transaction-service';
export async function POST(request:NextRequest){
  try{
    const user=await requireUser(request);requireRole(user,'AGENT','BRANCH_MANAGER');verifyCsrf(request);
    const key=requireIdempotencyKey(request);if(key instanceof NextResponse)return key;
    let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:{code:'VALIDATION_FAILED',message:'Invalid JSON body.'}},{status:400});}
    const result=await postTransfer(body,{...user,...branchScope(user)},key);
    return NextResponse.json({data:result.data},{status:result.replayed?200:201});
  }catch(error){return errorResponse(error);}
}
