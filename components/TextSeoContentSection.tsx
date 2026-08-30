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
    question: "What is Omeglo Text Chat and how does it work?",
    answer:
      "Omeglo Text Chat is an instant anonymous messaging platform that connects you 1-on-1 with random strangers worldwide without using your webcam or microphone. You are paired in real-time and can chat purely through text.",
  },
  {
    question: "Do I need a camera or microphone to use Text Mode?",
    answer:
      "No! Text mode requires zero camera or microphone permissions. It is 100% camera-free, making it perfect for private chatting, low-bandwidth internet, or chatting in quiet environments.",
  },
  {
    question: "Can strangers see my IP address or personal identity?",
    answer:
      "No. Omeglo uses secure signaling and does not expose your real name, location, or personal contact details. All chats are completely anonymous.",
  },
  {
    question: "Are keyboard shortcuts supported in Text Mode?",
    answer:
      "Yes! You can press the 'Esc' key on your keyboard to instantly skip to a new stranger, and press 'Enter' to send messages effortlessly.",
  },
  {
    question: "How does Omeglo prevent abusive messages and spam bots?",
    answer:
      "Omeglo runs real-time automated AI moderation and regex filters to detect offensive language, toxicity, and spam links before they reach you. You can also report any bad actor with the click of a button.",
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

export default function TextSeoContentSection() {
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
          100% Anonymous Text Chat • No Camera Required
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
          Free Anonymous Random Text Chat with Strangers
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
          Looking to talk with strangers without turning on your webcam? Omeglo Text Chat lets you meet new people worldwide through instant, private, and camera-free text conversations with zero sign-up.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-xs"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Switch to Video Mode</span>
          </Link>
        </div>
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

      {/* 3. Visual Product Preview & Showcase */}
      <div className="space-y-8 sm:space-y-10 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Instant Anonymous Connections
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Talk to Strangers Privately from Anywhere
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl mx-auto">
            Whether you prefer anonymous text conversations or live video chatting, Omeglo gives you the fastest and safest platform to meet people across 190+ countries with zero registration or personal details.
          </p>
        </div>

        {/* Large Prominent Showcase Image */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-200/80 shadow-xl bg-zinc-950 max-w-5xl mx-auto">
          <Image
            src="/opengraph-image.webp"
            alt="Omeglo Anonymous Chat Experience"
            width={1200}
            height={630}
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Key Highlights under image */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-center pt-2">
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-950">Camera-Free Chat</h3>
            <p className="text-xs text-zinc-500">Pure text messaging with zero webcam anxiety</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-950">AI Toxicity Shield</h3>
            <p className="text-xs text-zinc-500">Automated spam and profanity protection</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-950">Switch Modes Anytime</h3>
            <p className="text-xs text-zinc-500">Seamlessly jump between text and video</p>
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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Text Chat Questions
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            Frequently Asked Questions about Text Mode
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">
            Answers to common questions about anonymous text chat on Omeglo.
          </p>
        </div>

        <div className="divide-y divide-zinc-200/80 border-y border-zinc-200/80 pt-2">
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
