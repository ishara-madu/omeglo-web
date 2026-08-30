import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Scale, AlertCircle, UserCheck, ShieldAlert } from "lucide-react";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the Omeglo Terms of Service, user conduct rules, 18+ age restrictions, and prohibited content policies.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
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
            <span className="font-bold text-sm text-zinc-900">Terms of Service</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[11px] font-semibold">
            <Scale className="w-3 h-3" />
            <span>User Agreement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
            Omeglo Terms of Service
          </h1>
          <p className="text-xs text-zinc-400">
            Last Updated: August 2026 • Please read these terms carefully before using Omeglo.
          </p>
        </div>

        <div className="prose prose-zinc max-w-none text-xs sm:text-sm space-y-6 text-zinc-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-zinc-600" />
              1. Minimum Age Requirement (18+)
            </h2>
            <p>
              You must be at least 18 years old to access or use Omeglo. If you are under the age of 18, you are strictly prohibited from using the service. By clicking &quot;Start Chat&quot; or using any portion of Omeglo, you represent and warrant that you are of legal adult age.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              2. Prohibited Conduct & Content
            </h2>
            <p>
              To protect all users and maintain a welcoming community, the following behaviors and contents are strictly forbidden:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>Transmitting illegal, sexually explicit, abusive, or non-consensual content.</li>
              <li>Harassment, hate speech, threats, bullying, or discrimination against any individual.</li>
              <li>Broadcasting pre-recorded video loops, automated bots, commercial advertisements, or spam.</li>
              <li>Attempting to capture, record, or distribute live video of other users without explicit written consent.</li>
              <li>Attempting to compromise, reverse engineer, or flood the signaling servers or peers.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-zinc-600" />
              3. Moderation & Termination
            </h2>
            <p>
              Omeglo reserves the right to terminate, quarantine, or permanently ban any IP address, device fingerprint, or client found violating these Terms of Service without prior notice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-950">
              4. Disclaimer of Warranties & Limitation of Liability
            </h2>
            <p>
              Omeglo is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. You acknowledge that interactions with strangers carry inherent unpredictability and you agree to use discretion, report inappropriate content, and immediately disconnect if you feel uncomfortable.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
