"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GuruApiClient,
  GuruApiError,
  localDate,
  type CheckinHistory,
  type Difficulty,
  type FollowupQuestion,
  type PlanDetail,
  type PlanSummary as Plan,
  type PlanTask,
  type Revision,
  type RoleModel,
  type TaskStatus,
} from "../lib/guru-api";

type View = "today" | "plan" | "progress";
type Task = { id: string; title: string; description: string; time: string; endTime: string; duration: number; type: "session" | "habit" | "checkpoint"; status: TaskStatus; color: string };
type Toast = { message: string; tone?: "success" | "info" | "error" } | null;

const demoPlans: Plan[] = [
  { id: "easy", title: "穩穩跑進 30 分", difficulty: "easy", duration_weeks: 15, start_date: "2026-09-07", deadline: "2026-12-20", goal_statement: "在 30 分鐘內跑完 5 公里。", sessions_per_week: 3, total_minutes_per_week: 105, completion_rate: 0.12, status: "draft" },
  { id: "hard", title: "12 週 5K 跑進 30 分", difficulty: "hard", duration_weeks: 12, start_date: "2026-09-07", deadline: "2026-11-29", goal_statement: "12 週後，在同一路線完成 5 公里，時間不超過 30 分鐘。", sessions_per_week: 4, total_minutes_per_week: 150, completion_rate: 0.12, status: "active" },
  { id: "extreme", title: "高強度 5K 突破計畫", difficulty: "extremely_hard", duration_weeks: 10, start_date: "2026-09-07", deadline: "2026-11-15", goal_statement: "10 週後完成 5 公里突破測驗。", sessions_per_week: 5, total_minutes_per_week: 210, completion_rate: 0.12, status: "draft" },
];

const initialTasks: Task[] = [
  { id: "t1", title: "輕鬆跑", description: "可以邊跑邊說話的配速，完成比速度重要。", time: "19:30", endTime: "20:00", duration: 30, type: "session", status: "pending", color: "mint" },
  { id: "t2", title: "跑後伸展", description: "小腿、股四頭肌與髖屈肌，各 30 秒兩組。", time: "20:05", endTime: "20:15", duration: 10, type: "habit", status: "pending", color: "lilac" },
];

const navItems: { key: View; label: string; icon: string }[] = [
  { key: "today", label: "今天", icon: "◎" },
  { key: "plan", label: "我的計畫", icon: "▤" },
  { key: "progress", label: "進度", icon: "↗" },
];

function toDisplayTask(task: PlanTask, index: number): Task {
  const start = new Date(task.start_at);
  const end = new Date(task.end_at);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    time: task.all_day ? "全天" : start.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }),
    endTime: task.all_day ? "" : end.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }),
    duration: task.all_day ? 0 : Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
    type: task.task_type,
    status: task.status,
    color: index % 2 ? "lilac" : "mint",
  };
}

function apiConfig() {
  if (typeof window === "undefined") return { base: "", token: "" };
  return {
    base: (localStorage.getItem("guru_api_base") || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, ""),
    token: localStorage.getItem("guru_token") || "",
  };
}

