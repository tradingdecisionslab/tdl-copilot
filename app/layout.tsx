import { WhopApp } from "@whop/react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TDL Trade Co-Pilot",
  description: "Institutional analysis engine for TDL subscribers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#080c10" }}>
        <WhopApp>{children}</WhopApp>
      </body>
    </html>
  );
}
