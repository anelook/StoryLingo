import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "StoryLingo — learn Spanish through adventure",
  description: "An AI-driven Spanish adventure game with a built-in tutor.",
};
export const viewport: Viewport = { themeColor: "#0d0a12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
