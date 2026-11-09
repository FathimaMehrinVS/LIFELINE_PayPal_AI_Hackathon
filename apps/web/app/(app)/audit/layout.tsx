import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerAuthProfile } from "@/lib/server-auth";

export default async function AuditLayout({ children }: { children: ReactNode }) {
  const profile = await getServerAuthProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "NGO") redirect("/workspace");
  return children;
}
