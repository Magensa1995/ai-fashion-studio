import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Fashion Studio",
  description: "A private AI workspace for fashion imagery and content.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
