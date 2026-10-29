import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_URL } from "@/lib/env";
import { APP_TAGLINE } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "UniSync connects print queues, timetables, mentorship, opportunities and campus maintenance in one secure campus platform.";

function siteUrl() {
  try {
    return new URL(APP_URL);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  applicationName: "UniSync",
  title: {
    default: `UniSync | ${APP_TAGLINE}`,
    template: "%s · UniSync",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "UniSync",
    title: `UniSync | ${APP_TAGLINE}`,
    description: DESCRIPTION,
    url: APP_URL,
  },
  twitter: {
    card: "summary",
    title: `UniSync | ${APP_TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
