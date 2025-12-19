import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MissingKeysDialog } from "@/components/missing-keys-dialog";
import { Analytics } from '@vercel/analytics/next';
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { logEnvironmentStatus } from "@/lib/env-validation";
import { MigrationBanner } from "@/components/migration-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "History | Discover the stories behind every place on Earth",
    template: "%s | History",
  },
  description:
    "Click anywhere on an interactive 3D globe and get comprehensive historical research in minutes. Deep research powered by AI, sourced from historical databases, academic archives, and verified sources.",
  applicationName: "History",
  openGraph: {
    title: "History | Discover the stories behind every place on Earth",
    description:
      "Click anywhere on an interactive 3D globe and get comprehensive historical research in minutes. Deep research powered by AI, sourced from historical databases, academic archives, and verified sources.",
    url: "/",
    siteName: "History",
    images: [
      {
        url: "/history.png",
        width: 1200,
        height: 630,
        alt: "History | Discover the stories behind every place on Earth",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "History | Discover the stories behind every place on Earth",
    description:
      "Click anywhere on an interactive 3D globe and get comprehensive historical research in minutes. Deep research powered by AI, sourced from historical databases, academic archives, and verified sources.",
    images: ["/history.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Log environment status on server-side render
  if (typeof window === 'undefined') {
    logEnvironmentStatus();
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthInitializer>
              <PostHogProvider>
                <MissingKeysDialog />
                <MigrationBanner />
                {children}
                <Analytics />
              </PostHogProvider>
            </AuthInitializer>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}