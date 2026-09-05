import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://guru-goals.rich-fig-4783.chatgpt.site"),
  title: "guru — 把目標變成今天做得到的事",
  description: "依你的時間、節奏與榜樣，生成真正排得進生活的行動計畫。",
  openGraph: {
    title: "guru — 讓好計畫，真的發生",
    description: "一個目標，三種節奏。每天只看現在該做的事。",
    locale: "zh_TW",
    type: "website",
    images: [{ url: "/og-tech.png", alt: "guru — 把目標，排進生活。" }],
  },
  twitter: { card: "summary_large_image", title: "guru — 把目標，排進生活。", images: ["/og-tech.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
