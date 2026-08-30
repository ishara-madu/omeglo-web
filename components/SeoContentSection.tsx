"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Video,
  MessageSquare,
  ShieldCheck,
  Zap,
  Globe,
  Sparkles,
  ChevronDown,
  Lock,
  UserCheck,
  HeartHandshake,
  CheckCircle2,
  HelpCircle,
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

export default function SeoContentSection() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16 space-y-16">
      {/* 1. Hero SEO Heading & Overview */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-zinc-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>The #1 Next-Generation Omegle Alternative</span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
          Free Random Video & Anonymous Text Chat with Strangers
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
          Meet fascinating people from around the world in one click. Experience lightning-fast HD video calls, anonymous text messaging, gender preferences, and state-of-the-art privacy protection on Omeglo.
        </p>
      </div>

      {/* 2. Core Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center mb-4">
            <Video className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-950 mb-1.5">
            Instant HD Video Chat
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Crystal clear video calls with zero latency powered by direct WebRTC peer-to-peer streaming.
          </p>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-950 mb-1.5">
            100% Private & Anonymous
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            No signup, registration, or credit card required. Your personal identity stays completely anonymous.
          </p>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center mb-4">
            <UserCheck className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-950 mb-1.5">
            Gender Match Preference
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Select your chat preference to find female, male, or open random chat matches effortlessly.
          </p>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs hover:border-zinc-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-950 mb-1.5">
            AI Automated Safety
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Real-time automated content filtering and swift one-click stranger reporting keep interactions friendly.
          </p>
        </div>
      </div>

      {/* 3. How to Use Omeglo (3 Easy Steps) */}
      <div className="bg-zinc-950 text-white rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden">
        <div className="max-w-2xl mb-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Quick Start Guide
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 text-white">
            How to Start Chatting on Omeglo in 3 Steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div className="space-y-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
            <div className="w-7 h-7 rounded-full bg-white text-zinc-950 font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h3 className="text-sm font-bold text-white">Choose Chat Mode</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Select <strong>Video Chat</strong> to meet people face-to-face or <strong>Text Chat</strong> for camera-free anonymous messaging.
            </p>
          </div>

          <div className="space-y-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
            <div className="w-7 h-7 rounded-full bg-white text-zinc-950 font-bold text-xs flex items-center justify-center">
              2
            </div>
            <h3 className="text-sm font-bold text-white">Allow Permissions</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When prompted by your browser, allow Camera & Mic access (all video is direct P2P and never recorded).
            </p>
          </div>

          <div className="space-y-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
            <div className="w-7 h-7 rounded-full bg-white text-zinc-950 font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h3 className="text-sm font-bold text-white">Click Start & Enjoy</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Hit <strong>Start Chat</strong> to instantly meet a new stranger. Press <strong>Skip</strong> or <strong>Esc</strong> anytime to find someone new.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Frequently Asked Questions (FAQ) with Accordions */}
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <HelpCircle className="w-4 h-4 text-zinc-600" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500">
            Everything you need to know about using Omeglo safely and anonymously.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-zinc-950" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3 animate-in fade-in duration-150">
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
