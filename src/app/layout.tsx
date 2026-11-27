import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/supabase/server";

const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"] });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Digital Heroes Print — design, proof, print",
  description: "Configure, design and order labels, race numbers, MTB boards, stamps, trophies and laser-cut work. Instant pricing.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${space.variable} ${plex.variable}`}>
      <body className="min-h-screen flex flex-col">
        <header className="border-b-2 border-ink bg-paper sticky top-0 z-30">
          <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
            <Link href="/" className="display font-bold text-lg flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-accent border-2 border-ink" />DH PRINT
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium">
              <Link href="/#products" className="hidden sm:block hover:text-accent">Products</Link>
              <Link href="/gallery" className="hidden sm:block hover:text-accent">Gallery</Link>
              {user ? (
                <>
                  {user.role === "admin" && <Link href="/admin" className="hover:text-accent">Admin</Link>}
                  <Link href="/dashboard" className="hover:text-accent">Dashboard</Link>
                  <form action="/auth/signout" method="post"><button className="hover:text-accent">Sign out</button></form>
                </>
              ) : (
                <><Link href="/login" className="hover:text-accent">Log in</Link>
                  <Link href="/signup" className="btn !py-1.5 !px-3 text-sm">Sign up</Link></>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t-2 border-ink mt-16 py-8 text-sm text-muted">
          <div className="mx-auto max-w-6xl px-4 flex flex-wrap justify-between gap-2">
            <span>© 2026 Digital Heroes Print · Per-order pricing, no subscriptions</span>
            <span>Prices include 20% VAT</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