export default function GuruApp() {
  const [view, setView] = useState<View>("today");
  const [tasks, setTasks] = useState(initialTasks);
  const [plans, setPlans] = useState(demoPlans);
  const [activePlan, setActivePlan] = useState("hard");
  const [showCreate, setShowCreate] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState("12 週");
  const [capacity, setCapacity] = useState("每週 3–4 小時");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [apiBase, setApiBase] = useState("");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [checkins, setCheckins] = useState<CheckinHistory | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [traitId, setTraitId] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [traits, setTraits] = useState<RoleModel[]>([
    { id: "", name: "讓 guru 建議", kind: "trait", tags: [], summary: "" }, { id: "demo-steady", name: "穩扎穩打型", kind: "trait", tags: [], summary: "" }, { id: "demo-easy", name: "輕鬆寫意型", kind: "trait", tags: [], summary: "" }, { id: "demo-intense", name: "地獄模式型", kind: "trait", tags: [], summary: "" },
  ]);
  const [personas, setPersonas] = useState<RoleModel[]>([
    { id: "", name: "暫時不選", kind: "persona", tags: [], summary: "" }, { id: "demo-kipchoge", name: "Eliud Kipchoge 型", kind: "persona", tags: [], summary: "" }, { id: "demo-curry", name: "Stephen Curry 型", kind: "persona", tags: [], summary: "" },
  ]);
  const [questions, setQuestions] = useState<FollowupQuestion[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [importIds, setImportIds] = useState<string[]>([]);
  const [importLabel, setImportLabel] = useState("");
  const client = useMemo(() => new GuruApiClient(apiBase, token), [apiBase, token]);

  const notify = useCallback((message: string, tone: "success" | "info" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const reportError = useCallback((error: unknown) => {
    const message = error instanceof GuruApiError ? error.message : "無法完成 guru-core 請求";
    notify(message, "error");
  }, [notify]);

  const loadPlanData = useCallback(async (apiClient: GuruApiClient, planId: string) => {
    const today = localDate();
    const [detail, taskList, history] = await Promise.all([
      apiClient.getPlan(planId),
      apiClient.listTasks(planId, today, today),
      apiClient.listCheckins(planId),
    ]);
    setPlanDetail(detail);
    setCheckins(history);
    setTasks(taskList.items.map(toDisplayTask));
  }, []);

  useEffect(() => {
    const config = apiConfig();
    const load = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const oauthFlow = sessionStorage.getItem("guru_oauth_flow");
        let activeToken = config.token;
        if (code && oauthFlow === "google-login") {
          const redirectUri = `${window.location.origin}${window.location.pathname}`;
          const login = await new GuruApiClient(config.base).loginWithGoogle(code, redirectUri);
          activeToken = login.access_token;
          localStorage.setItem("guru_token", activeToken);
          setToken(activeToken);
          setUserEmail(login.email);
          sessionStorage.removeItem("guru_oauth_flow");
          url.searchParams.delete("code");
          url.searchParams.delete("scope");
          url.searchParams.delete("state");
          history.replaceState({}, "", url.toString());
          notify(login.is_new_user ? "帳號已建立並登入" : "已登入 guru-core");
        }
        if (!activeToken) return;
        const configuredClient = new GuruApiClient(config.base, activeToken);
        const [me, nextPlans, roleTraits, rolePersonas] = await Promise.all([
          configuredClient.me(),
          configuredClient.listPlans(),
          configuredClient.listRoleModels("trait"),
          configuredClient.listRoleModels("persona"),
        ]);
        setUserEmail(me.email);
        setConnected(true);
        setTraits([{ id: "", name: "讓 guru 建議", kind: "trait", tags: [], summary: "" }, ...roleTraits]);
        setPersonas([{ id: "", name: "暫時不選", kind: "persona", tags: [], summary: "" }, ...rolePersonas]);
        setPlans(nextPlans);
        const selected = nextPlans.find((plan) => plan.status === "active") || nextPlans[0];
        setActivePlan(selected?.id || "");
        if (!selected) { setTasks([]); setPlanDetail(null); setCheckins(null); }

        if (code && oauthFlow === "google-calendar") {
          await configuredClient.completeIntegration("google", code);
          sessionStorage.removeItem("guru_oauth_flow");
          url.searchParams.delete("code");
          url.searchParams.delete("scope");
          url.searchParams.delete("state");
          history.replaceState({}, "", url.toString());
          notify("Google Calendar 已連接");
        }
      } catch (error) {
        setConnected(false);
        reportError(error);
      }
    };
    const timer = window.setTimeout(() => {
      setApiBase(config.base);
      setToken(config.token);
      if (config.base) void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [notify, reportError]);

  useEffect(() => {
    if (!connected || !activePlan) return;
    const timer = window.setTimeout(() => { void loadPlanData(client, activePlan).catch(reportError); }, 0);
    return () => window.clearTimeout(timer);
  }, [activePlan, client, connected, loadPlanData, reportError]);

  const completed = tasks.filter((task) => task.status === "done").length;
  const todayMinutes = tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.duration, 0);
  const currentPlan = plans.find((plan) => plan.id === activePlan) || plans[1] || plans[0];

  const updateTaskStatus = async (task: Task, status: TaskStatus) => {
    const nextStatus: TaskStatus = task.status === status ? "pending" : status;
    const previousStatus = task.status;
    setTasks((all) => all.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    if (!connected) { if (nextStatus === "done") notify(`完成「${task.title}」`); return; }
    try {
      await client.updateTask(activePlan, task.id, { status: nextStatus });
      if (nextStatus === "done") notify(`完成「${task.title}」`);
      const detail = await client.getPlan(activePlan);
      setPlanDetail(detail);
    } catch (error) {
      setTasks((all) => all.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item));
      reportError(error);
    }
  };

  const submitCheckin = async () => {
    const results = tasks.filter((task) => task.status !== "pending").map((task) => ({ task_id: task.id, status: task.status }));
    if (!results.length) { notify("先記錄至少一項任務的狀態", "info"); return; }
    if (!connected) { notify("展示模式已記錄今日回顧", "info"); return; }
    try {
      await client.submitCheckin(activePlan, localDate(), results as Array<{ task_id: string; status: "done" | "missed" | "skipped" }>);
      setCheckins(await client.listCheckins(activePlan));
      setPlanDetail(await client.getPlan(activePlan));
      notify("今天的回顧已儲存");
    } catch (error) { reportError(error); }
  };

  const createPlan = async () => {
    if (!goal.trim()) return;
    setCreating(true);
    if (!connected) {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      setCreating(false); setShowCreate(false); setShowCompare(true);
      notify("展示模式已準備三種節奏");
      return;
    }
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await client.updateProfile({ horizon: weeks, capacity }, timezone);
      const session = await client.createPlanSession({
        goal: goal.trim(),
        intake: { horizon: weeks, weekly_capacity: capacity },
        ...(traitId ? { trait_role_model_id: traitId } : {}),
        ...(personaId ? { persona_role_model_id: personaId } : {}),
        ...(importIds.length ? { import_ids: importIds } : {}),
      });
      setSessionId(session.session_id);
      notify(`計畫已送出，工作編號 ${session.job_id}`, "info");
      setCreating(false);
      setShowCreate(false);
      await pollSession(session.session_id);
    } catch (error) { setCreating(false); reportError(error); }
  };

  const pollSession = async (id: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await client.getPlanSession(id);
      if (state.status === "questioning") {
        setQuestions(state.questions || []);
        setShowQuestions(true);
        return;
      }
      if (state.status === "done") {
        if (state.plans.length) {
          setPlans(state.plans);
          setActivePlan(state.plans.find((plan) => plan.status === "active")?.id || state.plans[1]?.id || state.plans[0].id);
        }
        setShowCompare(true);
        notify("三種節奏的計畫已準備好");
        return;
      }
      if (state.status === "failed") throw new Error(state.error || "Plan generation failed");
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    notify("AI 還在整理計畫，稍後再回來查看", "info");
  };

  const submitAnswers = async (answers: Record<string, string>) => {
    setShowQuestions(false);
    notify("收到，正在完成你的計畫", "info");
    try {
      await client.submitAnswers(sessionId, questions.map((question) => {
        const answer = answers[question.id]?.trim();
        if (!answer) return { question_id: question.id, skipped: true };
        return question.options.includes(answer)
          ? { question_id: question.id, choice: answer, skipped: false }
          : { question_id: question.id, custom: answer, skipped: false };
      }));
      await pollSession(sessionId);
    } catch (error) { reportError(error); }
  };

  const uploadContext = async (file: File) => {
    setImportLabel(`正在讀取 ${file.name}…`);
    try {
      if (!connected) { setImportLabel(`${file.name} 已加入展示資料`); return; }
      const queued = await client.uploadImport(file);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const current = (await client.listImports()).find((item) => item.id === queued.id);
        if (current?.status === "parsed") {
          setImportIds((all) => Array.from(new Set([...all, current.id])));
          setImportLabel(`${file.name} 已解析`);
          return;
        }
        if (current?.status === "failed") throw new Error(current.error || "Import parsing failed");
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setImportLabel(`${file.name} 仍在解析中`);
    } catch (error) {
      setImportLabel(`${file.name} 無法匯入`);
      reportError(error);
    }
  };

  const connectCalendar = async () => {
    try {
      const result = await client.integrationAuthorize("google");
      sessionStorage.setItem("guru_oauth_flow", "google-calendar");
      window.location.assign(result.authorize_url);
    } catch (error) {
      if (connected) reportError(error);
      else notify("請先在左下角設定 guru-core 連線", "info");
    }
  };

  const choosePlan = async (plan: Plan) => {
    if (connected) {
      try { await client.updatePlan(plan.id, { status: "active" }); } catch (error) { reportError(error); return; }
    }
    setActivePlan(plan.id);
    setPlans((all) => all.map((item) => ({ ...item, status: item.id === plan.id ? "active" : "draft" })));
    setShowCompare(false);
    setView("today");
    notify(`已採用「${plan.title}」`);
  };

  const saveSettings = () => {
    localStorage.setItem("guru_api_base", apiBase.replace(/\/$/, ""));
    localStorage.setItem("guru_token", token);
    setShowSettings(false);
    notify("連線設定已儲存", "info");
    window.location.reload();
  };

  const loginWithGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!apiBase.trim()) { notify("請先填入 guru-core API 網址", "info"); return; }
    if (!clientId) { notify("尚未設定 Google Client ID", "error"); return; }
    localStorage.setItem("guru_api_base", apiBase.replace(/\/$/, ""));
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", prompt: "select_account" });
    sessionStorage.setItem("guru_oauth_flow", "google-login");
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
  };

  const exportPlan = async (target: "markdown" | "google_calendar") => {
    if (!connected) { notify("展示模式不會建立匯出檔", "info"); return; }
    try {
      const result = await client.requestExport(activePlan, target);
      if (target === "markdown" && result.markdown) {
        const link = document.createElement("a");
        link.href = result.markdown.download_url;
        link.download = `${currentPlan?.title || "guru-plan"}.md`;
        link.click();
        notify("Markdown 已開始下載");
      } else notify(`正在同步至 Google Calendar（${result.mode || "full"}）`, "info");
    } catch (error) { reportError(error); }
  };

  const renamePlan = async (title: string) => {
    setPlans((all) => all.map((plan) => plan.id === activePlan ? { ...plan, title } : plan));
    if (connected) { try { await client.updatePlan(activePlan, { title }); } catch (error) { reportError(error); return; } }
    setShowManage(false); notify("計畫名稱已更新");
  };

  const archivePlan = async () => {
    if (connected) { try { await client.archivePlan(activePlan); } catch (error) { reportError(error); return; } }
    setPlans((all) => all.map((plan) => plan.id === activePlan ? { ...plan, status: "archived" } : plan));
    setShowManage(false); notify("計畫已封存", "info");
  };

  const deletePlan = async () => {
    if (connected) { try { await client.deletePlan(activePlan); } catch (error) { reportError(error); return; } }
    const remaining = plans.filter((plan) => plan.id !== activePlan);
    setPlans(remaining); if (remaining[0]) setActivePlan(remaining[0].id);
    setShowManage(false); notify("計畫已刪除", "info");
  };

  const createRevision = async (strategy: "postpone" | "reduce") => {
    setShowRevision(false);
    if (!connected) { notify("展示模式不會變更後續任務", "info"); return; }
    try {
      const created = await client.createRevision(activePlan, strategy);
      notify(`調整工作 ${created.job_id} 已送出`, "info");
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const proposal = await client.getRevision(activePlan, created.revision_id);
        if (proposal.status === "proposed") { setRevision(proposal); return; }
        if (["failed", "accepted", "rejected"].includes(proposal.status)) throw new Error(`Revision ended with status ${proposal.status}`);
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      notify("調整方案仍在產生中，請稍後再查看", "info");
    } catch (error) { reportError(error); }
  };

  const decideRevision = async (decision: "accept" | "reject") => {
    if (!revision) return;
    try {
      await client.decideRevision(activePlan, revision.id, decision);
      setRevision(null);
      await loadPlanData(client, activePlan);
      notify(decision === "accept" ? "已套用新的後續安排" : "已保留原本計畫");
    } catch (error) { reportError(error); }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("today")} aria-label="回到今天"><span className="brand-mark">g</span><span>guru</span></button>
        <button className="new-goal" onClick={() => setShowCreate(true)}><span>＋</span> 建立新目標</button>
        <nav aria-label="主要導覽">{navItems.map((item) => <button key={item.key} className={view === item.key ? "nav-item active" : "nav-item"} onClick={() => setView(item.key)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-bottom">
          <button className="connection" onClick={() => setShowSettings(true)}><span className={connected ? "status-dot online" : "status-dot"} /><span><b>{connected ? "後端已連線" : "展示模式"}</b><small>{connected ? "guru-core" : "設定 API 以同步"}</small></span><span className="chevron">›</span></button>
          <div className="user-card"><span className="avatar">{userEmail ? userEmail[0].toUpperCase() : "Y"}</span><span><b>{userEmail || "Yu"}</b><small>讓今天有進度</small></span><button aria-label="更多選項">•••</button></div>
        </div>
      </aside>
      <main className="main">
        <header className="mobile-header"><button className="brand"><span className="brand-mark">g</span><span>guru</span></button><button onClick={() => setShowCreate(true)} aria-label="建立新目標">＋</button></header>
        {view === "today" && <TodayView tasks={tasks} completed={completed} minutes={todayMinutes} onStatus={updateTaskStatus} onCheckin={submitCheckin} onRevision={() => setShowRevision(true)} plan={currentPlan} detail={planDetail} history={checkins} />}
        {view === "plan" && <PlanView plan={currentPlan} detail={planDetail} plans={plans} onCompare={() => setShowCompare(true)} onExport={exportPlan} onRevision={() => setShowRevision(true)} onManage={() => setShowManage(true)} />}
        {view === "progress" && <ProgressView detail={planDetail} history={checkins} />}
      </main>
      <nav className="mobile-nav" aria-label="行動版導覽">{navItems.map((item) => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      {showCreate && <CreateModal goal={goal} setGoal={setGoal} weeks={weeks} setWeeks={setWeeks} capacity={capacity} setCapacity={setCapacity} traitId={traitId} setTraitId={setTraitId} personaId={personaId} setPersonaId={setPersonaId} traits={traits} personas={personas} importLabel={importLabel} onUpload={uploadContext} onCalendar={connectCalendar} creating={creating} onCreate={createPlan} onClose={() => setShowCreate(false)} />}
      {showCompare && <CompareModal plans={plans} activeId={activePlan} onChoose={choosePlan} onClose={() => setShowCompare(false)} />}
      {showRevision && <RevisionModal onClose={() => setShowRevision(false)} onSubmit={createRevision} />}
      {revision && <RevisionProposalModal revision={revision} onDecision={decideRevision} onClose={() => setRevision(null)} />}
      {showSettings && <SettingsModal apiBase={apiBase} token={token} setApiBase={setApiBase} setToken={setToken} onGoogleLogin={loginWithGoogle} onSave={saveSettings} onClose={() => setShowSettings(false)} />}
      {showQuestions && <QuestionsModal questions={questions} onSubmit={submitAnswers} onClose={() => setShowQuestions(false)} />}
      {showManage && currentPlan && <ManageModal plan={currentPlan} onRename={renamePlan} onArchive={archivePlan} onDelete={deletePlan} onClose={() => setShowManage(false)} />}
      {toast && <div className={`toast ${toast.tone || "success"}`} role="status"><span>{toast.tone === "error" ? "!" : toast.tone === "info" ? "↗" : "✓"}</span>{toast.message}</div>}
    </div>
  );
}

function TodayView({ tasks, completed, minutes, onStatus, onCheckin, onRevision, plan, detail, history }: { tasks: Task[]; completed: number; minutes: number; onStatus: (task: Task, status: TaskStatus) => void; onCheckin: () => void; onRevision: () => void; plan?: Plan; detail: PlanDetail | null; history: CheckinHistory | null }) {
  const now = new Date();
  const dayProgress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const rateByDate = new Map((history?.daily_rates || []).map((item) => [item.date, item.rate]));
  const weekDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return { key: localDate(date), d: ["一", "二", "三", "四", "五", "六", "日"][index], n: String(date.getDate()).padStart(2, "0"), today: localDate(date) === localDate(now), done: (rateByDate.get(localDate(date)) || 0) > 0 }; });
  const weekRates = weekDays.map((day) => rateByDate.get(day.key)).filter((rate): rate is number => rate !== undefined);
  const weekScore = weekRates.length ? Math.round(weekRates.reduce((sum, rate) => sum + rate, 0) / weekRates.length * 100) : 0;
  const weekIndex = detail ? Math.max(0, Math.floor((new Date(`${localDate(now)}T00:00:00`).getTime() - new Date(`${detail.start_date}T00:00:00`).getTime()) / 604800000)) : 0;
  const phase = detail?.phases.find((item) => item.week_start <= weekIndex && item.week_end >= weekIndex);
  const overall = Math.round((detail?.progress.completion_rate ?? plan?.completion_rate ?? 0) * 100);
  const dateLabel = now.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  return <div className="page page-enter"><div className="top-row"><div><p className="eyebrow">{dateLabel}</p><h1>今天也往前一點。</h1><p className="lede">不用完美，完成眼前這一步就好。</p></div><div className="streak"><span>↗</span><div><b>整體達成率 {overall}%</b><small>{detail ? `${detail.progress.done} / ${detail.progress.total} 項完成` : "展示資料"}</small></div></div></div><section className="week-strip" aria-label="本週日期"><div className="week-copy"><b>第 {weekIndex + 1} 週</b><span>{phase?.name || "目前階段"}</span></div><div className="days">{weekDays.map((day) => <div key={day.key} className={day.today ? "day today" : "day"}><small>{day.d}</small><span>{day.n}</span>{day.done && <i>✓</i>}</div>)}</div><div className="week-score"><strong>{weekScore}%</strong><span>本週</span></div></section><div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>今天的安排</h2></div><span>{tasks.length - completed} 項 · {minutes} 分鐘</span></div><div className="task-list">{tasks.map((task, index) => <article className={`task-card ${task.status === "done" ? "is-done" : ""}`} key={task.id}><div className={`task-accent ${task.color}`} /><button className="check" onClick={() => onStatus(task, "done")} aria-label={task.status === "done" ? `取消完成 ${task.title}` : `完成 ${task.title}`}>{task.status === "done" ? "✓" : ""}</button><div className="task-time"><b>{task.time}</b><span>{task.endTime}</span></div><div className="task-content"><div className="task-title-row"><h3>{task.title}</h3><span>{task.type === "habit" ? "習慣" : task.type === "checkpoint" ? "里程碑" : "訓練"}</span></div><p>{task.description}</p><div className="task-actions"><button className={task.status === "done" ? "active" : ""} onClick={() => onStatus(task, "done")}>完成</button><button className={task.status === "missed" ? "active missed" : ""} onClick={() => onStatus(task, "missed")}>未達</button><button className={task.status === "skipped" ? "active" : ""} onClick={() => onStatus(task, "skipped")}>略過</button></div></div><span className="task-state">{task.status === "missed" ? "✕" : task.status === "skipped" ? "—" : ""}</span><span className="task-number">{String(index + 1).padStart(2, "0")}</span></article>)}</div>{tasks.length === 0 && <section className="panel"><h3>今天沒有排定任務</h3><p>可以休息，或建立一個新的目標。</p></section>}<div className="checkin-row"><button className="secondary" onClick={onCheckin}>儲存今日回顧</button><span>記錄會用來計算達成率與調整後續計畫。</span></div><section className="plan-note"><div className="note-icon">✦</div><div><p className="eyebrow">YOUR PLAN</p><h3>{plan?.title || "尚未建立計畫"}</h3><p>若今天的安排不合適，可以只調整之後的任務。</p></div>{plan && <button className="text-button" onClick={onRevision}>重新排程 <span>→</span></button>}</section><section className="quote"><p>「真正的進步，是你願意在普通的一天，做一件不普通的小事。」</p><span>— 你的 guru</span><div className="progress-ring" style={{ "--progress": `${dayProgress}%` } as React.CSSProperties}><b>{dayProgress}%</b><small>今日</small></div></section></div>;
}

function PlanView({ plan, detail, plans, onCompare, onExport, onRevision, onManage }: { plan?: Plan; detail: PlanDetail | null; plans: Plan[]; onCompare: () => void; onExport: (target: "markdown" | "google_calendar") => void; onRevision: () => void; onManage: () => void }) {
  const demoPhases = [{ index: 0, name: "建立基礎", week_start: 0, week_end: 3, focus: "養成固定節奏，完成 5K 不停走" }, { index: 1, name: "提升配速", week_start: 4, week_end: 9, focus: "加入間歇訓練，逐步接近目標配速" }, { index: 2, name: "減量測驗", week_start: 10, week_end: 11, focus: "降低訓練量，保持狀態迎接測驗" }];
  const phases = detail?.phases.length ? detail.phases : demoPhases;
  const progress = detail?.progress;
  const criteria = detail?.success_criteria.length ? detail.success_criteria : ["第 12 週完成 5K 測驗不超過 30 分鐘", "全程不停下步行", "完成至少 80% 計畫任務"];
  return <div className="page page-enter"><div className="plan-hero"><div><p className="eyebrow">ACTIVE PLAN</p><h1>{plan?.title}</h1><p className="lede">{detail?.goal_statement || plan?.goal_statement}</p></div><div className="hero-actions"><button className="quiet-button" onClick={onManage}>•••</button><button className="secondary" onClick={onCompare}>比較三種節奏</button><button className="primary" onClick={onRevision}>重新排程</button></div></div><div className="metrics"><div><small>目前進度</small><strong>{Math.round((progress?.completion_rate ?? plan?.completion_rate ?? 0) * 100)}<em>%</em></strong><span>{progress ? `${progress.done} / ${progress.total} 項完成` : "尚未開始"}</span></div><div><small>每週投入</small><strong>{Math.round((plan?.total_minutes_per_week || 0) / 6) / 10}<em>h</em></strong><span>每週 {plan?.sessions_per_week || 0} 次</span></div><div><small>預計完成</small><strong>{plan?.deadline.slice(5).replace("-", ".") || "11.29"}</strong><span>{plan?.duration_weeks || 12} 週計畫</span></div></div><section className="panel"><div className="panel-head"><div><p className="eyebrow">ROADMAP</p><h2>計畫路線</h2></div><span className="pill">{plan?.difficulty === "easy" ? "從容節奏" : plan?.difficulty === "extremely_hard" ? "突破節奏" : "穩健節奏"}</span></div><div className="phase-list">{phases.map((phase, index) => { const phaseRate = progress?.phase_rates.find((item) => item.phase_index === phase.index)?.rate || 0; const pct = Math.round(phaseRate * 100); return <div className="phase" key={`${phase.index}-${phase.name}`}><div className={pct > 0 || index === 0 ? "phase-index active" : "phase-index"}>{index + 1}</div><div className="phase-copy"><div><b>{phase.name}</b><span>W{phase.week_start + 1}–{phase.week_end + 1}</span></div><p>{phase.focus}</p><div className="phase-bar"><i style={{ width: `${pct}%` }} /></div></div><strong>{pct}%</strong></div>; })}</div></section><div className="two-col"><section className="panel"><div className="panel-head"><div><p className="eyebrow">SUCCESS</p><h2>達成標準</h2></div></div><ul className="criteria">{criteria.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ul></section><section className="panel export-panel"><div><p className="eyebrow">TAKE IT WITH YOU</p><h2>同步你的計畫</h2><p>guru 是唯一真實來源。日曆會跟著你的調整更新。</p></div><button onClick={() => onExport("google_calendar")}><span className="google-dot">G</span>Google Calendar <b>→</b></button><button onClick={() => onExport("markdown")}><span className="md-dot">M↓</span>下載 Markdown <b>→</b></button></section></div><p className="plan-count">同一個目標共有 {plans.length} 種可選節奏，你可以隨時更換。</p></div>;
}

function ProgressView({ detail, history }: { detail: PlanDetail | null; history: CheckinHistory | null }) {
  const recent = history?.daily_rates.slice(-7) || [];
  const bars = recent.length ? recent.map((item) => Math.round(item.rate * 100)) : [38, 58, 28, 74, 55, 88, 64];
  const labels = recent.length ? recent.map((item) => new Date(`${item.date}T12:00:00`).toLocaleDateString("zh-TW", { weekday: "short" }).replace("週", "")) : ["五", "六", "日", "一", "二", "三", "四"];
  const rate = Math.round((detail?.progress.completion_rate || 0) * 100);
  return <div className="page page-enter"><div className="top-row"><div><p className="eyebrow">YOUR MOMENTUM</p><h1>進度不是直線。</h1><p className="lede">每一次記錄，都讓下一步更貼近現實。</p></div><div className="streak"><span>✓</span><div><b>整體達成率 {rate}%</b><small>來自實際任務完成紀錄</small></div></div></div><div className="metrics"><div><small>已完成</small><strong>{detail?.progress.done || 0}</strong><span>個計畫任務</span></div><div><small>未達標</small><strong>{detail?.progress.missed || 0}</strong><span>個計畫任務</span></div><div><small>已回顧</small><strong>{history?.items.length || 0}<em>天</em></strong><span>每日紀錄</span></div></div><section className="panel chart-panel"><div className="panel-head"><div><p className="eyebrow">LAST 7 CHECK-INS</p><h2>每天都有留下痕跡</h2></div><span className="trend">{recent.length} 筆紀錄</span></div><div className="bar-chart">{bars.map((height, index) => <div key={`${labels[index]}-${index}`}><span style={{ height: `${height}%` }} className={index === bars.length - 1 ? "highlight" : ""} /><small>{labels[index]}</small></div>)}</div></section><section className="insight"><div className="note-icon">✦</div><div><p className="eyebrow">GURU INSIGHT</p><h2>{rate >= 80 ? "你的節奏很穩定。" : "保留紀錄，比追求完美重要。"}</h2><p>這些 check-in 會成為重新排程時的真實依據。</p></div></section></div>;
}

function ModalShell({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={wide ? "modal wide" : "modal"} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="關閉">×</button>{children}</div></div>; }

function CreateModal({ goal, setGoal, weeks, setWeeks, capacity, setCapacity, traitId, setTraitId, personaId, setPersonaId, traits, personas, importLabel, onUpload, onCalendar, creating, onCreate, onClose }: { goal: string; setGoal: (v: string) => void; weeks: string; setWeeks: (v: string) => void; capacity: string; setCapacity: (v: string) => void; traitId: string; setTraitId: (v: string) => void; personaId: string; setPersonaId: (v: string) => void; traits: RoleModel[]; personas: RoleModel[]; importLabel: string; onUpload: (file: File) => void; onCalendar: () => void; creating: boolean; onCreate: () => void; onClose: () => void }) { return <ModalShell onClose={onClose}><div className="step-label"><span>01</span> / 03</div><p className="eyebrow">NEW DIRECTION</p><h2 className="modal-title">你想完成什麼？</h2><p className="modal-subtitle">只需要一個目標。其他資訊留白也沒關係，guru 會在需要時追問。</p><label className="field"><span>你的目標 <b>必填</b></span><textarea autoFocus value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="例如：12 週後，在 30 分鐘內跑完 5 公里" rows={4} /></label><div className="form-grid"><label className="field"><span>希望用多久 <i>選填</i></span><select value={weeks} onChange={(e) => setWeeks(e.target.value)}><option>8 週</option><option>12 週</option><option>16 週</option><option>不確定</option></select></label><label className="field"><span>每週可投入 <i>選填</i></span><select value={capacity} onChange={(e) => setCapacity(e.target.value)}><option>每週 1–2 小時</option><option>每週 3–4 小時</option><option>每週 5 小時以上</option><option>不確定</option></select></label></div><div className="form-grid role-fields"><label className="field"><span>執行風格 <i>選填</i></span><select value={traitId} onChange={(e) => setTraitId(e.target.value)}>{traits.map((role) => <option value={role.id} key={role.id || "trait-none"}>{role.name}</option>)}</select></label><label className="field"><span>參考榜樣 <i>選填</i></span><select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>{personas.map((role) => <option value={role.id} key={role.id || "persona-none"}>{role.name}</option>)}</select></label></div><div className="context-tools"><label className="upload-button"><input type="file" accept=".csv,.xlsx,.md,.html,.pdf,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); }} /><span>↑</span>{importLabel || "加入參考文件"}</label><button type="button" onClick={onCalendar}><span>G</span>參考 Google Calendar</button></div><div className="role-preview"><span className="role-symbol">✦</span><div><b>AI 只會追問真正缺少的資訊</b><small>最多 2 輪，每題也都可以略過</small></div></div><button className="primary full" disabled={!goal.trim() || creating} onClick={onCreate}>{creating ? "正在理解你的目標…" : "開始生成計畫"}<span>→</span></button></ModalShell>; }

function CompareModal({ plans, activeId, onChoose, onClose }: { plans: Plan[]; activeId: string; onChoose: (plan: Plan) => void; onClose: () => void }) { const labels: Record<Difficulty, { name: string; tag: string; desc: string }> = { easy: { name: "從容", tag: "可長期維持", desc: "壓力最低，給生活保留更多彈性。" }, hard: { name: "穩健", tag: "guru 推薦", desc: "在挑戰與可持續之間取得平衡。" }, extremely_hard: { name: "突破", tag: "高強度", desc: "更密集的節奏，用較短時間達標。" } }; return <ModalShell onClose={onClose} wide><p className="eyebrow center">CHOOSE YOUR PACE</p><h2 className="modal-title center">同一個終點，三種走法。</h2><p className="modal-subtitle center">所有方案都有相同達成標準，差別只在投入強度與時間。</p><div className="compare-grid">{plans.map((plan) => { const copy = labels[plan.difficulty]; const recommended = plan.difficulty === "hard"; return <article className={recommended ? "compare-card recommended" : "compare-card"} key={plan.id}>{recommended && <span className="recommend-flag">推薦</span>}<p>{copy.tag}</p><h3>{copy.name}</h3><span className="compare-line" /><p className="compare-desc">{copy.desc}</p><dl><div><dt>期程</dt><dd>{plan.duration_weeks} 週</dd></div><div><dt>每週</dt><dd>{plan.sessions_per_week} 次</dd></div><div><dt>投入</dt><dd>{Math.round(plan.total_minutes_per_week / 6) / 10} 小時</dd></div></dl><button className={recommended ? "primary full" : "secondary full"} onClick={() => onChoose(plan)}>{activeId === plan.id ? "目前採用" : `選擇${copy.name}`}</button></article>; })}</div></ModalShell>; }

function RevisionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (strategy: "postpone" | "reduce") => void }) { const [strategy, setStrategy] = useState<"postpone" | "reduce">("postpone"); return <ModalShell onClose={onClose}><p className="eyebrow">ADJUST, DON&apos;T ABANDON</p><h2 className="modal-title">怎麼調整比較適合？</h2><p className="modal-subtitle">已完成與錯過的紀錄都會保留，guru 只重新安排今天之後的任務。</p><div className="strategy-list"><button className={strategy === "postpone" ? "strategy active" : "strategy"} onClick={() => setStrategy("postpone")}><span>→</span><div><b>延後截止日</b><small>保留目標與每週強度，給自己多一點時間。</small></div><i>{strategy === "postpone" ? "✓" : ""}</i></button><button className={strategy === "reduce" ? "strategy active" : "strategy"} onClick={() => setStrategy("reduce")}><span>↘</span><div><b>降低目標</b><small>截止日不變，縮小任務範圍到做得到的程度。</small></div><i>{strategy === "reduce" ? "✓" : ""}</i></button></div><button className="primary full" onClick={() => onSubmit(strategy)}>讓 guru 重新安排 <span>→</span></button></ModalShell>; }

function RevisionProposalModal({ revision, onDecision, onClose }: { revision: Revision; onDecision: (decision: "accept" | "reject") => void; onClose: () => void }) {
  const changed = revision.diff.filter((item) => item.kind !== "unchanged");
  const labels: Record<string, string> = { added: "新增", moved: "移動", removed: "移除", shortened: "縮短", lengthened: "延長", reduced: "降低強度" };
  return <ModalShell onClose={onClose} wide><p className="eyebrow center">REVISION PROPOSAL</p><h2 className="modal-title center">先看差異，再決定是否套用。</h2><p className="modal-subtitle center">{revision.rationale || "guru 已依照你的策略重新安排未來任務。"}</p><div className="question-list">{changed.slice(0, 8).map((item) => <fieldset key={`${item.template_key}-${item.week_index}-${item.occurrence}`}><legend><span>{labels[item.kind] || item.kind}</span>{item.title}</legend><p>{item.before?.start_at ? `原本：${new Date(item.before.start_at).toLocaleString("zh-TW")}` : "原本沒有這項任務"}</p><p>{item.after?.start_at ? `調整後：${new Date(item.after.start_at).toLocaleString("zh-TW")}` : "調整後將移除"}</p></fieldset>)}</div><div className="form-grid"><button className="secondary full" onClick={() => onDecision("reject")}>保留原計畫</button><button className="primary full" onClick={() => onDecision("accept")}>套用調整 <span>→</span></button></div></ModalShell>;
}

function SettingsModal({ apiBase, token, setApiBase, setToken, onGoogleLogin, onSave, onClose }: { apiBase: string; token: string; setApiBase: (v: string) => void; setToken: (v: string) => void; onGoogleLogin: () => void; onSave: () => void; onClose: () => void }) { return <ModalShell onClose={onClose}><p className="eyebrow">CONNECTION</p><h2 className="modal-title">連接 guru-core</h2><p className="modal-subtitle">使用 Google 登入取得 guru-core JWT；開發環境也可以直接貼上 JWT。留白時會使用展示資料。</p><label className="field"><span>API 網址</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://api.example.com" /></label><button className="secondary full" onClick={onGoogleLogin}><span className="google-dot">G</span> 使用 Google 登入</button><label className="field"><span>Bearer JWT <i>開發用</i></span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGciOi..." /></label><p className="security-note">憑證只保存在這台裝置的瀏覽器中。</p><button className="primary full" onClick={onSave}>儲存並重新連線 <span>→</span></button></ModalShell>; }

function QuestionsModal({ questions, onSubmit, onClose }: { questions: FollowupQuestion[]; onSubmit: (answers: Record<string, string>) => void; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return <ModalShell onClose={onClose}><p className="eyebrow">A LITTLE MORE CONTEXT</p><h2 className="modal-title">再確認幾件事。</h2><p className="modal-subtitle">這些回答會讓安排更貼近生活；不確定的題目可以略過。</p><div className="question-list">{questions.map((question, index) => <fieldset key={question.id}><legend><span>0{index + 1}</span>{question.text}</legend>{question.options.map((option) => <label key={option} className={answers[question.id] === option ? "answer active" : "answer"}><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((all) => ({ ...all, [question.id]: option }))} /><span>{option}</span></label>)}{question.allow_custom && <input className="custom-answer" placeholder="或輸入自己的情況…" onChange={(e) => setAnswers((all) => ({ ...all, [question.id]: e.target.value }))} />}</fieldset>)}</div><button className="primary full" onClick={() => onSubmit(answers)}>完成並生成計畫 <span>→</span></button></ModalShell>;
}

function ManageModal({ plan, onRename, onArchive, onDelete, onClose }: { plan: Plan; onRename: (title: string) => void; onArchive: () => void; onDelete: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(plan.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return <ModalShell onClose={onClose}><p className="eyebrow">PLAN SETTINGS</p><h2 className="modal-title">管理這份計畫</h2><label className="field"><span>計畫名稱</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label><button className="primary full" disabled={!title.trim()} onClick={() => onRename(title.trim())}>儲存名稱</button><div className="manage-actions"><button onClick={onArchive}>封存計畫<span>保留資料，從主要列表隱藏</span></button>{confirmDelete ? <button className="danger" onClick={onDelete}>確認永久刪除<span>這個動作無法復原</span></button> : <button onClick={() => setConfirmDelete(true)}>刪除計畫<span>移除計畫與後續任務</span></button>}</div></ModalShell>;
}
