"use client";

import { useEffect, useState } from "react";

type View = "today" | "plan" | "progress";
type TaskStatus = "pending" | "done" | "missed" | "skipped";
type Difficulty = "easy" | "hard" | "extremely_hard";
type Task = { id: string; title: string; description: string; time: string; endTime: string; duration: number; type: "session" | "habit" | "checkpoint"; status: TaskStatus; color: string };
type Plan = { id: string; title: string; difficulty: Difficulty; duration_weeks: number; deadline: string; sessions: number; minutes: number; status: string };
type RoleModel = { id: string; name: string; kind: "trait" | "persona"; summary?: string };
type FollowupQuestion = { id: string; text: string; options: string[]; allow_custom?: boolean; allow_skip?: boolean };
type SessionState = { status: "collecting" | "evaluating" | "questioning" | "generating" | "done" | "failed"; questions?: FollowupQuestion[]; plans?: Plan[] };
type ApiTask = { id: string; title: string; description?: string; start_at: string; end_at: string; task_type: "session" | "habit" | "checkpoint"; status: TaskStatus; template_key?: string };
type Toast = { message: string; tone?: "success" | "info" } | null;

const demoPlans: Plan[] = [
  { id: "easy", title: "穩穩跑進 30 分", difficulty: "easy", duration_weeks: 15, deadline: "2026.12.20", sessions: 3, minutes: 105, status: "draft" },
  { id: "hard", title: "12 週 5K 跑進 30 分", difficulty: "hard", duration_weeks: 12, deadline: "2026.11.29", sessions: 4, minutes: 150, status: "active" },
  { id: "extreme", title: "高強度 5K 突破計畫", difficulty: "extremely_hard", duration_weeks: 10, deadline: "2026.11.15", sessions: 5, minutes: 210, status: "draft" },
];

const initialTasks: Task[] = [
  { id: "t1", title: "輕鬆跑", description: "可以邊跑邊說話的配速，完成比速度重要。", time: "19:30", endTime: "20:00", duration: 30, type: "session", status: "pending", color: "mint" },
  { id: "t2", title: "跑後伸展", description: "小腿、股四頭肌與髖屈肌，各 30 秒兩組。", time: "20:05", endTime: "20:15", duration: 10, type: "habit", status: "pending", color: "lilac" },
];

const weekDays = [
  { d: "一", n: "07", done: true }, { d: "二", n: "08", done: true }, { d: "三", n: "09", done: false },
  { d: "四", n: "10", today: true }, { d: "五", n: "11" }, { d: "六", n: "12" }, { d: "日", n: "13" },
];

const navItems: { key: View; label: string; icon: string }[] = [
  { key: "today", label: "今天", icon: "◎" },
  { key: "plan", label: "我的計畫", icon: "▤" },
  { key: "progress", label: "進度", icon: "↗" },
];

