import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/navbar";

export const metadata: Metadata = {
  title: "SIH App",
  description: "Problem statement app with Firebase auth on Cloudflare Workers",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}

