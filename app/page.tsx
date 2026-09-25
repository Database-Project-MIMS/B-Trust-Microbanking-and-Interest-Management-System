import { redirect } from "next/navigation";

/**
 * Root landing page. Redirects to the auth flow as per the new B-Trust Spatial UI.
 */
export default function Home() {
  redirect("/sign-in");
}
