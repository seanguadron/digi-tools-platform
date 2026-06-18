import type { Metadata, Viewport } from "next";
import { Geist_Mono, Open_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const sans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Digi Tools",
    template: "%s | Digi Tools",
  },
  description:
    "A local-first browser toolbox for building prompts and structured artifacts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#151820" },
  ],
};

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem("digitools.theme");
      const theme = saved === "light" || saved === "dark" ? saved : "dark";
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
