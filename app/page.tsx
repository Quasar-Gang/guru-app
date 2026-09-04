import type { Metadata } from "next";
import GuruApp from "./components/GuruApp";

export const metadata: Metadata = {
  title: "guru — 把目標變成今天做得到的事",
  description: "依你的時間、節奏與榜樣，生成真正排得進生活的行動計畫。",
};

export default function Home() {
  return <GuruApp />;
}
