import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getquill.ai"
const DESCRIPTION =
  "Snap a photo of a government form. Get a filled PDF in 60 seconds. BIR, SEC, Mayor's Permit — automated."

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Quill · 翎 — AI Permit Advisor for Philippine SMEs",
    template: "%s · Quill",
  },
  description: DESCRIPTION,
  applicationName: "Quill",
  authors: [{ name: "Quill" }],
  openGraph: {
    type: "website",
    siteName: "Quill",
    title: "Quill · 翎 — AI Permit Advisor for Philippine SMEs",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quill · 翎",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
