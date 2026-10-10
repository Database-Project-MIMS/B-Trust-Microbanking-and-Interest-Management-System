import { NextRequest,NextResponse } from 'next/server';
import { requireUser,requireRole } from '@/lib/auth/rbac';
import { verifyCsrf } from '@/lib/auth/csrf';
import { errorResponse } from '@/lib/http/error-response';
import { listFixedDeposits,openFixedDeposit } from '@/services/fixed-deposit-service';

export async function GET(request:NextRequest):Promise<Response>{
  try{
    const user=await requireUser(request);
    requireRole(user,'AGENT','BRANCH_MANAGER','CENTRAL_OPS','AUDITOR','CUSTOMER');
    return NextResponse.json({data:await listFixedDeposits(Object.fromEntries(request.nextUrl.searchParams),user)});
  }catch(error){return errorResponse(error);}
}
export async function POST(request:NextRequest):Promise<Response>{
  try{
    const user=await requireUser(request);
    requireRole(user,'AGENT','BRANCH_MANAGER','CENTRAL_OPS');
    verifyCsrf(request);
    const result=await openFixedDeposit(await request.json(),user,request.headers.get('idempotency-key'));
    return NextResponse.json({data:result.data},{status:result.replayed?200:201});
  }catch(error){return errorResponse(error);}
}
