// Call only after the disposable-database guard, with owner fixture connections held.
// Routes (pool.query) and services (pool.connect) both use the migrated runtime role.
export function useCustomerRuntime(pool) {
  const originalConnect = pool.connect;
  const pending = [];
  async function connect() {
    const client = await originalConnect.call(pool);
    const release = client.release.bind(client);
    try { await client.query('SET ROLE mims_app'); }
    catch (error) { release(error); throw error; }
    client.release = error => {
      pending.push(client.query('RESET ROLE').then(() => {
        client.release = release; release(error);
      }, resetError => { client.release = release; release(resetError); }));
    };
    return client;
  }
  pool.connect = callback => {
    const result = connect();
    if (!callback) return result;
    result.then(client => callback(null, client, client.release), error => callback(error));
  };
  return async () => { pool.connect = originalConnect; await Promise.all(pending); };
}
