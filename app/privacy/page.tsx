import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield, Lock, EyeOff, Server, Cookie } from "lucide-react";
import Footer from "@/components/Footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omeglo.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Omeglo protects your privacy, personal anonymity, and WebRTC peer-to-peer data encryption.",
  alternates: {
    canonical: `${siteUrl}/privacy`,
  },
  openGraph: {
    title: "Privacy Policy | Omeglo",
    description: "Learn how Omeglo protects your privacy, personal anonymity, and WebRTC data encryption.",
    url: `${siteUrl}/privacy`,
    siteName: "Omeglo",
    images: [{ url: "/opengraph-image.webp", width: 1200, height: 630, alt: "Omeglo Privacy Policy" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Omeglo",
    description: "Learn how Omeglo protects your privacy, personal anonymity, and WebRTC data encryption.",
    images: ["/opengraph-image.webp"],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": siteUrl,
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Privacy Policy",
      "item": `${siteUrl}/privacy`,
    },
  ],
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 font-sans">
      {/* Breadcrumb JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Header */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/70 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Omeglo</span>
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/logo.webp" alt="Omeglo" width={24} height={24} />
            <span className="font-bold text-sm text-zinc-900">Omeglo Privacy</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12 sm:space-y-16">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            End-to-End P2P Privacy
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
            Omeglo Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Last Updated: August 2026 • Effective Immediately
          </p>
        </div>

        <div className="prose prose-zinc max-w-none text-xs sm:text-sm space-y-6 text-zinc-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-zinc-900" />
              1. 100% Anonymous by Design
            </h2>
            <p>
              Omeglo does not require you to create an account, verify an email address, link social media profiles, or provide your real name, phone number, or payment details. Your interactions on Omeglo are anonymous.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Server className="w-4 h-4 text-zinc-900" />
              2. Peer-to-Peer (WebRTC) Video & Audio
            </h2>
            <p>
              Video and audio streams are established directly between you and your chat partner using encrypted WebRTC peer-to-peer technology. <strong>Omeglo does not record, intercept, or store your live video or audio streams on any server.</strong> Once you disconnect or skip a chat, the stream is permanently closed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-900" />
              3. Text Messages & Automated Moderation
            </h2>
            <p>
              Text messages exchanged during a chat are ephemeral and transmitted directly to your partner. Text messages are scanned in real-time by automated regex and toxicity filters on the client and signaling layer to prevent spam, phishing links, and abuse. Messages are not retained permanently in chat archives.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Cookie className="w-4 h-4 text-zinc-900" />
              4. Technical Logs & Abuse Prevention
            </h2>
            <p>
              To maintain service reliability and enforce community rules (e.g., banning automated spam bots or repeated offenders reported for harmful behavior), our signaling servers collect temporary technical logs such as IP addresses, browser client fingerprints, and country code information. This data is exclusively utilized for fraud detection, ban enforcement, and network quality diagnostics.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950">
              5. Contact Us Regarding Privacy
            </h2>
            <p>
              If you have any questions, inquiries, or feedback regarding our privacy practices, please contact us at <a href="mailto:privacy@omeglo.com" className="text-zinc-950 font-semibold underline">privacy@omeglo.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
