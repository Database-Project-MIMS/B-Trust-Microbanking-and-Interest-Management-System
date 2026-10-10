import { requirePageRole } from "@/lib/auth/page-access";
import ParameterAdmin from "./parameter-admin";

export default async function ParametersPage() {
  await requirePageRole("ADMIN");
  return <ParameterAdmin />;
}
