import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ato-mcp.com — Australian tax retrieval for AI agents",
  description:
    "Connect your AI agent to the Australian Taxation Office knowledge base. Search legislation, rulings, and determinations via MCP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
