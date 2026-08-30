import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Flag, AlertTriangle, Eye, Lock, ThumbsUp } from "lucide-react";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Safety & Community Guidelines",
  description:
    "Discover how to stay safe while video chatting on Omeglo, how our AI moderation works, and how to report rule violations.",
  alternates: {
    canonical: "/safety",
  },
};

export default function SafetyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans">
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
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>User Protection & Safety First</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
            Omeglo Community Safety Guidelines
          </h1>
          <p className="text-xs text-zinc-500">
            Learn best practices for protecting your personal identity and keeping online video chat enjoyable for everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-zinc-950">Never Share Personal Info</h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Do not disclose your full name, phone number, physical address, financial info, or personal social media handles to strangers.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-zinc-950">Instant Report & Disconnect</h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              If a stranger is rude, inappropriate, or violates rules, click the <strong>Flag</strong> icon to submit an instant report and skip them immediately.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-zinc-950">Encrypted P2P Streams</h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              All video transmissions are end-to-end peer-to-peer. Streams are never recorded, archived, or shared with third parties.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
              <ThumbsUp className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-zinc-950">Be Respectful & Kind</h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Treat everyone with dignity. Bullying, vulgarity, racism, harassment, and unsolicited explicit behavior lead to permanent bans.
            </p>
          </div>
        </div>

        <div className="bg-zinc-900 text-white p-6 rounded-2xl space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Zero Tolerance Policy
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Omeglo strictly enforces a zero-tolerance policy against minor exploitation, illegal substances, hate speech, threats of violence, and non-consensual sexual content. Accounts violating these rules are permanently banned and reported to relevant authorities where required.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
