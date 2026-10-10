import Link from "next/link";
import { requirePageRole } from "@/lib/auth/page-access";
import { reportCatalogue, reportRoles } from "@/components/report/report-catalogue";

export default async function ReportsPage() {
  await requirePageRole(...reportRoles);
  return <section>
    <div className="page-header"><div><p className="eyebrow">Management reporting</p>
      <h1 className="page-title">Reports</h1><p className="page-description">Select a report. Results follow your role and branch access.</p></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reportCatalogue.map((report) => <Link href={report.href} key={report.code} className="card app-card-link">
        <span className="eyebrow">{report.code}</span><h2>{report.title}</h2><p>{report.description}</p><span>Open report ↗</span>
      </Link>)}
    </div>
  </section>;
}
