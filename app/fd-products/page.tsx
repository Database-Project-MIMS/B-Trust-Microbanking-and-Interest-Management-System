import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";
import { listFdProducts } from "@/services/fd-product-service";
import FdProductClient from "./FdProductClient";

export default async function FdProductsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) redirect("/sign-in?next=/fd-products");

  const products = await listFdProducts();
  return (
    <AppShell session={session}>
      <section>
        <div className="page-header"><div><p className="eyebrow">Product administration</p><h1 className="page-title">Fixed-deposit products</h1><p className="page-description">View current product terms and their effective-dated rate history.</p></div></div>
        <FdProductClient initialProducts={products} isAdmin={session.roleName === "ADMIN"} />
      </section>
    </AppShell>
  );
}
