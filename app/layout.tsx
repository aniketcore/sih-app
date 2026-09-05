import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIH App",
  description: "Problem statement app with Firebase auth on Cloudflare Workers",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
