import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liv's Bachelorette Weekend",
  description: "Everything you need for Liv's bachelorette weekend, Oct 9–11.",
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
