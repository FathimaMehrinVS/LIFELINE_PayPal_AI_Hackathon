import { redirect } from "next/navigation";
import { homeFor } from "@/lib/home";
import { getServerAuthProfile } from "@/lib/server-auth";

/** Kept so old links still land somewhere useful. */
export default async function WorkspacePage() {
  const profile = await getServerAuthProfile();
  redirect(profile ? homeFor(profile.role) : "/login");
}
