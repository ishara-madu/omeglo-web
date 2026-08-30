import type { Metadata } from "next";
import Home from "@/app/page";

export const metadata: Metadata = {
  title: "Omeglo Text - Free Anonymous Random Text Chat (No Camera)",
  description: "Chat with random strangers online via anonymous text chat. Zero camera required, 100% private, instant matching with people worldwide.",
  keywords: [
    "random text chat",
    "anonymous text chat",
    "stranger chat without camera",
    "talk to strangers text",
    "omegle text alternative",
    "free random chat",
  ],
  alternates: {
    canonical: "https://omeglo.com/text",
  },
  openGraph: {
    title: "Omeglo Text - Free Anonymous Random Text Chat",
    description: "Instant anonymous text chat with strangers. No webcam or registration required.",
    url: "https://omeglo.com/text",
    siteName: "Omeglo",
    type: "website",
    images: [
      {
        url: "/opengraph-image.webp",
        width: 1200,
        height: 630,
        alt: "Omeglo Text - Free Anonymous Random Text Chat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omeglo Text - Free Anonymous Random Text Chat",
    description: "Instant anonymous text chat with strangers. No webcam or registration required.",
    images: ["/opengraph-image.webp"],
  },
};

export default function TextPage() {
  return <Home initialMode="text" />;
}
