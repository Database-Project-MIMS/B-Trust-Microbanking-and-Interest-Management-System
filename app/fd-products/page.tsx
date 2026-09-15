import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { listFdProducts } from "@/services/fd-product-service";
import FdProductClient from "./FdProductClient";

export default async function FdProductsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mims_session")?.value;

  if (!token) {
    redirect("/sign-in");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/sign-in");
  }

  const csrfToken = cookieStore.get("mims_csrf")?.value || "";
  const products = await listFdProducts();
  const isAdmin = session.roleName === "ADMIN";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[24px] font-[600] text-[var(--text)] mb-2">Fixed Deposit Products</h1>
        <p className="text-[14px] text-[var(--text-muted)]">
          Manage fixed deposit plans, view rate history, and deactivate legacy products.
        </p>
      </div>

      <FdProductClient 
        initialProducts={products} 
        isAdmin={isAdmin} 
        csrfToken={csrfToken}
      />
    </div>
  );
}
