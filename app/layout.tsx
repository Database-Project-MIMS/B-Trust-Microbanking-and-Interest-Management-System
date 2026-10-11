import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIMS — B-Trust Microfinance Bank",
  description: "Microbanking and Interest Management System",
};

/**
 * Root layout. The real application shell (navigation, session header, role-aware
 * menu) is Member 1's Phase 1 deliverable — task P01-M01-T04. Keep this minimal.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonces are per request; static HTML cannot carry the response's script nonce.
  await connection();
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
