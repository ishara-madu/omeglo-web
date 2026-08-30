import Link from "next/link";
import Image from "next/image";
import { Shield, Lock, Globe, MessageSquare, Video } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-zinc-200/80 mt-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12 mb-10">
          {/* Col 1: Brand & Bio */}
          <div className="md:col-span-2 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Image
                  src="/logo.webp"
                  alt="Omeglo Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-zinc-950">
                Omeglo
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">
                100% Free
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-md">
              Omeglo is the premier free, anonymous random video and text chat platform. Connect instantly with verified strangers worldwide through encrypted peer-to-peer WebRTC connections with zero registration.
            </p>
            <div className="flex items-center gap-3 text-zinc-400 text-xs pt-1">
              <span className="inline-flex items-center gap-1.5 text-zinc-600">
                <Lock className="w-3.5 h-3.5 text-zinc-500" /> End-to-End P2P
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-zinc-600">
                <Shield className="w-3.5 h-3.5 text-zinc-500" /> AI Moderated
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-zinc-600">
                <Globe className="w-3.5 h-3.5 text-zinc-500" /> Worldwide
              </span>
            </div>
          </div>

          {/* Col 2: Quick Chat Modes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
              Chat Modes
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/"
                  className="text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 transition-colors"
                >
                  <Video className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Random Video Chat</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/text"
                  className="text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Anonymous Text Chat</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-zinc-600 hover:text-zinc-950 transition-colors"
                >
                  Frequently Asked Questions
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Safety */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
              Trust & Legal
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/safety"
                  className="text-zinc-600 hover:text-zinc-950 transition-colors"
                >
                  Community & Safety Rules
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-zinc-600 hover:text-zinc-950 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-zinc-600 hover:text-zinc-950 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 18+ Disclaimer & Copyright Bottom Bar */}
        <div className="pt-6 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-950">
              18+
            </span>
            <span>
              Omeglo is strictly intended for adults aged 18 and older. Video chat is monitored with automated AI safety systems.
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span>© {currentYear} Omeglo. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
