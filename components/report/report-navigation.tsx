"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { reportCatalogue } from "./report-catalogue";

/** Keeps all five reports reachable from the catalogue and individual reports. */
export function ReportNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Management reports" className="mb-6 flex flex-wrap gap-2">
    {[{ href: "/reports", code: "All reports", title: "Report catalogue" }, ...reportCatalogue].map((report) =>
      <Link key={report.href} href={report.href} title={report.title}
        className={`nav-link ${pathname === report.href ? "nav-link-active" : ""}`}
        aria-current={pathname === report.href ? "page" : undefined}>{report.code}</Link>)}
  </nav>;
}
