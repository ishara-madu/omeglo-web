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
    question: "What is Omeglo and how is it the best Omegle alternative?",
    answer:
      "Omeglo is a modern, fast, and completely free random video chat and anonymous text chat platform designed to connect you with strangers worldwide. Unlike legacy chat sites, Omeglo utilizes next-generation WebRTC peer-to-peer technology for ultra-low latency video, instant 0-second matching, built-in AI safety moderation, and gender filters without requiring any account creation or registration.",
  },
  {
    question: "Is Omeglo 100% free to use?",
    answer:
      "Yes, Omeglo is 100% free. You can start video chatting or text chatting with random people immediately. There are no hidden subscription fees, credit card requirements, or paywalls.",
  },
  {
    question: "Do I need to create an account or provide personal details?",
    answer:
      "No! Omeglo is completely anonymous. You don't need an email, phone number, password, or social login. Simply click 'Start Chatting' to connect instantly.",
  },
  {
    question: "Can I chat without a camera / webcam?",
    answer:
      "Yes! You can use 'Text Chat' mode to connect anonymously via text only. No microphone or camera permissions are required in Text Mode.",
  },
  {
    question: "How does Omeglo protect user safety and privacy?",
    answer:
      "Omeglo prioritizes user privacy and safety. All video and audio streams are transmitted directly between you and the stranger using encrypted WebRTC P2P connections—no video is stored on our servers. Additionally, our automated real-time moderation and user reporting systems proactively detect and blur inappropriate NSFW content to maintain a friendly, safe community.",
  },
  {
    question: "What should I do if a stranger behaves inappropriately?",
    answer:
      "You can immediately skip to the next person by pressing the 'Skip / Next' button or pressing the 'Esc' key on your keyboard. You can also click the red 'Report' flag icon to submit an instant report, which flags the bad actor for immediate automated quarantine and review.",
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

export default function SeoContentSection() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16 space-y-16">
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

      {/* 3. Visual Product Preview & Showcase */}
      <div className="space-y-8 sm:space-y-10 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Next-Gen Live Experience
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Connect Globally with Zero Friction
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl mx-auto">
            Omeglo brings you seamless, high-definition random video and anonymous text chatting directly in your browser with instant matchmaking, automated AI moderation, and encrypted WebRTC connections.
          </p>
        </div>

        {/* Large Prominent Showcase Image */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-200/80 shadow-xl bg-zinc-950 max-w-5xl mx-auto">
          <Image
            src="/opengraph-image.webp"
            alt="Omeglo Live Video Chat Experience"
            width={1200}
            height={630}
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Key Highlights under image */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-center pt-2">
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-950">Instant 0s Matching</h3>
            <p className="text-xs text-zinc-500">Connect in real-time across 190+ countries</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-950">Encrypted P2P Streams</h3>
            <p className="text-xs text-zinc-500">Direct WebRTC without video recording</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-950">100% Anonymous</h3>
            <p className="text-xs text-zinc-500">Zero registration, profiles, or passwords</p>
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
