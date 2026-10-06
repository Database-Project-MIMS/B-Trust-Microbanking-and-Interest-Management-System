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
      .then(async r => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error?.message ?? 'Failed to load parameters');
        return result;
      })
      .then(d => { setParams(d.data ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load parameters'); setLoading(false); });
  }, []);

  async function handleSave(key: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
    const csrf = document.cookie.split('; ').find(cookie => cookie.startsWith('mims_csrf='))?.split('=')[1] ?? '';
    const res = await fetch(`/api/admin/parameters/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ value: editValue }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error?.message ?? 'Save failed'); return; }
    setParams(prev => prev.map(p => p.param_key === key ? data.data : p));
    setEditingKey(null);
    setSuccess(`Saved ${key}`);
    } catch {
      setError('Failed to save parameter. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">System Parameters</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Business rules stored as data — ADMIN only.</p>

      {error   && <div role="alert" className="mb-4 card text-[var(--danger)]">{error}</div>}
      {success && <div role="status" className="mb-4 card text-[var(--credit)]">{success}</div>}

      {loading ? (
        <p className="text-[var(--text-muted)] animate-pulse">Loading…</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Key</th>
                <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Value</th>
                <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Type</th>
                <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Description</th>
                <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {params.map(p => (
                <tr key={p.param_id} className="hover:bg-[var(--surface-muted)] transition-colors">
                  <td className="px-4 py-3 font-mono text-[var(--primary)]">{p.param_key}</td>
                  <td className="px-4 py-3 text-[var(--text)]">
                    {editingKey === p.param_key ? (
                      <input
                        type="text"
                        aria-label={`Value for ${p.param_key}`}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="input"
                      />
                    ) : (
                      <span className="font-mono text-[var(--text)]">{p.param_value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{p.data_type ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{p.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {editingKey === p.param_key ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSave(p.param_key)}
                          disabled={saving}
                          className="btn btn-primary text-xs"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="px-3 py-1 rounded-md bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingKey(p.param_key); setEditValue(p.param_value); setSuccess(null); }}
                        className="px-3 py-1 rounded-md bg-[var(--surface-muted)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-medium transition-colors"
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
