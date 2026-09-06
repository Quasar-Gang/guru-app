import type { Metadata } from "next";
import { LedgerStation } from "../components/ledger/LedgerStation";
import { loadSnapshot } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "季度對帳",
  description: "痕跡歸戶、四種對帳結果、四項判準，以及下一季的錨點處方。出席率不計入進展。",
};

export default async function LedgerPage() {
  const { snapshot } = await loadSnapshot();
  return <LedgerStation snapshot={snapshot} />;
}
