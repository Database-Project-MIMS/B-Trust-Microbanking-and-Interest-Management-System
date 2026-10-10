import { getParameter } from '@/services/parameter-service';

export async function getInterestCycleDays(): Promise<number> {
  const val = await getParameter('INTEREST_CYCLE_DAYS');
  return parseInt(val, 10);
}

export async function getMinFdPrincipal(): Promise<string> {
  return await getParameter('MIN_FD_PRINCIPAL');
}
