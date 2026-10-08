import { NotAuthenticatedError } from '@/lib/db';

export interface AuthenticatedWorker {
  actorType: 'SYSTEM';
  actorId: null;
}

export async function authenticateInterestWorker(
  request: Request
): Promise<AuthenticatedWorker> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) throw new NotAuthenticatedError();
  
  // Compare against the env variable
  const expectedToken = process.env.INTEREST_WORKER_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    throw new NotAuthenticatedError();
  }
  
  return {
    actorType: 'SYSTEM',
    actorId: null,  // no user_id for system actors
  };
}
