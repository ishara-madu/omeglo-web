"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Zap,
  ChevronDown,
  EyeOff,
  Keyboard,
  Video,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const textFaqs: FAQItem[] = [
  {
    question: "What is Omeglo Text Chat and how is it a safe Omegle text alternative?",
    answer:
      "Omeglo Text Chat is a fast, anonymous 1-on-1 text messaging platform that pairs you with random strangers globally. It works directly in your web browser with zero camera or microphone requirements, no user registration, and active AI safety moderation.",
  },
  {
    question: "Can I talk to strangers online without camera, webcam, or microphone permissions?",
    answer:
      "Yes! Omeglo Text Mode is 100% camera-free and requires zero hardware permissions. It is ideal for quiet environments, low-bandwidth connections, and private conversations where you prefer not to share video.",
  },
  {
    question: "Can random strangers see my IP address, location, or private identity?",
    answer:
      "No. Omeglo protects your privacy through secure signaling and encrypted peer-to-peer data channels. Your real name, IP address, and personal contact details are never disclosed to chat partners.",
  },
  {
    question: "Does Omeglo text chat support fast keyboard shortcuts like Esc to skip and Enter to send?",
    answer:
      "Yes! On desktop, you can hit the 'Esc' key to instantly disconnect and skip to a new stranger in 0 seconds, and press 'Enter' to send your message smoothly.",
  },
  {
    question: "How does Omeglo block spam bots, malicious links, and toxic language in text chat?",
    answer:
      "Omeglo utilizes real-time automated AI moderation, link blockers, and regex profanity filters to intercept spam bots and abusive text before it displays on your screen. You can also report disruptive users immediately.",
  },
  {
    question: "Can I switch from anonymous text chat to live random video chat anytime?",
    answer:
      "Yes! You can switch between Text Chat and Video Chat with a single click using the mode switcher or the 'Switch to Video Mode' button without losing your place.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: textFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function TextSeoContentSection({
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
          100% Anonymous Text Chat • No Camera Required
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
          Free Anonymous Random Text Chat with Strangers
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
          Looking to talk with strangers without turning on your webcam? Omeglo Text Chat lets you meet new people worldwide through instant, private, and camera-free text conversations with zero sign-up.
        </p>
      </div>

      {/* 2. Core Text Mode Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-2">
          <EyeOff className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            Zero Camera Anxiety
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            No webcam or microphone permissions needed. Chat comfortably and privately from anywhere.
          </p>
        </div>

        <div className="space-y-2">
          <Zap className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            Ultra-Low Data & Instant
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Works smoothly on 2G/3G/4G or slow internet connections with instant real-time message delivery.
          </p>
        </div>

        <div className="space-y-2">
          <Keyboard className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            Fast Keyboard Shortcuts
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Press <kbd className="px-1 py-0.5 bg-zinc-100 border border-zinc-300 rounded text-[10px] font-mono">Esc</kbd> to quickly skip to a new partner and <kbd className="px-1 py-0.5 bg-zinc-100 border border-zinc-300 rounded text-[10px] font-mono">Enter</kbd> to send.
          </p>
        </div>

        <div className="space-y-2">
          <ShieldCheck className="w-6 h-6 text-zinc-900 mb-2" />
          <h2 className="text-base font-bold text-zinc-950">
            AI Toxicity & Spam Shield
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Built-in automated profanity and link filters protect you from spam bots and hostile behavior.
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
              alt="Omeglo Anonymous Chat Experience"
              width={1200}
              height={630}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>

        {/* Right Column: Description on Desktop (Opposite of FAQ title) */}
        <div className="order-1 lg:order-2 lg:col-span-5 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Instant Anonymous Connections
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Talk to Strangers Privately from Anywhere
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Whether you prefer anonymous text conversations or live video chatting, Omeglo gives you the fastest and safest platform to meet people across 190+ countries with zero registration or personal details.
          </p>
          <div className="space-y-2.5 pt-1 text-xs sm:text-sm text-zinc-700">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Camera-free private text mode with instant delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>AI toxicity & spam filters for clean, friendly chats</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Seamlessly switch between text and video anytime</span>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (onSwitchMode) {
                  onSwitchMode("video");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-xs cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Switch to Video Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Why Choose Omeglo Text Chat */}
      <div className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-10 lg:p-12 space-y-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Text Mode Benefits
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 text-white">
            Why Millions Prefer Anonymous Text Chat
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <span className="text-2xl font-black text-zinc-600">01</span>
            <h3 className="text-base font-bold text-white">100% Identity Privacy</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Express your thoughts, share ideas, or practice languages without anyone seeing your face or environment.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-2xl font-black text-zinc-600">02</span>
            <h3 className="text-base font-bold text-white">Chat On the Go</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Ideal for public transit, libraries, or quiet spaces where video and microphone calls are impractical.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-2xl font-black text-zinc-600">03</span>
            <h3 className="text-base font-bold text-white">Zero App Installation</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Runs in standard web browsers across iPhone, Android, Windows, Mac, and Linux without downloading apps.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Text Mode FAQ Accordion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        <div className="lg:col-span-4 space-y-2 lg:sticky lg:top-24">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Text Chat Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Answers to common questions about anonymous text chat on Omeglo.
          </p>
        </div>

        <div className="lg:col-span-8 divide-y divide-zinc-200/80 border-y border-zinc-200/80">
          {textFaqs.map((faq, index) => {
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
