import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
