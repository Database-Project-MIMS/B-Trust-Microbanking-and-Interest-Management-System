"use client";

import { useState } from "react";
import type { FdProduct } from "@/services/fd-product-service";

interface FdProductClientProps {
  initialProducts: FdProduct[];
  isAdmin: boolean;
  csrfToken: string;
}

export default function FdProductClient({ initialProducts, isAdmin, csrfToken }: FdProductClientProps) {
  const [products, setProducts] = useState<FdProduct[]>(initialProducts);
  const [editingProduct, setEditingProduct] = useState<FdProduct | null>(null);
  const [newRate, setNewRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Group products by tenure to show history clearly
  // E.g., products with tenure=6 are the "6 Month" products.
  // The active one is the one with effectiveTo === null or status === 'ACTIVE'.
  // Actually, we can just display them in a table.
  
  const activeProducts = products.filter(p => p.status === 'ACTIVE' && p.effectiveTo === null);
  const historicalProducts = products.filter(p => p.status !== 'ACTIVE' || p.effectiveTo !== null);

  const handleEdit = (product: FdProduct) => {
    setEditingProduct(product);
    setNewRate(product.interestRate);
    setError(null);
  };

  const submitEdit = async () => {
    if (!editingProduct) return;
    setError(null);

    try {
      const res = await fetch(`/api/fd-products/${editingProduct.fdPlanId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ interestRate: newRate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to update product");
      }

      const { data: updatedProduct } = await res.json();
      
      // We don't exactly know what the server returned for the historical product, so it's easiest to just refresh the page
      // But we can update state manually if we want. For safety, let's just reload.
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this product?")) return;
    
    try {
      const res = await fetch(`/api/fd-products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ status: "INACTIVE" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to deactivate product");
      }

      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const renderTable = (list: FdProduct[], isHistory = false) => (
    <div className="overflow-x-auto rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[var(--surface-muted)] text-[var(--text-muted)] text-[13px] font-[500] uppercase tracking-wider">
            <th className="px-4 py-3 border-b border-[var(--border)]">Plan Name</th>
            <th className="px-4 py-3 border-b border-[var(--border)]">Tenure (Months)</th>
            <th className="px-4 py-3 border-b border-[var(--border)] text-right">Interest Rate</th>
            <th className="px-4 py-3 border-b border-[var(--border)]">Status</th>
            <th className="px-4 py-3 border-b border-[var(--border)]">Effective From</th>
            <th className="px-4 py-3 border-b border-[var(--border)]">Effective To</th>
            {!isHistory && isAdmin && <th className="px-4 py-3 border-b border-[var(--border)] text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="text-[14px]">
          {list.map(product => (
            <tr key={product.fdPlanId} className="border-b border-[var(--border)] last:border-0 hover:bg-[#fafafa]">
              <td className="px-4 py-3 font-[500]">{product.planName}</td>
              <td className="px-4 py-3 text-center">{product.tenureMonths}</td>
              <td className="px-4 py-3 amount text-[var(--credit)]">{(parseFloat(product.interestRate) * 100).toFixed(2)}%</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-[6px] text-[12px] font-[600] ${product.status === 'ACTIVE' ? 'bg-[var(--credit)] text-white' : 'bg-[var(--text-muted)] text-white'}`}>
                  {product.status}
                </span>
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{product.effectiveFrom ? new Date(product.effectiveFrom).toISOString().split('T')[0] : 'N/A'}</td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{product.effectiveTo ? new Date(product.effectiveTo).toISOString().split('T')[0] : '-'}</td>
              {!isHistory && isAdmin && (
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(product)} className="text-[var(--primary)] font-[500] hover:text-[var(--primary-hover)] mr-3">Edit</button>
                  <button onClick={() => handleDeactivate(product.fdPlanId)} className="text-[var(--danger)] font-[500] hover:underline">Deactivate</button>
                </td>
              )}
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">No products found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] p-[24px] rounded-[8px] w-full max-w-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            <h3 className="text-[18px] font-[600] mb-4">Edit Rate: {editingProduct.planName}</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-[var(--danger)] text-[13px] rounded-[6px] border border-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-[16px]">
              <div>
                <label className="block text-[13px] font-[500] text-[var(--text-muted)] mb-1">New Interest Rate (Fraction)</label>
                <input 
                  type="text" 
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-[6px] text-[14px] focus:outline-none focus:border-[var(--primary)]"
                  placeholder="e.g. 0.1500"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-[var(--border)] rounded-[6px] text-[var(--text)] hover:bg-[var(--surface-muted)] font-[500]"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitEdit}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-[6px] hover:bg-[var(--primary-hover)] font-[500]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[18px] font-[600] mb-4 text-[var(--text)]">Active FD Products</h2>
        {renderTable(activeProducts, false)}
      </div>

      <div>
        <h2 className="text-[18px] font-[600] mb-4 text-[var(--text)]">Rate History / Inactive</h2>
        {renderTable(historicalProducts, true)}
      </div>
    </div>
  );
}
