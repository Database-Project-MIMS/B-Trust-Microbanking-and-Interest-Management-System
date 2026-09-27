import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listParameters } from '@/services/parameter-service';

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, { status: 401 });
  if (session.role !== 'ADMIN')
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'ADMIN role required' } }, { status: 403 });

  const params = await listParameters();
  return NextResponse.json({ data: params });
}
