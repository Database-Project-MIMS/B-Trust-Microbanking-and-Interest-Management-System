'use client';

import { useEffect, useState } from 'react';

interface SystemParameter {
  param_id: string;
  param_key: string;
  param_value: string;
  description: string | null;
  data_type: string | null;
  updated_at: string | null;
}

export default function ParametersPage() {
  const [params, setParams] = useState<SystemParameter[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/parameters')
      .then(r => r.json())
      .then(d => { setParams(d.data ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load parameters'); setLoading(false); });
  }, []);

  async function handleSave(key: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/admin/parameters/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: editValue }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error?.message ?? 'Save failed'); return; }
    setParams(prev => prev.map(p => p.param_key === key ? data.data : p));
    setEditingKey(null);
    setSuccess(`Saved ${key}`);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">System Parameters</h1>
      <p className="text-sm text-white/50 mb-6">Business rules stored as data — ADMIN only.</p>

      {error   && <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-3 text-sm text-emerald-300">{success}</div>}

      {loading ? (
        <p className="text-white/40 animate-pulse">Loading…</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-white/60 font-medium">Key</th>
                <th className="px-4 py-3 text-left text-white/60 font-medium">Value</th>
                <th className="px-4 py-3 text-left text-white/60 font-medium">Type</th>
                <th className="px-4 py-3 text-left text-white/60 font-medium">Description</th>
                <th className="px-4 py-3 text-right text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {params.map(p => (
                <tr key={p.param_id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 font-mono text-sky-400">{p.param_key}</td>
                  <td className="px-4 py-3 text-white">
                    {editingKey === p.param_key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-full bg-white/10 border border-sky-500/50 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    ) : (
                      <span className="font-mono text-emerald-400">{p.param_value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/40">{p.data_type ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50">{p.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {editingKey === p.param_key ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSave(p.param_key)}
                          disabled={saving}
                          className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/70 text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingKey(p.param_key); setEditValue(p.param_value); setSuccess(null); }}
                        className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-medium transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
