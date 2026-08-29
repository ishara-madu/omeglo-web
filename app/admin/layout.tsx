import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Omeglo Admin & Moderation Portal",
  description: "Internal moderation dashboard for managing Omeglo reports, shadow quarantine, and bans.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">{children}</div>;
}
