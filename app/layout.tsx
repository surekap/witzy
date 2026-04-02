import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";

import "@/app/globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kids Quiz Live",
  description: "A playful multiplayer family quiz app with synchronized live rounds and personalized questions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable}`}>
      <body>
        <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
