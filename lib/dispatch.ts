import type { DispatchAnswer, DispatchInput } from "./contracts";

/**
 * Gap dispatch: the user has an unplanned opening and asks what to do with it.
 *
 * Requires no record keeping, only a question, which is why it is expected to
 * be the most-used feature in the product. The decision runs on time flow and
 * money flow, so it is computed rather than felt.
 *
 * Known gap (design C2): with credit-card statements out of scope, money flow
 * has no automatic source. The cash axis is therefore a declared input, and
 * the UI says so rather than implying the number came from a bank.
 */

export function dispatch({ hours, energy, cash }: DispatchInput): DispatchAnswer {
  if (energy === "low" || hours < 1) {
    return {
      pick: "shadowing",
      unit: "一次 15 分 · 低耗能 · 累積型保底",
      why: [
        energy === "low" ? "能量狀態低，高耗能動作排入必定爆掉" : "可用時數低於單位動作門檻",
        "累積型斷鏈成本不對稱：斷一週要重來，作品集延一週就只是延一週",
        "本週最低週量 2 次，這次計入保底",
      ],
    };
  }

  if (cash === "tight") {
    return {
      pick: "接案作品集",
      unit: "一夜一案 · 180 分 · 高耗能",
      why: [
        "金錢流轉緊，優先補現金而非長期職涯資本",
        `可用 ${hours} 小時、能量${energy === "high" ? "高" : "中"}，容得下高耗能單位動作`,
        "此分支未取得本季名額，計為超額投入並標記",
      ],
    };
  }

  return {
    pick: "HCI 作品集",
    unit: `一夜一案 · 180 分 · ${hours >= 4 ? "高耗能 · 時數充裕" : "高耗能"}`,
    why: [
      "金錢流健康，投長期職涯資本而非短期現金",
      "此分支落後且連續 8 週零動作，四判準中命中兩項",
      hours >= 4
        ? "可用 4 小時，足以完成一個完整單位動作"
        : "可用 2 小時，只排最小可交付段落，不排理想量",
    ],
  };
}
