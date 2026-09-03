import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIMS — B-Trust Microfinance Bank",
  description: "Microbanking and Interest Management System",
};

/**
 * Root layout. The real application shell (navigation, session header, role-aware
 * menu) is Member 1's Phase 1 deliverable — task P01-M01-T04. Keep this minimal.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
