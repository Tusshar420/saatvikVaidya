import type { Metadata } from "next";
import {
  DM_Sans,
  Manrope,
  Noto_Sans_Devanagari,
  Noto_Serif_Devanagari,
} from "next/font/google";
import { ErrorReporter } from "@/components/error-reporter";
import { ToastProvider } from "@/components/ui/toast";
import { site } from "@/content/site";
import "./globals.css";

// next/font self-hosts these at build time, so no font origin is added to the
// CSP. globals.css exposes them as --font-heading and --font-body.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Devanagari faces are fallbacks for Hindi text. They aren't preloaded: the
// browser only fetches them (by unicode-range) when Hindi appears on a page.
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-sans-devanagari",
  display: "swap",
  preload: false,
});

const notoSerifDevanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-serif-devanagari",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${dmSans.variable} ${notoSansDevanagari.variable} ${notoSerifDevanagari.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <ErrorReporter />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
