import {NextRequest,NextResponse} from 'next/server';
import {requireUser,requireRole} from '@/lib/auth/rbac';
import {verifyCsrf} from '@/lib/auth/csrf';
import {errorResponse} from '@/lib/http/error-response';
import {listAdminUsers,createAdminUser} from '@/services/admin-user-service';
export async function GET(request:NextRequest){try{const u=await requireUser(request);requireRole(u,'ADMIN');const params=request.nextUrl.searchParams;
  if([...params.keys()].some(key=>params.getAll(key).length!==1))return NextResponse.json({error:{code:'VALIDATION_FAILED',message:'Repeated query parameters are invalid.'}},{status:400});
  return NextResponse.json({data:await listAdminUsers(Object.fromEntries(params),u)});}catch(e){return errorResponse(e);}}
export async function POST(request:NextRequest){try{const u=await requireUser(request);requireRole(u,'ADMIN');verifyCsrf(request);let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:{code:'VALIDATION_FAILED',message:'Invalid JSON body.'}},{status:400});}return NextResponse.json({data:await createAdminUser(body,u)},{status:201});}catch(e){return errorResponse(e);}}
