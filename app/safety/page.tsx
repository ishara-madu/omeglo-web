import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Flag, AlertTriangle, Eye, Lock, ThumbsUp } from "lucide-react";
import Footer from "@/components/Footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omeglo.com";

export const metadata: Metadata = {
  title: "Safety & Community Guidelines",
  description:
    "Discover how to stay safe while video chatting on Omeglo, how our AI moderation works, and how to report rule violations.",
  alternates: {
    canonical: `${siteUrl}/safety`,
  },
  openGraph: {
    title: "Safety & Community Guidelines | Omeglo",
    description: "Learn about Omeglo safety guidelines, AI moderation, and reporting tools.",
    url: `${siteUrl}/safety`,
    siteName: "Omeglo",
    images: [{ url: "/opengraph-image.webp", width: 1200, height: 630, alt: "Omeglo Safety Guidelines" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Safety & Community Guidelines | Omeglo",
    description: "Learn about Omeglo safety guidelines, AI moderation, and reporting tools.",
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
      "name": "Safety & Guidelines",
      "item": `${siteUrl}/safety`,
    },
  ],
};

export default function SafetyPage() {
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
            <span className="font-bold text-sm text-zinc-900">Safety & Guidelines</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12 sm:space-y-16">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            User Protection & Safety First
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
            Omeglo Community Safety Guidelines
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600">
            Learn best practices for protecting your personal identity and keeping online video chat enjoyable for everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="space-y-2">
            <Eye className="w-5 h-5 text-zinc-900 mb-1" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-950">Never Share Personal Info</h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Do not disclose your full name, phone number, physical address, financial info, or personal social media handles to strangers.
            </p>
          </div>

          <div className="space-y-2">
            <Flag className="w-5 h-5 text-zinc-900 mb-1" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-950">Instant Report & Disconnect</h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              If a stranger is rude, inappropriate, or violates rules, click the <strong>Flag</strong> icon to submit an instant report and skip them immediately.
            </p>
          </div>

          <div className="space-y-2">
            <Lock className="w-5 h-5 text-zinc-900 mb-1" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-950">Encrypted P2P Streams</h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              All video transmissions are end-to-end peer-to-peer. Streams are never recorded, archived, or shared with third parties.
            </p>
          </div>

          <div className="space-y-2">
            <ThumbsUp className="w-5 h-5 text-zinc-900 mb-1" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-950">Be Respectful & Kind</h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Treat everyone with dignity. Bullying, vulgarity, racism, harassment, and unsolicited explicit behavior lead to permanent bans.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-6 border-t border-zinc-200">
          <h2 className="text-sm sm:text-base font-bold text-zinc-950 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Zero Tolerance Policy
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Omeglo strictly enforces a zero-tolerance policy against minor exploitation, illegal substances, hate speech, threats of violence, and non-consensual sexual content. Accounts violating these rules are permanently banned and reported to relevant authorities where required.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
