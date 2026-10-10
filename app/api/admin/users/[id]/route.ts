import {NextRequest,NextResponse} from 'next/server';
import {requireUser,requireRole} from '@/lib/auth/rbac';
import {verifyCsrf} from '@/lib/auth/csrf';
import {errorResponse} from '@/lib/http/error-response';
import {listAdminUsers,createAdminUser,updateAdminUser} from '@/services/admin-user-service';
export async function PATCH(request:NextRequest,context:{params:Promise<{id:string}>}){try{const u=await requireUser(request);requireRole(u,'ADMIN');verifyCsrf(request);let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:{code:'VALIDATION_FAILED',message:'Invalid JSON body.'}},{status:400});}return NextResponse.json({data:await updateAdminUser((await context.params).id,body,u)});}catch(e){return errorResponse(e);}}
