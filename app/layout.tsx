import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omeglo.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Omeglo - Free Random Video Chat with Strangers | Omegle Alternative",
    template: "%s | Omeglo",
  },
  description:
    "Talk to strangers instantly on Omeglo, the best free Omegle alternative. Enjoy 1-on-1 random video chat, anonymous text chat, gender filter, and private P2P connections without registration.",
  keywords: [
    "omegle alternative",
    "free random video chat without registration",
    "best sites like omegle with gender filter",
    "talk to random strangers online free",
    "anonymous webcam chat with strangers",
    "random video call with strangers",
    "instant stranger video chat on mobile browser",
    "safe omegle alternative no login",
    "free random cam chat no credit card",
    "anonymous text chat with strangers",
    "stranger chat without camera",
    "online video chat no signup",
    "video chat with strangers worldwide",
    "omegle replacement 2026",
    "omeglo",
    "free peer to peer video chat",
  ],
  authors: [{ name: "Omeglo", url: siteUrl }],
  creator: "Omeglo",
  publisher: "Omeglo",
  applicationName: "Omeglo",
  category: "communication",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Omeglo",
    title: "Omeglo - Free Random Video Chat with Strangers",
    description:
      "Instant 1-on-1 random video and text chat with people worldwide. No signup required, 100% free and private.",
    images: [
      {
        url: "/opengraph-image.webp",
        width: 1200,
        height: 630,
        alt: "Omeglo - Free Random Video & Text Chat with Strangers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omeglo - Free Random Video Chat with Strangers",
    description:
      "Instant 1-on-1 random video and text chat with people worldwide. Best Omegle alternative.",
    images: ["/opengraph-image.webp"],
  },
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Omeglo",
      description: "Free random video chat and anonymous text chat with strangers.",
      publisher: {
        "@type": "Organization",
        name: "Omeglo",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/logo.webp`,
        },
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      url: siteUrl,
      name: "Omeglo - Random Video Chat",
      applicationCategory: "CommunicationApplication",
      operatingSystem: "All",
      offers: {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      featureList: [
        "Instant Random Video Chat",
        "Anonymous Text Chat",
        "Gender Preference Filter",
        "Encrypted WebRTC P2P Connections",
        "Automated NSFW & Toxicity Moderation",
      ],
    },
  ],
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
      <head>
        <link rel="dns-prefetch" href="https://omeglo-backend.pocoma3486.workers.dev" />
        <link rel="preconnect" href="https://omeglo-backend.pocoma3486.workers.dev" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}

