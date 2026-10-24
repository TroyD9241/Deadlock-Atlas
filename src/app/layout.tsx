import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

import "./globals.css";

export const instant = false;

/*
 * design.md 2.3: Inter, falling back to the system UI stack as in the mock.
 * next/font self-hosts the file, so there is no runtime request to Google.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Deadlock Atlas",
    template: "%s · Deadlock Atlas",
  },
  description:
    "A fan-made interactive reference for Deadlock: heroes, abilities, items and mechanics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="shell flex min-h-full flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}