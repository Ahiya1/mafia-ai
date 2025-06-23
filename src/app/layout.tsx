// src/app/layout.tsx - Root Layout for AI Mafia
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Mafia - Social Deduction with AI Personalities",
  description:
    "A groundbreaking social deduction game that merges classic Mafia mechanics with cutting-edge AI personalities.",
  keywords: ["mafia", "social deduction", "ai", "game", "multiplayer"],
  authors: [{ name: "AI Mafia Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "AI Mafia - Social Deduction with AI Personalities",
    description:
      "Play Mafia with sophisticated AI players that exhibit distinct personalities and strategies.",
    url: "https://mafia-ai.xyz",
    siteName: "AI Mafia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mafia - Social Deduction with AI Personalities",
    description:
      "Play Mafia with sophisticated AI players that exhibit distinct personalities and strategies.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-noir-black text-white antialiased`}
      >
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
