import type { Metadata } from "next";
// Load order matters: tokens, then components, then the local extension layer.
// Nothing else in the application declares styles — pages carry classes only.
import "./styles/mist.tokens.css";
import "./styles/mist.components.css";
import "./styles/mist.extensions.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://guru-goals.rich-fig-4783.chatgpt.site"),
  title: {
    default: "個人教練 · 把你的一年變成一本可以對帳的帳",
    template: "%s · 個人教練",
  },
  description:
    "不要求你新增任何紀錄。讀既有痕跡、歸戶到目標分支、把「有做但沒效」變成看得見的一格。",
  openGraph: {
    title: "個人教練 · 把你的一年變成一本可以對帳的帳",
    description: "訂目標 → 排行動 → 排菜單 → 追執行 → 驗成效。差異化在判準層，不在通道層。",
    locale: "zh_TW",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "個人教練" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500&family=Noto+Sans+TC:wght@400;500&display=swap"
        />
      </head>
      <body className="mist">{children}</body>
    </html>
  );
}
