'use client';
import React, { useState, useEffect } from 'react';

export default function AuditPage() {
  const [data, setData] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    actorId: '',
    entityType: '',
    entityId: '',
    action: '',
    from: '',
    to: ''
  });

  const fetchData = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    const res = await fetch(`/api/audit?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Audit Log Search</h1>
      
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded shadow border border-gray-200">
        <div>
          <label className="block text-sm font-medium">Actor ID (UUID)</label>
          <input className="mt-1 border p-1 rounded" value={filters.actorId} onChange={e => setFilters({...filters, actorId: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium">Entity Type</label>
          <input className="mt-1 border p-1 rounded" value={filters.entityType} onChange={e => setFilters({...filters, entityType: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium">Entity ID (UUID)</label>
          <input className="mt-1 border p-1 rounded" value={filters.entityId} onChange={e => setFilters({...filters, entityId: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium">Action</label>
          <input className="mt-1 border p-1 rounded" value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium">From</label>
          <input type="datetime-local" className="mt-1 border p-1 rounded" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium">To</label>
          <input type="datetime-local" className="mt-1 border p-1 rounded" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
        </div>
        <div className="flex items-end">
          <button onClick={fetchData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Search</button>
        </div>
      </div>

      <div className="bg-white shadow rounded overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Time</th>
              <th className="px-4 py-2 text-left font-semibold">Actor</th>
              <th className="px-4 py-2 text-left font-semibold">Action</th>
              <th className="px-4 py-2 text-left font-semibold">Entity</th>
              <th className="px-4 py-2 text-left font-semibold">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row: any) => (
              <tr key={row.log_id}>
                <td className="px-4 py-2 whitespace-nowrap">{new Date(row.logged_at).toLocaleString()}</td>
                <td className="px-4 py-2">{row.actor_type} {row.user_id && <span className="text-gray-500 text-xs">({row.user_id.slice(0, 8)})</span>}</td>
                <td className="px-4 py-2">{row.action}</td>
                <td className="px-4 py-2">{row.entity_type} {row.entity_id && <span className="text-gray-500 text-xs">({row.entity_id.slice(0, 8)})</span>}</td>
                <td className="px-4 py-2 max-w-xs truncate" title={JSON.stringify(row.new_values)}>
                  {row.new_values && JSON.stringify(row.new_values)}
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No audit logs found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
