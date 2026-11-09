import type { ReactNode } from "react";
import { PublicFrame } from "@/components/app-shell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>;
}
