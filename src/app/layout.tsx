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

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://history.valyu.ai";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "History AI - Explore the History of Any Place | Valyu",
    template: "%s | History AI",
  },
  description:
    "Explore world history with an interactive 3D globe. Click any location to get AI-powered historical research from academic archives, historical databases, and verified sources. Your personal geography AI for place history search.",
  applicationName: "History AI",
  keywords: [
    "historical research AI",
    "location history",
    "world history explorer",
    "geography AI",
    "place history search",
    "interactive history map",
    "AI history research",
    "historical timeline",
    "geographic history",
    "local history finder",
  ],
  authors: [{ name: "Valyu", url: "https://valyu.ai" }],
  creator: "Valyu",
  publisher: "Valyu",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    title: "History AI - Explore the History of Any Place | Valyu",
    description:
      "Explore world history with an interactive 3D globe. Click any location to get AI-powered historical research from academic archives, historical databases, and verified sources.",
    url: baseUrl,
    siteName: "History AI",
    images: [
      {
        url: "/history.png",
        width: 1200,
        height: 630,
        alt: "History AI - Interactive 3D globe for exploring world history",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "History AI - Explore the History of Any Place | Valyu",
    description:
      "Explore world history with an interactive 3D globe. Click any location to get AI-powered historical research from academic archives and verified sources.",
    images: ["/history.png"],
    creator: "@valaboratory",
    site: "@valaboratory",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/history.png" },
    ],
  },
  manifest: "/manifest.json",
  category: "education",
  other: {
    "google-site-verification": process.env.GOOGLE_SITE_VERIFICATION || "",
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
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "History AI",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "description": "Explore world history with an interactive 3D globe. Click any location to get AI-powered historical research from academic archives, historical databases, and verified sources.",
    "url": baseUrl,
    "image": `${baseUrl}/history.png`,
    "author": {
      "@type": "Organization",
      "name": "Valyu",
      "url": "https://valyu.ai"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "314"
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
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