import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthProfileProvider } from "../../components/auth-session";
import { SiteHeader } from "../../components/site-header";
import { getServerAuthProfile } from "../../lib/server-auth";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const profile = await getServerAuthProfile();
  if (!profile) redirect("/login");
  return (
    <AuthProfileProvider profile={profile}>
      <SiteHeader />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-8">
          <p className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-600 shadow-sm">
            Together, we can turn compassion into action.
          </p>
        </div>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AuthProfileProvider>
  );
}
