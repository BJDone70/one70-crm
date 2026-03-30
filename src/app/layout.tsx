import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONE70 CRM",
  description: "ONE70 Group - Commercial Construction CRM",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon-16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png?v=2", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ONE70 CRM",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

import KeyboardHandler from "@/components/keyboard-handler";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://jmwwngvleszbdlevabbh.supabase.co" />
        <link rel="dns-prefetch" href="https://jmwwngvleszbdlevabbh.supabase.co" />
      </head>
      <body className="antialiased">
        <KeyboardHandler />
        {children}
      </body>
    </html>
  );
}
