import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liv's Bachelorette — Spike",
  description: "Phase 1 Insforge connection test",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
