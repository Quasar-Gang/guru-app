import type { Metadata } from "next";
import { PlanStation } from "../components/plan/PlanStation";
import { createClient } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "目標樹草案",
  description: "教練起草、你確認。四要素、效果假設、反證條件，以及一年只有三個推進名額。",
};

export default async function PlanPage() {
  const snapshot = await createClient().getSnapshot();
  return <PlanStation snapshot={snapshot} />;
}