function apiConfig() {
  if (typeof window === "undefined") return { base: "", token: "" };
  return {
    base: (localStorage.getItem("guru_api_base") || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, ""),
    token: localStorage.getItem("guru_token") || "",
  };
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { base, token } = apiConfig();
  if (!base) throw new Error("demo");
  const response = await fetch(`${base}/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
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
  const [traitId, setTraitId] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [traits, setTraits] = useState<RoleModel[]>([
    { id: "", name: "讓 guru 建議", kind: "trait" }, { id: "demo-steady", name: "穩扎穩打型", kind: "trait" }, { id: "demo-easy", name: "輕鬆寫意型", kind: "trait" }, { id: "demo-intense", name: "地獄模式型", kind: "trait" },
  ]);
  const [personas, setPersonas] = useState<RoleModel[]>([
    { id: "", name: "暫時不選", kind: "persona" }, { id: "demo-kipchoge", name: "Eliud Kipchoge 型", kind: "persona" }, { id: "demo-curry", name: "Stephen Curry 型", kind: "persona" },
  ]);
  const [questions, setQuestions] = useState<FollowupQuestion[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [importIds, setImportIds] = useState<string[]>([]);
  const [importLabel, setImportLabel] = useState("");

  useEffect(() => {
    const config = apiConfig();
    setApiBase(config.base);
    setToken(config.token);
    if (!config.base || !config.token) return;
    api<{ items?: Plan[] } | Plan[]>("/plans").then((data) => {
      const next = Array.isArray(data) ? data : data.items || [];
      if (next.length) {
        const normalized = next.map((plan) => ({ ...plan, sessions: plan.sessions || 4, minutes: plan.minutes || 150 }));
        setPlans(normalized);
        setActivePlan(normalized.find((plan) => plan.status === "active")?.id || normalized[0].id);
      }
      setConnected(true);
    }).catch(() => setConnected(false));
    const loadRoles = async (kind: "trait" | "persona") => {
      try {
        const data = await api<{ items?: RoleModel[] } | RoleModel[]>(`/role-models?kind=${kind}`);
        const items = Array.isArray(data) ? data : data.items || [];
        if (items.length) (kind === "trait" ? setTraits : setPersonas)([{ id: "", name: kind === "trait" ? "讓 guru 建議" : "暫時不選", kind }, ...items]);
      } catch {}
    };
    loadRoles("trait"); loadRoles("persona");
  }, []);

  useEffect(() => {
    if (!connected || !activePlan) return;
    const date = new Date();
    const from = new Date(date); from.setDate(from.getDate() - 3);
    const to = new Date(date); to.setDate(to.getDate() + 4);
    api<{ items?: ApiTask[] } | ApiTask[]>(`/plans/${activePlan}/tasks?from=${from.toISOString()}&to=${to.toISOString()}`).then((data) => {
      const items = Array.isArray(data) ? data : data.items || [];
      if (!items.length) return;
      setTasks(items.map((task, index) => {
        const start = new Date(task.start_at); const end = new Date(task.end_at);
        return { id: task.id, title: task.title, description: task.description || "", time: start.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }), endTime: end.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }), duration: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)), type: task.task_type, status: task.status, color: index % 2 ? "lilac" : "mint" };
      }));
    }).catch(() => {});
  }, [connected, activePlan]);

  const completed = tasks.filter((task) => task.status === "done").length;
  const todayMinutes = tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.duration, 0);
  const currentPlan = plans.find((plan) => plan.id === activePlan) || plans[1] || plans[0];

  const notify = (message: string, tone: "success" | "info" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  const updateTaskStatus = async (task: Task, status: TaskStatus) => {
    const nextStatus: TaskStatus = task.status === status ? "pending" : status;
    setTasks((all) => all.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    try { await api(`/plans/${activePlan}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }); } catch {}
    if (nextStatus === "done") notify(`完成「${task.title}」`);
  };

  const submitCheckin = async () => {
    const results = tasks.filter((task) => task.status !== "pending").map((task) => ({ task_id: task.id, status: task.status }));
    if (!results.length) { notify("先記錄至少一項任務的狀態", "info"); return; }
    try { await api(`/plans/${activePlan}/checkins`, { method: "POST", body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), results }) }); } catch {}
    notify("今天的回顧已儲存");
  };

  const createPlan = async () => {
    if (!goal.trim()) return;
    setCreating(true);
    try {
      try { await api("/profile", { method: "PUT", body: JSON.stringify({ horizon: weeks, capacity }) }); } catch {}
      const session = await api<{ session_id: string }>("/plan-sessions", { method: "POST", body: JSON.stringify({ goal: goal.trim(), ...(traitId ? { trait_role_model_id: traitId } : {}), ...(personaId ? { persona_role_model_id: personaId } : {}), ...(importIds.length ? { import_ids: importIds } : {}) }) });
      setSessionId(session.session_id);
      notify(`計畫已送出，工作編號 ${session.session_id.slice(0, 8)}`, "info");
      setCreating(false);
      setShowCreate(false);
      await pollSession(session.session_id);
      return;
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      notify("三種節奏的計畫已準備好");
    }
    setCreating(false);
    setShowCreate(false);
    setShowCompare(true);
  };

  const pollSession = async (id: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await api<SessionState>(`/plan-sessions/${id}`);
      if (state.status === "questioning") {
        setQuestions(state.questions || []);
        setShowQuestions(true);
        return;
      }
      if (state.status === "done") {
        if (state.plans?.length) {
          const normalized = state.plans.map((plan) => ({ ...plan, sessions: plan.sessions || 4, minutes: plan.minutes || 150 }));
          setPlans(normalized);
          setActivePlan(normalized.find((plan) => plan.status === "active")?.id || normalized[1]?.id || normalized[0].id);
        }
        setShowCompare(true);
        notify("三種節奏的計畫已準備好");
        return;
      }
      if (state.status === "failed") throw new Error("Plan generation failed");
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    notify("AI 還在整理計畫，稍後再回來查看", "info");
  };

  const submitAnswers = async (answers: Record<string, string>) => {
    setShowQuestions(false);
    notify("收到，正在完成你的計畫", "info");
    try {
      await api(`/plan-sessions/${sessionId}/answers`, { method: "POST", body: JSON.stringify({ answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })) }) });
      await pollSession(sessionId);
    } catch { setShowCompare(true); }
  };

  const uploadContext = async (file: File) => {
    setImportLabel(`正在讀取 ${file.name}…`);
    try {
      const signed = await api<{ import_id: string; upload_url?: string; url?: string; headers?: Record<string, string> }>("/imports/presign", { method: "POST", body: JSON.stringify({ filename: file.name, content_type: file.type || "application/octet-stream", size_bytes: file.size }) });
      const uploadUrl = signed.upload_url || signed.url;
      if (!uploadUrl) throw new Error("The upload URL is missing");
      const uploaded = await fetch(uploadUrl, { method: "PUT", headers: signed.headers, body: file });
      if (!uploaded.ok) throw new Error("Upload failed");
      await api(`/imports/${signed.import_id}/complete`, { method: "POST", body: "{}" });
      setImportIds((all) => [...all, signed.import_id]);
      setImportLabel(`${file.name} 已加入`);
    } catch {
      setImportLabel(`${file.name} 已加入展示資料`);
    }
  };

  const connectCalendar = async () => {
    try {
      const result = await api<{ authorize_url: string }>("/integrations/google/authorize");
      window.location.assign(result.authorize_url);
    } catch { notify("請先在左下角設定 guru-core 連線", "info"); }
  };

  const choosePlan = async (plan: Plan) => {
    setActivePlan(plan.id);
    setPlans((all) => all.map((item) => ({ ...item, status: item.id === plan.id ? "active" : "draft" })));
    try { await api(`/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }); } catch {}
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

  const exportPlan = async (target: "markdown" | "google_calendar") => {
    try { await api(`/plans/${activePlan}/export`, { method: "POST", body: JSON.stringify({ target }) }); } catch {}
    notify(target === "markdown" ? "Markdown 已準備下載" : "正在同步至 Google Calendar", "info");
  };

  const renamePlan = async (title: string) => {
    setPlans((all) => all.map((plan) => plan.id === activePlan ? { ...plan, title } : plan));
    try { await api(`/plans/${activePlan}`, { method: "PATCH", body: JSON.stringify({ title }) }); } catch {}
    setShowManage(false); notify("計畫名稱已更新");
  };

  const archivePlan = async () => {
    try { await api(`/plans/${activePlan}/archive`, { method: "POST", body: "{}" }); } catch {}
    setPlans((all) => all.map((plan) => plan.id === activePlan ? { ...plan, status: "archived" } : plan));
    setShowManage(false); notify("計畫已封存", "info");
  };

  const deletePlan = async () => {
    try { await api(`/plans/${activePlan}`, { method: "DELETE" }); } catch {}
    const remaining = plans.filter((plan) => plan.id !== activePlan);
    setPlans(remaining); if (remaining[0]) setActivePlan(remaining[0].id);
    setShowManage(false); notify("計畫已刪除", "info");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("today")} aria-label="回到今天"><span className="brand-mark">g</span><span>guru</span></button>
        <button className="new-goal" onClick={() => setShowCreate(true)}><span>＋</span> 建立新目標</button>
        <nav aria-label="主要導覽">{navItems.map((item) => <button key={item.key} className={view === item.key ? "nav-item active" : "nav-item"} onClick={() => setView(item.key)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-bottom">
          <button className="connection" onClick={() => setShowSettings(true)}><span className={connected ? "status-dot online" : "status-dot"} /><span><b>{connected ? "後端已連線" : "展示模式"}</b><small>{connected ? "guru-core" : "設定 API 以同步"}</small></span><span className="chevron">›</span></button>
          <div className="user-card"><span className="avatar">Y</span><span><b>Yu</b><small>讓今天有進度</small></span><button aria-label="更多選項">•••</button></div>
        </div>
      </aside>
      <main className="main">
        <header className="mobile-header"><button className="brand"><span className="brand-mark">g</span><span>guru</span></button><button onClick={() => setShowCreate(true)} aria-label="建立新目標">＋</button></header>
        {view === "today" && <TodayView tasks={tasks} completed={completed} minutes={todayMinutes} onStatus={updateTaskStatus} onCheckin={submitCheckin} onRevision={() => setShowRevision(true)} plan={currentPlan} />}
        {view === "plan" && <PlanView plan={currentPlan} plans={plans} onCompare={() => setShowCompare(true)} onExport={exportPlan} onRevision={() => setShowRevision(true)} onManage={() => setShowManage(true)} />}
        {view === "progress" && <ProgressView />}
      </main>
      <nav className="mobile-nav" aria-label="行動版導覽">{navItems.map((item) => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      {showCreate && <CreateModal goal={goal} setGoal={setGoal} weeks={weeks} setWeeks={setWeeks} capacity={capacity} setCapacity={setCapacity} traitId={traitId} setTraitId={setTraitId} personaId={personaId} setPersonaId={setPersonaId} traits={traits} personas={personas} importLabel={importLabel} onUpload={uploadContext} onCalendar={connectCalendar} creating={creating} onCreate={createPlan} onClose={() => setShowCreate(false)} />}
      {showCompare && <CompareModal plans={plans} activeId={activePlan} onChoose={choosePlan} onClose={() => setShowCompare(false)} />}
      {showRevision && <RevisionModal onClose={() => setShowRevision(false)} onSubmit={async (strategy) => { try { await api(`/plans/${activePlan}/revisions`, { method: "POST", body: JSON.stringify({ strategy }) }); } catch {}; setShowRevision(false); notify("AI 正在重新安排後續計畫", "info"); }} />}
      {showSettings && <SettingsModal apiBase={apiBase} token={token} setApiBase={setApiBase} setToken={setToken} onSave={saveSettings} onClose={() => setShowSettings(false)} />}
      {showQuestions && <QuestionsModal questions={questions} onSubmit={submitAnswers} onClose={() => setShowQuestions(false)} />}
      {showManage && currentPlan && <ManageModal plan={currentPlan} onRename={renamePlan} onArchive={archivePlan} onDelete={deletePlan} onClose={() => setShowManage(false)} />}
      {toast && <div className={`toast ${toast.tone || "success"}`} role="status"><span>{toast.tone === "info" ? "↗" : "✓"}</span>{toast.message}</div>}
    </div>
  );
}

function TodayView({ tasks, completed, minutes, onStatus, onCheckin, onRevision, plan }: { tasks: Task[]; completed: number; minutes: number; onStatus: (task: Task, status: TaskStatus) => void; onCheckin: () => void; onRevision: () => void; plan?: Plan }) {
  const dayProgress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  return <div className="page page-enter"><div className="top-row"><div><p className="eyebrow">9 月 10 日 · 星期四</p><h1>早安，Yu。</h1><p className="lede">今天不用完美，只要往前一點。</p></div><div className="streak"><span>↗</span><div><b>連續 6 天</b><small>你的最佳紀錄是 9 天</small></div></div></div><section className="week-strip" aria-label="本週日期"><div className="week-copy"><b>第 1 週</b><span>基礎期</span></div><div className="days">{weekDays.map((day) => <div key={day.n} className={day.today ? "day today" : "day"}><small>{day.d}</small><span>{day.n}</span>{day.done && <i>✓</i>}</div>)}</div><div className="week-score"><strong>42%</strong><span>本週</span></div></section><div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>今天的安排</h2></div><span>{tasks.length - completed} 項 · {minutes} 分鐘</span></div><div className="task-list">{tasks.map((task, index) => <article className={`task-card ${task.status === "done" ? "is-done" : ""}`} key={task.id}><div className={`task-accent ${task.color}`} /><button className="check" onClick={() => onStatus(task, "done")} aria-label={task.status === "done" ? `取消完成 ${task.title}` : `完成 ${task.title}`}>{task.status === "done" ? "✓" : ""}</button><div className="task-time"><b>{task.time}</b><span>{task.endTime}</span></div><div className="task-content"><div className="task-title-row"><h3>{task.title}</h3><span>{task.type === "habit" ? "習慣" : "訓練"}</span></div><p>{task.description}</p><div className="task-actions"><button className={task.status === "done" ? "active" : ""} onClick={() => onStatus(task, "done")}>完成</button><button className={task.status === "missed" ? "active missed" : ""} onClick={() => onStatus(task, "missed")}>未達</button><button className={task.status === "skipped" ? "active" : ""} onClick={() => onStatus(task, "skipped")}>略過</button></div></div><span className="task-state">{task.status === "missed" ? "✕" : task.status === "skipped" ? "—" : ""}</span><span className="task-number">0{index + 1}</span></article>)}</div><div className="checkin-row"><button className="secondary" onClick={onCheckin}>儲存今日回顧</button><span>記錄會用來計算達成率與調整後續計畫。</span></div><section className="plan-note"><div className="note-icon">✦</div><div><p className="eyebrow">YOUR PLAN</p><h3>{plan?.title || "12 週 5K 跑進 30 分"}</h3><p>你正走在軌道上。若今天的安排不合適，可以只調整之後的任務。</p></div><button className="text-button" onClick={onRevision}>重新排程 <span>→</span></button></section><section className="quote"><p>「真正的進步，是你願意在普通的一天，做一件不普通的小事。」</p><span>— 你的 guru</span><div className="progress-ring" style={{ "--progress": `${dayProgress}%` } as React.CSSProperties}><b>{dayProgress}%</b><small>今日</small></div></section></div>;
}

function PlanView({ plan, plans, onCompare, onExport, onRevision, onManage }: { plan?: Plan; plans: Plan[]; onCompare: () => void; onExport: (target: "markdown" | "google_calendar") => void; onRevision: () => void; onManage: () => void }) {
  const phases = [{ name: "建立基礎", weeks: "W1–4", progress: 28, active: true }, { name: "提升配速", weeks: "W5–10", progress: 0 }, { name: "減量測驗", weeks: "W11–12", progress: 0 }];
  return <div className="page page-enter"><div className="plan-hero"><div><p className="eyebrow">ACTIVE PLAN</p><h1>{plan?.title}</h1><p className="lede">12 週後，在同一路線完成 5 公里，時間 ≤ 30:00。</p></div><div className="hero-actions"><button className="quiet-button" onClick={onManage}>•••</button><button className="secondary" onClick={onCompare}>比較三種節奏</button><button className="primary" onClick={onRevision}>重新排程</button></div></div><div className="metrics"><div><small>目前進度</small><strong>12<em>%</em></strong><span>6 / 48 項完成</span></div><div><small>本週投入</small><strong>2.4<em>h</em></strong><span>目標 3.0 小時</span></div><div><small>預計完成</small><strong>{plan?.deadline.slice(5) || "11.29"}</strong><span>{plan?.duration_weeks || 12} 週計畫</span></div></div><section className="panel"><div className="panel-head"><div><p className="eyebrow">ROADMAP</p><h2>計畫路線</h2></div><span className="pill">穩扎穩打型</span></div><div className="phase-list">{phases.map((phase, index) => <div className="phase" key={phase.name}><div className={phase.active ? "phase-index active" : "phase-index"}>{index + 1}</div><div className="phase-copy"><div><b>{phase.name}</b><span>{phase.weeks}</span></div><p>{index === 0 ? "養成固定節奏，完成 5K 不停走" : index === 1 ? "加入間歇訓練，逐步接近目標配速" : "降低訓練量，保持狀態迎接測驗"}</p><div className="phase-bar"><i style={{ width: `${phase.progress}%` }} /></div></div><strong>{phase.progress}%</strong></div>)}</div></section><div className="two-col"><section className="panel"><div className="panel-head"><div><p className="eyebrow">SUCCESS</p><h2>達成標準</h2></div></div><ul className="criteria"><li><span>01</span>第 12 週完成 5K 測驗 ≤ 30:00</li><li><span>02</span>全程不停下步行</li><li><span>03</span>完成至少 80% 計畫任務</li></ul></section><section className="panel export-panel"><div><p className="eyebrow">TAKE IT WITH YOU</p><h2>同步你的計畫</h2><p>guru 是唯一真實來源。日曆會跟著你的調整更新。</p></div><button onClick={() => onExport("google_calendar")}><span className="google-dot">G</span>Google Calendar <b>→</b></button><button onClick={() => onExport("markdown")}><span className="md-dot">M↓</span>下載 Markdown <b>→</b></button></section></div><p className="plan-count">同一個目標共有 {plans.length} 種可選節奏，你可以隨時更換。</p></div>;
}

function ProgressView() {
  const bars = [38, 58, 28, 74, 55, 88, 64];
  return <div className="page page-enter"><div className="top-row"><div><p className="eyebrow">YOUR MOMENTUM</p><h1>進度不是直線。</h1><p className="lede">但你已經比上週更靠近目標。</p></div><div className="streak"><span>✓</span><div><b>整體達成率 84%</b><small>高於上週 7%</small></div></div></div><div className="metrics"><div><small>已完成</small><strong>12</strong><span>個計畫任務</span></div><div><small>總投入</small><strong>6.8<em>h</em></strong><span>過去 3 週</span></div><div><small>連續紀錄</small><strong>6<em>天</em></strong><span>最佳 9 天</span></div></div><section className="panel chart-panel"><div className="panel-head"><div><p className="eyebrow">LAST 7 DAYS</p><h2>每天都有留下痕跡</h2></div><span className="trend">↗ 18%</span></div><div className="bar-chart">{bars.map((height, index) => <div key={index}><span style={{ height: `${height}%` }} className={index === 5 ? "highlight" : ""} /><small>{["五", "六", "日", "一", "二", "三", "四"][index]}</small></div>)}</div></section><section className="insight"><div className="note-icon">✦</div><div><p className="eyebrow">GURU INSIGHT</p><h2>週二晚上，是你最穩定的時段。</h2><p>過去三週，你在這個時段的完成率是 100%。新的計畫調整會優先保留它。</p></div></section></div>;
}

function ModalShell({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={wide ? "modal wide" : "modal"} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="關閉">×</button>{children}</div></div>; }

function CreateModal({ goal, setGoal, weeks, setWeeks, capacity, setCapacity, traitId, setTraitId, personaId, setPersonaId, traits, personas, importLabel, onUpload, onCalendar, creating, onCreate, onClose }: { goal: string; setGoal: (v: string) => void; weeks: string; setWeeks: (v: string) => void; capacity: string; setCapacity: (v: string) => void; traitId: string; setTraitId: (v: string) => void; personaId: string; setPersonaId: (v: string) => void; traits: RoleModel[]; personas: RoleModel[]; importLabel: string; onUpload: (file: File) => void; onCalendar: () => void; creating: boolean; onCreate: () => void; onClose: () => void }) { return <ModalShell onClose={onClose}><div className="step-label"><span>01</span> / 03</div><p className="eyebrow">NEW DIRECTION</p><h2 className="modal-title">你想完成什麼？</h2><p className="modal-subtitle">只需要一個目標。其他資訊留白也沒關係，guru 會在需要時追問。</p><label className="field"><span>你的目標 <b>必填</b></span><textarea autoFocus value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="例如：12 週後，在 30 分鐘內跑完 5 公里" rows={4} /></label><div className="form-grid"><label className="field"><span>希望用多久 <i>選填</i></span><select value={weeks} onChange={(e) => setWeeks(e.target.value)}><option>8 週</option><option>12 週</option><option>16 週</option><option>不確定</option></select></label><label className="field"><span>每週可投入 <i>選填</i></span><select value={capacity} onChange={(e) => setCapacity(e.target.value)}><option>每週 1–2 小時</option><option>每週 3–4 小時</option><option>每週 5 小時以上</option><option>不確定</option></select></label></div><div className="form-grid role-fields"><label className="field"><span>執行風格 <i>選填</i></span><select value={traitId} onChange={(e) => setTraitId(e.target.value)}>{traits.map((role) => <option value={role.id} key={role.id || "trait-none"}>{role.name}</option>)}</select></label><label className="field"><span>參考榜樣 <i>選填</i></span><select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>{personas.map((role) => <option value={role.id} key={role.id || "persona-none"}>{role.name}</option>)}</select></label></div><div className="context-tools"><label className="upload-button"><input type="file" accept=".csv,.xlsx,.md,.html,.pdf,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); }} /><span>↑</span>{importLabel || "加入參考文件"}</label><button type="button" onClick={onCalendar}><span>G</span>參考 Google Calendar</button></div><div className="role-preview"><span className="role-symbol">✦</span><div><b>AI 只會追問真正缺少的資訊</b><small>最多 2 輪，每題也都可以略過</small></div></div><button className="primary full" disabled={!goal.trim() || creating} onClick={onCreate}>{creating ? "正在理解你的目標…" : "開始生成計畫"}<span>→</span></button></ModalShell>; }

function CompareModal({ plans, activeId, onChoose, onClose }: { plans: Plan[]; activeId: string; onChoose: (plan: Plan) => void; onClose: () => void }) { const labels: Record<Difficulty, { name: string; tag: string; desc: string }> = { easy: { name: "從容", tag: "可長期維持", desc: "壓力最低，給生活保留更多彈性。" }, hard: { name: "穩健", tag: "guru 推薦", desc: "在挑戰與可持續之間取得平衡。" }, extremely_hard: { name: "突破", tag: "高強度", desc: "更密集的節奏，用較短時間達標。" } }; return <ModalShell onClose={onClose} wide><p className="eyebrow center">CHOOSE YOUR PACE</p><h2 className="modal-title center">同一個終點，三種走法。</h2><p className="modal-subtitle center">所有方案都有相同達成標準，差別只在投入強度與時間。</p><div className="compare-grid">{plans.map((plan) => { const copy = labels[plan.difficulty]; const recommended = plan.difficulty === "hard"; return <article className={recommended ? "compare-card recommended" : "compare-card"} key={plan.id}>{recommended && <span className="recommend-flag">推薦</span>}<p>{copy.tag}</p><h3>{copy.name}</h3><span className="compare-line" /><p className="compare-desc">{copy.desc}</p><dl><div><dt>期程</dt><dd>{plan.duration_weeks} 週</dd></div><div><dt>每週</dt><dd>{plan.sessions} 次</dd></div><div><dt>投入</dt><dd>{Math.round(plan.minutes / 6) / 10} 小時</dd></div></dl><button className={recommended ? "primary full" : "secondary full"} onClick={() => onChoose(plan)}>{activeId === plan.id ? "目前採用" : `選擇${copy.name}`}</button></article>; })}</div></ModalShell>; }

function RevisionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (strategy: "postpone" | "reduce") => void }) { const [strategy, setStrategy] = useState<"postpone" | "reduce">("postpone"); return <ModalShell onClose={onClose}><p className="eyebrow">ADJUST, DON&apos;T ABANDON</p><h2 className="modal-title">怎麼調整比較適合？</h2><p className="modal-subtitle">已完成與錯過的紀錄都會保留，guru 只重新安排今天之後的任務。</p><div className="strategy-list"><button className={strategy === "postpone" ? "strategy active" : "strategy"} onClick={() => setStrategy("postpone")}><span>→</span><div><b>延後截止日</b><small>保留目標與每週強度，給自己多一點時間。</small></div><i>{strategy === "postpone" ? "✓" : ""}</i></button><button className={strategy === "reduce" ? "strategy active" : "strategy"} onClick={() => setStrategy("reduce")}><span>↘</span><div><b>降低目標</b><small>截止日不變，縮小任務範圍到做得到的程度。</small></div><i>{strategy === "reduce" ? "✓" : ""}</i></button></div><button className="primary full" onClick={() => onSubmit(strategy)}>讓 guru 重新安排 <span>→</span></button></ModalShell>; }

function SettingsModal({ apiBase, token, setApiBase, setToken, onSave, onClose }: { apiBase: string; token: string; setApiBase: (v: string) => void; setToken: (v: string) => void; onSave: () => void; onClose: () => void }) { return <ModalShell onClose={onClose}><p className="eyebrow">CONNECTION</p><h2 className="modal-title">連接 guru-core</h2><p className="modal-subtitle">填入後端服務網址與登入後取得的 JWT。留白時會使用展示資料，不會送出任何內容。</p><label className="field"><span>API 網址</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://api.example.com" /></label><label className="field"><span>Bearer JWT</span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGciOi..." /></label><p className="security-note">憑證只保存在這台裝置的瀏覽器中。</p><button className="primary full" onClick={onSave}>儲存並重新連線 <span>→</span></button></ModalShell>; }

function QuestionsModal({ questions, onSubmit, onClose }: { questions: FollowupQuestion[]; onSubmit: (answers: Record<string, string>) => void; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return <ModalShell onClose={onClose}><p className="eyebrow">A LITTLE MORE CONTEXT</p><h2 className="modal-title">再確認幾件事。</h2><p className="modal-subtitle">這些回答會讓安排更貼近生活；不確定的題目可以略過。</p><div className="question-list">{questions.map((question, index) => <fieldset key={question.id}><legend><span>0{index + 1}</span>{question.text}</legend>{question.options.map((option) => <label key={option} className={answers[question.id] === option ? "answer active" : "answer"}><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((all) => ({ ...all, [question.id]: option }))} /><span>{option}</span></label>)}{question.allow_custom && <input className="custom-answer" placeholder="或輸入自己的情況…" onChange={(e) => setAnswers((all) => ({ ...all, [question.id]: e.target.value }))} />}</fieldset>)}</div><button className="primary full" onClick={() => onSubmit(answers)}>完成並生成計畫 <span>→</span></button></ModalShell>;
}

function ManageModal({ plan, onRename, onArchive, onDelete, onClose }: { plan: Plan; onRename: (title: string) => void; onArchive: () => void; onDelete: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(plan.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return <ModalShell onClose={onClose}><p className="eyebrow">PLAN SETTINGS</p><h2 className="modal-title">管理這份計畫</h2><label className="field"><span>計畫名稱</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label><button className="primary full" disabled={!title.trim()} onClick={() => onRename(title.trim())}>儲存名稱</button><div className="manage-actions"><button onClick={onArchive}>封存計畫<span>保留資料，從主要列表隱藏</span></button>{confirmDelete ? <button className="danger" onClick={onDelete}>確認永久刪除<span>這個動作無法復原</span></button> : <button onClick={() => setConfirmDelete(true)}>刪除計畫<span>移除計畫與後續任務</span></button>}</div></ModalShell>;
}
