import { NextRequest,NextResponse } from 'next/server';
import { requireUser,requireRole } from '@/lib/auth/rbac';
import { errorResponse } from '@/lib/http/error-response';
import { quoteFixedDeposit } from '@/services/fixed-deposit-service';
export async function GET(request:NextRequest):Promise<Response>{
  try{
    const user=await requireUser(request);requireRole(user,'AGENT','BRANCH_MANAGER','CENTRAL_OPS');
    return NextResponse.json({data:await quoteFixedDeposit(Object.fromEntries(request.nextUrl.searchParams),user)});
  }catch(error){return errorResponse(error);}
}
