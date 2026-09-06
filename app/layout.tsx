import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

export const metadata: Metadata = {
  title: "SIH PCE",
  description: "Official SIH Team Portal for Poornima College of Engineering",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}

