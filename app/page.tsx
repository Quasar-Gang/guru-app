import type { Metadata } from "next";
import { IntakeStation } from "./components/intake/IntakeStation";
import { loadSnapshot } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "方向假設",
  description: "先定期間，再讀痕跡，最後拿痕跡跟你想要的能力對一次。產出是假設 v0，不是願景。",
};

export default async function IntakePage() {
  const { snapshot } = await loadSnapshot();
  return <IntakeStation snapshot={snapshot} />;
}
