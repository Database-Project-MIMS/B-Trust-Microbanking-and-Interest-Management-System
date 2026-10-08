import { pathToFileURL } from 'node:url';

/** Validate the runtime environment before starting a production deployment. */
export function checkDeploymentEnvironment(env) {
  const problems = [];

  if (env.NODE_ENV !== 'production') problems.push('NODE_ENV must be production');

  let baseUrl;
  try { baseUrl = new URL(env.APP_BASE_URL ?? ''); }
  catch { problems.push('APP_BASE_URL must be a valid HTTPS URL'); }
  if (baseUrl && (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password ||
      baseUrl.search || baseUrl.hash || ['localhost', '127.0.0.1'].includes(baseUrl.hostname))) {
    problems.push('APP_BASE_URL must be a public HTTPS origin without credentials');
  }

  let databaseUrl;
  try { databaseUrl = new URL(env.DATABASE_URL ?? ''); }
  catch { problems.push('DATABASE_URL must be a valid PostgreSQL URL'); }
  if (databaseUrl && (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
      databaseUrl.username !== 'mims_app' || !databaseUrl.password ||
      databaseUrl.password.includes('CHANGE_ME'))) {
    problems.push('DATABASE_URL must use the configured mims_app role');
  }
  if (env.DATABASE_MIGRATION_URL) {
    problems.push('DATABASE_MIGRATION_URL must not be present in the runtime environment');
  }

  for (const name of ['SESSION_SECRET', 'CSRF_SECRET', 'INTEREST_WORKER_TOKEN']) {
    const value = env[name] ?? '';
    if (value.length < 32 || value.includes('CHANGE_ME')) {
      problems.push(`${name} must be a non-placeholder secret of at least 32 characters`);
    }
  }

  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_')) continue;
    if (/(SECRET|TOKEN|PASSWORD|CREDENTIAL|DATABASE|PRIVATE_KEY)/i.test(name) ||
        /(?:postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|[?&](?:token|api_key|secret)=)/i.test(value ?? '') ||
        ['DATABASE_URL', 'SESSION_SECRET', 'CSRF_SECRET', 'INTEREST_WORKER_TOKEN']
          .some(secretName => value && value === env[secretName])) {
      problems.push(`${name} must not expose a credential to the browser`);
    }
  }

  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkDeploymentEnvironment(process.env);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log('Production runtime environment security checks passed.');
  }
}
