import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "../components/site/Nav";
import { Footer } from "../components/site/Footer";
import "./globals.css";

// Switzer is self-hosted (Fontshare / ITF Free Font License — see app/fonts/FFL.txt).
const sans = localFont({
  src: [
    { path: "./fonts/Switzer-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Switzer-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const SITE = "https://ato-mcp.com.au";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "ato-mcp — The Australian tax knowledge base for AI agents",
    template: "%s · ato-mcp",
  },
  description:
    "Give Claude and any MCP agent cited, current retrieval over 29,000+ ATO documents, ITAA 1997 and public rulings — plus personal context and four tax workflow tools. Local or hosted. Open source.",
  keywords: [
    "ATO MCP server",
    "Australian tax AI",
    "Model Context Protocol",
    "Claude tax tools",
    "ATO API for AI agents",
    "ITAA 1997 search",
    "Australian tax deductions AI",
    "BAS checklist AI",
    "tax RAG Australia",
  ],
  authors: [{ name: "William Laverty", url: "https://github.com/william-laverty" }],
  creator: "William Laverty",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: SITE,
    siteName: "ato-mcp",
    title: "ato-mcp — The Australian tax knowledge base for AI agents",
    description:
      "Cited retrieval over 29,000+ ATO documents, ITAA 1997 and rulings, with personal context and tax workflow tools for AI agents. Local or hosted. Open source.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ato-mcp — The Australian tax knowledge base for AI agents",
    description:
      "Cited ATO retrieval + tax workflow tools for AI agents over the Model Context Protocol. Local or hosted. Open source.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "ato-mcp",
      url: SITE,
      logo: `${SITE}/icon.svg`,
      sameAs: ["https://github.com/william-laverty/ato-mcp"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "ato-mcp",
      publisher: { "@id": `${SITE}/#org` },
      inLanguage: "en-AU",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <Nav />
        <div className="pt-16">{children}</div>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
