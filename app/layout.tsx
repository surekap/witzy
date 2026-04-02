import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Kids Quiz Live",
  description: "A playful multiplayer family quiz app with synchronized live rounds and personalized questions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className="app-grid">
        <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
