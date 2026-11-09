import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthProfileProvider } from "../../components/auth-session";
import { AppFrame } from "../../components/app-shell";
import { getServerAuthProfile } from "../../lib/server-auth";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const profile = await getServerAuthProfile();
  if (!profile) redirect("/login");
  return (
    <AuthProfileProvider profile={profile}>
      <AppFrame>{children}</AppFrame>
    </AuthProfileProvider>
  );
}
