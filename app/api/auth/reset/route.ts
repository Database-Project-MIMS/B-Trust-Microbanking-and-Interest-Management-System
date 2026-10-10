import {NextRequest,NextResponse} from 'next/server';
import {issueCsrfToken,verifyCsrf} from '@/lib/auth/csrf';
import {errorResponse} from '@/lib/http/error-response';
import {consumePasswordReset} from '@/services/password-reset-service';
export async function GET(){const response=NextResponse.json({data:{ready:true}});issueCsrfToken(response);response.headers.set('Cache-Control','no-store');return response;}
export async function POST(request:NextRequest){
 try{verifyCsrf(request);return NextResponse.json({data:await consumePasswordReset(await request.json())});}
 catch(e){return errorResponse(e);}
}
