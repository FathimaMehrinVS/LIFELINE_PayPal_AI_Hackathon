import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIFELINE",
  description: "AI-Powered Humanitarian Financial Access and Payment Coordination Network",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <SiteHeader />
        <div className="lg:pl-60">
          <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-8">
            <p className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-600 shadow-sm">
              Together, we can turn compassion into action.
            </p>
          </div>
          <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
