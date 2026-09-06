import type { Metadata } from "next";
import { PlanStation } from "../components/plan/PlanStation";
import { loadSnapshot } from "@/lib/api/client";
import { acceptPlan } from "./actions";

export const metadata: Metadata = {
  title: "目標樹草案",
  description: "教練起草、你確認。四要素、效果假設、反證條件，以及一年只有三個推進名額。",
};

export default async function PlanPage() {
  const { snapshot } = await loadSnapshot();
  return <PlanStation snapshot={snapshot} onAccept={acceptPlan} />;
}
