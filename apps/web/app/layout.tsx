import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthSessionBridge } from "../components/auth-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIFELINE",
  description: "AI-Powered Humanitarian Financial Access and Payment Coordination Network",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AuthSessionBridge />
        {children}
      </body>
    </html>
  );
}
