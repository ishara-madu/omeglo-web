import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, HelpCircle, Video, MessageSquare, Shield, Lock } from "lucide-react";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ)",
  description:
    "Got questions about Omeglo? Find answers about video chat, text chat, anonymity, camera permissions, and privacy protection.",
  alternates: {
    canonical: "/faq",
  },
};

const faqItems = [
  {
    category: "General Questions",
    items: [
      {
        q: "What is Omeglo?",
        a: "Omeglo is a free, modern Omegle alternative providing 1-on-1 random video and anonymous text chat with strangers worldwide without any registration or account creation.",
      },
      {
        q: "Is Omeglo completely free?",
        a: "Yes, 100% free with no subscriptions, in-app purchases, or credit card requirements.",
      },
      {
        q: "Do I need to download an app?",
        a: "No! Omeglo works directly in your web browser on mobile phones, tablets, and desktop computers.",
      },
    ],
  },
  {
    category: "Video & Text Chat",
    items: [
      {
        q: "Can I use Omeglo without a webcam?",
        a: "Yes, you can select 'Text Mode' in the header to chat anonymously without turning on your camera or microphone.",
      },
      {
        q: "How does gender matching work?",
        a: "You can specify your gender and choose to connect with female, male, or both genders depending on available users online.",
      },
      {
        q: "Why is my video connection slow?",
        a: "Video chat requires a stable internet connection. If your connection is slow, try moving closer to your Wi-Fi router, pausing large downloads, or switching to Text Mode.",
      },
    ],
  },
  {
    category: "Privacy & Safety",
    items: [
      {
        q: "Are my video calls recorded?",
        a: "No. All video streams are peer-to-peer (WebRTC) and encrypted. Video streams are never recorded, saved, or monitored on central storage.",
      },
      {
        q: "How do I report a stranger who breaks rules?",
        a: "Click the red Flag / Report button at any time during a call to submit an instant report. The user will be disconnected immediately and reviewed by automated moderation.",
      },
      {
        q: "What is the minimum age to use Omeglo?",
        a: "You must be at least 18 years of age to use Omeglo.",
      },
    ],
  },
];

const allFaqs = faqItems.flatMap((c) => c.items);

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: allFaqs.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans">
      {/* Schema.org FAQ JSON-LD for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
            <span className="font-bold text-sm text-zinc-900">Omeglo FAQ</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[11px] font-semibold">
            <HelpCircle className="w-3 h-3" />
            <span>Help Center & FAQ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Find answers to common questions about using Omeglo, video chat features, privacy, and safety.
          </p>
        </div>

        <div className="space-y-10">
          {faqItems.map((category, idx) => (
            <div key={idx} className="space-y-4">
              <h2 className="text-sm sm:text-base font-bold text-zinc-950">
                {category.category}
              </h2>
              <div className="space-y-3">
                {category.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-1.5"
                  >
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-900">
                      {item.q}
                    </h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
