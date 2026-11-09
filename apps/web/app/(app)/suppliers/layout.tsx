import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/home";
import { getServerAuthProfile } from "@/lib/server-auth";

export default async function SuppliersLayout({ children }: { children: ReactNode }) {
  const profile = await getServerAuthProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "NGO") redirect(homeFor(profile.role));
  return children;
}
