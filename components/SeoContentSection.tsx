"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Video,
  ShieldCheck,
  ChevronDown,
  Lock,
  UserCheck,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Why is Omeglo considered the best free Omegle alternative without registration?",
    answer:
      "Omeglo is the top free Omegle alternative offering instant 1-on-1 random video chat and anonymous text chat with strangers worldwide. Unlike older chat sites, Omeglo features lightning-fast 0-second matching, peer-to-peer WebRTC encryption, AI-powered safety moderation, and gender filters without requiring any account creation, login, or personal details.",
  },
  {
    question: "Is Omeglo 100% free to use with no hidden subscriptions or credit card?",
    answer:
      "Yes, Omeglo is completely free to use. You can start video chatting or text chatting with random strangers immediately. There are zero subscriptions, paywalls, credit card requirements, or hidden charges.",
  },
  {
    question: "Can I video chat with random strangers on mobile (iPhone & Android) without downloading an app?",
    answer:
      "Yes! Omeglo is 100% browser-based and optimized for mobile devices. You can start high-definition video calls directly in Safari, Chrome, Firefox, or Edge on any smartphone or tablet without installing third-party apps.",
  },
  {
    question: "How can I talk to strangers without turning on my camera or webcam?",
    answer:
      "You can simply switch to 'Text Chat' mode on Omeglo. Text mode is 100% camera-free and requires zero microphone or webcam permissions, allowing you to chat anonymously and comfortably from anywhere.",
  },
  {
    question: "How does Omeglo protect user privacy and encrypt peer-to-peer video streams?",
    answer:
      "All video and voice streams on Omeglo are transmitted directly between you and your chat partner using end-to-end WebRTC peer-to-peer connections. Video data is never recorded, saved, or routed through central media servers. We also employ real-time automated AI moderation to detect and filter inappropriate content.",
  },
  {
    question: "How does the gender preference filter work for matching with girls or guys?",
    answer:
      "Omeglo allows you to select your preferred match filter (Both, Female, or Male) right on the control dock. Our matchmaking algorithm prioritizes pairing you with active online strangers matching your chosen preference.",
  },
  {
    question: "What should I do if a stranger behaves inappropriately during a video chat?",
    answer:
      "You can immediately skip to a new stranger by clicking the 'Next Stranger' button or pressing the 'Esc' key. You can also click the red 'Report' flag icon to instantly submit an anonymous report, which quarantines the violator through our automated safety system.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function SeoContentSection({
  onSwitchMode,
}: {
  onSwitchMode?: (mode: "video" | "text") => void;
} = {}) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24 lg:mt-28 space-y-20 sm:space-y-28 lg:space-y-32">
      {/* Schema.org FAQ JSON-LD for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* 1. Hero SEO Heading & Overview */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          The #1 Next-Generation Omegle Alternative
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
          Free Random Video & Anonymous Text Chat with Strangers
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
          Meet fascinating people from around the world in one click. Experience lightning-fast HD video calls, anonymous text messaging, gender preferences, and state-of-the-art privacy protection on Omeglo.
        </p>
      </div>

      {/* 2. Core Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-2">
          <Video className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            Instant HD Video Chat
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Crystal clear video calls with zero latency powered by direct WebRTC peer-to-peer streaming.
          </p>
        </div>

        <div className="space-y-2">
          <Lock className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            100% Private & Anonymous
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            No signup, registration, or credit card required. Your personal identity stays completely anonymous.
          </p>
        </div>

        <div className="space-y-2">
          <UserCheck className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            Gender Match Preference
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Select your chat preference to find female, male, or open random chat matches effortlessly.
          </p>
        </div>

        <div className="space-y-2">
          <ShieldCheck className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            AI Automated Safety
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Real-time automated content filtering and swift one-click stranger reporting keep interactions friendly.
          </p>
        </div>
      </div>

      {/* 3. Visual Product Preview & Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-4 sm:py-6">
        {/* Left Column: Image on Desktop */}
        <div className="order-2 lg:order-1 lg:col-span-7">
          <div className="relative rounded-xl overflow-hidden border border-zinc-200/80 shadow-md bg-zinc-950">
            <Image
              src="/opengraph-image.webp"
              alt="Omeglo Live Video Chat Experience"
              width={1200}
              height={630}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* Right Column: Description on Desktop (Opposite of FAQ title) */}
        <div className="order-1 lg:order-2 lg:col-span-5 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Next-Gen Live Experience
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Connect Globally with Zero Friction
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Omeglo brings you seamless, high-definition random video and anonymous text chatting directly in your browser. With instant matchmaking, automated AI moderation, and encrypted P2P connections, talking with strangers worldwide has never been faster or safer.
          </p>
          <div className="space-y-2.5 pt-1 text-xs sm:text-sm text-zinc-700">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Instant 0-second matching with active global strangers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Peer-to-peer encrypted WebRTC video streaming</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>100% anonymous with zero registration or logins</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. How to Use Omeglo (3 Easy Steps) */}
      <div className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-10 lg:p-12 space-y-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Quick Start Guide
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 text-white">
            How to Start Chatting on Omeglo in 3 Steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <span className="text-2xl font-black text-zinc-600">01</span>
            <h3 className="text-base font-bold text-white">Choose Chat Mode</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Select <strong className="text-zinc-200">Video Chat</strong> to meet people face-to-face or <strong className="text-zinc-200">Text Chat</strong> for camera-free anonymous messaging.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-2xl font-black text-zinc-600">02</span>
            <h3 className="text-base font-bold text-white">Allow Permissions</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              When prompted by your browser, allow Camera & Mic access (all video is direct P2P and never recorded).
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-2xl font-black text-zinc-600">03</span>
            <h3 className="text-base font-bold text-white">Click Start & Enjoy</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Hit <strong className="text-zinc-200">Start Chat</strong> to instantly meet a new stranger. Press <strong className="text-zinc-200">Skip</strong> or <strong className="text-zinc-200">Esc</strong> anytime to find someone new.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Frequently Asked Questions (FAQ) with Accordions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        <div className="lg:col-span-4 space-y-2 lg:sticky lg:top-24">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Got Questions?
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Everything you need to know about using Omeglo safely and anonymously.
          </p>
        </div>

        <div className="lg:col-span-8 divide-y divide-zinc-200/80 border-y border-zinc-200/80">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={index} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-sm sm:text-base font-semibold text-zinc-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-zinc-950" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="pt-3 text-xs sm:text-sm text-zinc-600 leading-relaxed animate-in fade-in duration-150">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
