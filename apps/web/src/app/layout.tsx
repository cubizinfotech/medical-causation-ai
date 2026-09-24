import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { appMetadata } from "@/lib/config";
import { QueryProvider } from "@/providers/query-provider";
import { AuthGate, AuthProvider } from "@/features/auth/auth-session";
import { SiteFooter, SiteHeader } from "@/components/layout";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: appMetadata.name,
  description: appMetadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <QueryProvider>
          <AuthProvider>
            <SiteHeader />
            <div className="flex-1" suppressHydrationWarning>
              <AuthGate>{children}</AuthGate>
            </div>
            <SiteFooter />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
