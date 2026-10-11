import type { ReactNode } from "react";
import WorkspaceLayout from "@/components/mims/workspace-layout";
import { requirePageRole } from "@/lib/auth/page-access";
import { reportRoles } from "@/components/report/report-catalogue";
import { ReportNavigation } from "@/components/report/report-navigation";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requirePageRole(...reportRoles);
  return <WorkspaceLayout><ReportNavigation />{children}</WorkspaceLayout>;
}
