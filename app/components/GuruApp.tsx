"use client";

import { readPendingWork, writePendingWork } from "../lib/pending-work";

import {
  CalendarDays,
  ChartNoAxesCombined,
  ListTodo,
  Settings2,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
type Task = {
  id: string;
  title: string;
  description: string;
  time: string;
  endTime: string;
  duration: number;
  type: "session" | "habit" | "checkpoint";
  status: TaskStatus;
  color: string;
};
type Toast = { message: string; tone?: "success" | "info" | "error" } | null;

const demoPlans: Plan[] = [
  {
    id: "easy",
    title: "穩穩跑進 30 分",
    difficulty: "easy",
    duration_weeks: 15,
    start_date: "2026-09-07",
    deadline: "2026-12-20",
    goal_statement: "在 30 分鐘內跑完 5 公里。",
    sessions_per_week: 3,
    total_minutes_per_week: 105,
    completion_rate: 0.12,
    status: "draft",
  },
  {
    id: "hard",
    title: "12 週 5K 跑進 30 分",
    difficulty: "hard",
    duration_weeks: 12,
    start_date: "2026-09-07",
    deadline: "2026-11-29",
    goal_statement: "12 週後，在同一路線完成 5 公里，時間不超過 30 分鐘。",
    sessions_per_week: 4,
    total_minutes_per_week: 150,
    completion_rate: 0.12,
    status: "active",
  },
  {
    id: "extreme",
    title: "高強度 5K 突破計畫",
    difficulty: "extremely_hard",
    duration_weeks: 10,
    start_date: "2026-09-07",
    deadline: "2026-11-15",
    goal_statement: "10 週後完成 5 公里突破測驗。",
    sessions_per_week: 5,
    total_minutes_per_week: 210,
    completion_rate: 0.12,
    status: "draft",
  },
];

const initialTasks: Task[] = [
  {
    id: "t1",
    title: "輕鬆跑",
    description: "可以邊跑邊說話的配速，完成比速度重要。",
    time: "19:30",
    endTime: "20:00",
    duration: 30,
    type: "session",
    status: "pending",
    color: "mint",
  },
  {
    id: "t2",
    title: "跑後伸展",
    description: "小腿、股四頭肌與髖屈肌，各 30 秒兩組。",
    time: "20:05",
    endTime: "20:15",
    duration: 10,
    type: "habit",
    status: "pending",
    color: "lilac",
  },
];

const navItems: { key: View; label: string; icon: LucideIcon }[] = [
  { key: "today", label: "今天", icon: CalendarDays },
  { key: "plan", label: "我的計畫", icon: ListTodo },
  { key: "progress", label: "進度", icon: ChartNoAxesCombined },
];

function toDisplayTask(task: PlanTask, index: number): Task {
  const start = new Date(task.start_at);
  const end = new Date(task.end_at);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    time: task.all_day
      ? "全天"
      : start.toLocaleTimeString("zh-TW", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
    endTime: task.all_day
      ? ""
      : end.toLocaleTimeString("zh-TW", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
    duration: task.all_day
      ? 0
      : Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
    type: task.task_type,
    status: task.status,
    color: index % 2 ? "lilac" : "mint",
  };
}

function apiConfig() {
  if (typeof window === "undefined") return { base: "", token: "" };
  return {
    base: (
      localStorage.getItem("guru_api_base") ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "/api/guru"
    ).replace(/\/$/, ""),
    token: localStorage.getItem("guru_token") || "",
  };
}

export default function GuruApp() {
  const [view, setView] = useState<View>("today");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = (next: View) => {
    setView(next);
    if (window.location.hash !== `#${next}`)
      window.history.pushState({}, "", `#${next}`);
    requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"]'))
        document.getElementById("main-content")?.focus();
    });
  };
  useEffect(() => {
    const syncView = () => {
      const next = window.location.hash.slice(1);
      setView(next === "plan" || next === "progress" ? next : "today");
    };
    const timer = window.setTimeout(syncView, 0);
    window.addEventListener("popstate", syncView);
    window.addEventListener("hashchange", syncView);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", syncView);
      window.removeEventListener("hashchange", syncView);
    };
  }, []);
  const [tasks, setTasks] = useState(initialTasks);
  const [plans, setPlans] = useState(demoPlans);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const perform = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const [candidates, setCandidates] = useState(demoPlans);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planLoadFailed, setPlanLoadFailed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const checkingSessionRef = useRef(false);
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const submittingAnswersRef = useRef(false);
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
  const [generationStatus, setGenerationStatus] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);
  const [apiBase, setApiBase] = useState("");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const pendingWorkKey = useRef("");
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, string>
  >({});
  const [userEmail, setUserEmail] = useState("");
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [checkins, setCheckins] = useState<CheckinHistory | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [pendingRevision, setPendingRevision] = useState<{
    planId: string;
    id: string;
  } | null>(null);
  const [revisionChecking, setRevisionChecking] = useState(false);
  const revisionCheckingRef = useRef(false);
  const [calendarExport, setCalendarExport] = useState<{
    planId: string;
    title: string;
    status: string;
  } | null>(null);
  const [checkingExport, setCheckingExport] = useState(false);
  const checkingExportRef = useRef(false);
  const [traitId, setTraitId] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [traits, setTraits] = useState<RoleModel[]>([
    { id: "", name: "讓 guru 建議", kind: "trait", tags: [], summary: "" },
    {
      id: "demo-steady",
      name: "穩扎穩打型",
      kind: "trait",
      tags: [],
      summary: "",
    },
    {
      id: "demo-easy",
      name: "輕鬆寫意型",
      kind: "trait",
      tags: [],
      summary: "",
    },
    {
      id: "demo-intense",
      name: "地獄模式型",
      kind: "trait",
      tags: [],
      summary: "",
    },
  ]);
  const [personas, setPersonas] = useState<RoleModel[]>([
    { id: "", name: "暫時不選", kind: "persona", tags: [], summary: "" },
    {
      id: "demo-kipchoge",
      name: "Eliud Kipchoge 型",
      kind: "persona",
      tags: [],
      summary: "",
    },
    {
      id: "demo-curry",
      name: "Stephen Curry 型",
      kind: "persona",
      tags: [],
      summary: "",
    },
  ]);
  const [questions, setQuestions] = useState<FollowupQuestion[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [importIds, setImportIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importLabel, setImportLabel] = useState("");
  const planRequest = useRef(0);
  const generationSession = useRef("");
  const client = useMemo(
    () => new GuruApiClient(apiBase, token),
    [apiBase, token],
  );

  const notify = useCallback(
    (message: string, tone: "success" | "info" | "error" = "success") => {
      if (tone === "success") setErrorMessage("");
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      setToast({ message, tone });
      toastTimer.current = window.setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const reportError = useCallback(
    (error: unknown) => {
      if (error instanceof GuruApiError && error.status === 401) setShowSettings(true);
      const messages: Record<string, string> = {
        unauthorized: "登入已過期，請開啟帳號設定重新登入。",
        not_configured: "尚未連接帳號，請先完成連線設定。",
        invalid_input: "資料格式不完整，請檢查填寫內容後重試。",
        not_found: "找不到這份資料，請重新整理後再試。",
        conflict: "計畫狀態已變更，請重新整理後再試。",
        reauth_required: "日曆授權已失效，請重新連接 Google Calendar。",
        rate_limited: "操作較頻繁，請稍候再試。",
      };
      const message =
        (error instanceof GuruApiError && messages[error.code || ""]) ||
        "暫時無法完成操作，請確認連線後重試。";
      setErrorMessage(message);
      notify(message, "error");
    },
    [notify],
  );

  const loadPlanData = useCallback(
    async (apiClient: GuruApiClient, planId: string) => {
      const request = ++planRequest.current;
      setLoadingPlan(true);
      setPlanLoadFailed(false);
      setTasks([]);
      setPlanDetail(null);
      setCheckins(null);
      const today = localDate();
      try {
        const [detail, taskList, history] = await Promise.all([
          apiClient.getPlan(planId),
          apiClient.listTasks(planId, today, today),
          apiClient.listCheckins(planId),
        ]);
        if (request !== planRequest.current) return;
        setPlanDetail(detail);
        setCheckins(history);
        setTasks(taskList.items.map(toDisplayTask));
      } catch (error) {
        if (request !== planRequest.current) return;
        setPlanLoadFailed(true);
        throw error;
      } finally {
        if (request === planRequest.current) setLoadingPlan(false);
      }
    },
    [],
  );

  const importCalendar = useCallback(async (api: GuruApiClient) => {
    setImporting(true);
    setImportLabel("正在匯入日曆安排…");
    try {
      const queued = await api.importGoogleCalendar();
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const current = (await api.listImports()).find((item) => item.id === queued.id);
        if (current?.status === "parsed") {
          setImportIds((previous) => Array.from(new Set([...previous, current.id])));
          setImportLabel("Google Calendar 已加入參考資料");
          return;
        }
        if (current?.status === "failed") throw new Error("Calendar import failed");
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      setImportLabel("日曆仍在處理中，請稍後重新加入");
    } catch (error) { setImportLabel("日曆匯入未完成，請重新加入"); reportError(error); }
    finally { setImporting(false); }
  }, [reportError]);

  useEffect(() => {
    const config = apiConfig();
    const load = async () => {
      setConnecting(true);
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const oauthFlow = sessionStorage.getItem("guru_oauth_flow");
        if (url.searchParams.has("error") && oauthFlow) {
          sessionStorage.removeItem("guru_oauth_flow");
          sessionStorage.removeItem("guru_oauth_state");
          history.replaceState({}, "", `${window.location.origin}/`);
          notify("你已取消授權，原本的計畫與紀錄都會保留。", "info");
        }
        let activeToken = config.token;
        if (code && oauthFlow === "google-login") {
          const expectedState = sessionStorage.getItem("guru_oauth_state");
          if (!expectedState || url.searchParams.get("state") !== expectedState) throw new Error("OAuth state mismatch");
          const redirectUri = `${window.location.origin}/oauth/callback`;
          const login = await new GuruApiClient(config.base).loginWithGoogle(
            code,
            redirectUri,
          );
          activeToken = login.access_token;
          localStorage.setItem("guru_token", activeToken);
          setToken(activeToken);
          setUserEmail(login.email);
          sessionStorage.removeItem("guru_oauth_flow");
          sessionStorage.removeItem("guru_oauth_state");
          url.searchParams.delete("code");
          url.searchParams.delete("scope");
          url.searchParams.delete("state");
          history.replaceState({}, "", `${window.location.origin}/`);
          notify(login.is_new_user ? "帳號已建立並登入" : "已登入 guru-core");
          if (login.is_new_user) setShowCreate(true);
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
        pendingWorkKey.current = `guru_pending:${config.base}:${me.user_id}`;
        const pendingWork = readPendingWork(
          sessionStorage,
          pendingWorkKey.current,
        );
        if (pendingWork.draft) {
          const draft = pendingWork.draft;
          setGoal(draft.goal); setWeeks(draft.weeks); setCapacity(draft.capacity);
          setTraitId(draft.traitId); setPersonaId(draft.personaId); setImportIds(draft.importIds);
          setShowCreate(true);
          writePendingWork(sessionStorage, pendingWorkKey.current, { draft: undefined });
        }
        if (pendingWork.sessionId) {
          generationSession.current = pendingWork.sessionId;
          setSessionId(pendingWork.sessionId);
          setGenerationStatus("你有尚未完成的目標設定，按「查看進度」繼續。");
        }
        if (pendingWork.revision) setPendingRevision(pendingWork.revision);
        setConnected(true);
        setTraits([
          {
            id: "",
            name: "讓 guru 建議",
            kind: "trait",
            tags: [],
            summary: "",
          },
          ...roleTraits,
        ]);
        setPersonas([
          { id: "", name: "暫時不選", kind: "persona", tags: [], summary: "" },
          ...rolePersonas,
        ]);
        setPlans(nextPlans);
        const selected =
          nextPlans.find((plan) => plan.status === "active") || nextPlans[0];
        setActivePlan(selected?.id || "");
        if (!selected) {
          setTasks([]);
          setPlanDetail(null);
          setCheckins(null);
        }

        if (code && oauthFlow === "google-calendar") {
          await configuredClient.completeIntegration("google", code);
          sessionStorage.removeItem("guru_oauth_flow");
          url.searchParams.delete("code");
          url.searchParams.delete("scope");
          url.searchParams.delete("state");
          history.replaceState({}, "", `${window.location.origin}/`);
          notify("Google Calendar 已連接");
          void importCalendar(configuredClient);
        }
      } catch (error) {
        ++planRequest.current;
        setConnected(false);
        setPlans(demoPlans);
        setActivePlan("hard");
        setTasks(initialTasks);
        setPlanDetail(null);
        setCheckins(null);
        setUserEmail("");
        setLoadingPlan(false);
        setPlanLoadFailed(false);
        reportError(error);
      } finally {
        setConnecting(false);
      }
    };
    const timer = window.setTimeout(() => {
      setApiBase(config.base);
      setToken(config.token);
      if (config.base) void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [notify, reportError, importCalendar]);

  useEffect(() => {
    if (!connected || !activePlan) return;
    const timer = window.setTimeout(() => {
      void loadPlanData(client, activePlan).catch(reportError);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activePlan, client, connected, loadPlanData, reportError]);

  const completed = tasks.filter((task) => task.status === "done").length;
  const pending = tasks.filter((task) => task.status === "pending");
  const todayMinutes = pending.reduce((sum, task) => sum + task.duration, 0);
  const visiblePlans = plans.filter((plan) => plan.status !== "archived");
  const currentPlan =
    visiblePlans.find((plan) => plan.id === activePlan) || visiblePlans[0];

  const updateTaskStatus = async (task: Task, status: TaskStatus) => {
    const nextStatus: TaskStatus = task.status === status ? "pending" : status;
    const previousStatus = task.status;
    setTasks((all) =>
      all.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item,
      ),
    );
    if (!connected) {
      if (nextStatus === "done") notify(`完成「${task.title}」`);
      return;
    }
    try {
      await client.updateTask(activePlan, task.id, { status: nextStatus });
      if (nextStatus === "done") notify(`完成「${task.title}」`);
      const detail = await client.getPlan(activePlan);
      setPlanDetail(detail);
    } catch (error) {
      setTasks((all) =>
        all.map((item) =>
          item.id === task.id ? { ...item, status: previousStatus } : item,
        ),
      );
      reportError(error);
    }
  };

  const submitCheckin = async () => {
    const results = tasks
      .filter((task) => task.status !== "pending")
      .map((task) => ({ task_id: task.id, status: task.status }));
    if (!results.length) {
      notify("先記錄至少一項任務的狀態", "info");
      return;
    }
    if (!connected) {
      notify("展示模式已記錄今日回顧", "info");
      return;
    }
    try {
      await client.submitCheckin(
        activePlan,
        localDate(),
        results as Array<{
          task_id: string;
          status: "done" | "missed" | "skipped";
        }>,
      );
      setCheckins(await client.listCheckins(activePlan));
      setPlanDetail(await client.getPlan(activePlan));
      notify("今天的回顧已儲存");
    } catch (error) {
      reportError(error);
    }
  };

  const createPlan = async () => {
    if (!goal.trim()) return;
    if (generationSession.current) {
      notify("已有一份計畫正在生成", "info");
      return;
    }
    setCreating(true);
    if (!connected) {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      setCreating(false);
      setShowCreate(false);
      setShowCompare(true);
      notify("展示模式已準備三種節奏");
      return;
    }
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await client.updateProfile({ horizon: weeks, capacity }, timezone);
      const session = await client.createPlanSession({
        goal: goal.trim(),
        intake: { horizon: weeks, weekly_capacity: capacity },
        ...(traitId ? { trait_role_model_id: traitId } : {}),
        ...(personaId ? { persona_role_model_id: personaId } : {}),
        ...(importIds.length ? { import_ids: importIds } : {}),
      });
      generationSession.current = session.session_id;
      writePendingWork(sessionStorage, pendingWorkKey.current, {
        sessionId: session.session_id,
      });
      setQuestionAnswers({});
      setSessionId(session.session_id);
      setGenerationStatus("guru 正在分析目標並生成三種可執行節奏…");
      notify("目標已送出，正在準備你的計畫。", "info");
      setCreating(false);
      setShowCreate(false);
      await pollSession(session.session_id);
    } catch (error) {
      if (generationSession.current)
        setGenerationStatus("暫時無法取得進度，請按「查看進度」重試。");
      setCreating(false);
      reportError(error);
    }
  };

  const pollSession = async (id: string) => {
    if (checkingSessionRef.current) return;
    checkingSessionRef.current = true;
    setCheckingSession(true);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const state = await client.getPlanSession(id);
        if (generationSession.current !== id) return;
        if (state.status === "questioning") {
          setGenerationStatus("需要你補充幾個細節，才能繼續生成計畫。");
          setQuestions(state.questions || []);
          setShowQuestions(true);
          return;
        }
        if (state.status === "done") {
          generationSession.current = "";
          writePendingWork(sessionStorage, pendingWorkKey.current, {
            sessionId: undefined,
          });
          setGenerationStatus("");
          if (state.plans.length) {
            setCandidates(state.plans);
            setActivePlan((previous) => previous || state.plans[0].id);
            setPlans((previous) => [
              ...previous.filter(
                (plan) =>
                  !state.plans.some((candidate) => candidate.id === plan.id),
              ),
              ...state.plans,
            ]);
          }
          setShowCompare(true);
          notify("三種節奏的計畫已準備好");
          return;
        }
        if (state.status === "failed") {
          generationSession.current = "";
          writePendingWork(sessionStorage, pendingWorkKey.current, {
            sessionId: undefined,
          });
          setGenerationStatus("");
          throw new Error(state.error || "Plan generation failed");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      notify("AI 還在整理計畫，稍後再回來查看", "info");
      setGenerationStatus("生成仍在背景進行，你可以繼續使用其他頁面。");
    } finally {
      checkingSessionRef.current = false;
      setCheckingSession(false);
    }
  };

  const resumeGeneration = async () => {
    const id = generationSession.current;
    if (!id || checkingSessionRef.current) return;
    try {
      await pollSession(id);
    } catch (error) {
      reportError(error);
    }
  };

  const openComparison = async () => {
    if (!connected) {
      setCandidates(
        demoPlans.map(
          (plan) => plans.find((item) => item.id === plan.id) || plan,
        ),
      );
      setShowCompare(true);
      return;
    }
    if (!planDetail) return;
    try {
      const session = await client.getPlanSession(planDetail.session_id);
      setCandidates(session.plans);
      setShowCompare(true);
    } catch (error) {
      reportError(error);
    }
  };

  const submitAnswers = async (answers: Record<string, string>) => {
    if (submittingAnswersRef.current) return;
    submittingAnswersRef.current = true;
    setSubmittingAnswers(true);
    notify("收到，正在完成你的計畫", "info");
    try {
      await client.submitAnswers(
        sessionId,
        questions.map((question) => {
          const answer = answers[question.id]?.trim();
          if (!answer) return { question_id: question.id, skipped: true };
          return question.options.includes(answer)
            ? { question_id: question.id, choice: answer, skipped: false }
            : { question_id: question.id, custom: answer, skipped: false };
        }),
      );
      setShowQuestions(false);
      setQuestionAnswers({});
      setGenerationStatus("收到補充資訊，guru 正在完成計畫…");
      await pollSession(sessionId);
    } catch (error) {
      // The session can finish on its own while the questions are still on
      // screen. A conflict means the answers are no longer wanted, so collect
      // the plans instead of leaving the user stuck on a dead form.
      if (error instanceof GuruApiError && error.status === 409) {
        setShowQuestions(false);
        setQuestionAnswers({});
        await pollSession(sessionId).catch(reportError);
      } else {
        reportError(error);
      }
    } finally {
      submittingAnswersRef.current = false;
      setSubmittingAnswers(false);
    }
  };

  const uploadContext = async (file: File) => {
    setImportLabel(`正在讀取 ${file.name}…`);
    try {
      if (!connected) {
        setImportLabel(`${file.name} 已加入展示資料`);
        return;
      }
      const queued = await client.uploadImport(file);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const current = (await client.listImports()).find(
          (item) => item.id === queued.id,
        );
        if (current?.status === "parsed") {
          setImportIds((all) => Array.from(new Set([...all, current.id])));
          setImportLabel(`${file.name} 已解析`);
          return;
        }
        if (current?.status === "failed")
          throw new Error(current.error || "Import parsing failed");
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setImportLabel(`${file.name} 仍在解析中`);
    } catch (error) {
      setImportLabel(`${file.name} 無法匯入`);
      reportError(error);
    }
  };

  const connectCalendar = async () => {
    if (!connected) { notify("請先連接帳號，再加入日曆參考資料。", "info"); return; }
    if (importing) return;
    try {
      const integrations = await client.listIntegrations();
      if (integrations.some((item) => item.provider === "google")) { await importCalendar(client); return; }
      writePendingWork(sessionStorage, pendingWorkKey.current, { draft: { goal, weeks, capacity, traitId, personaId, importIds } });
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
      try {
        if (plan.status !== "active")
          await client.updatePlan(plan.id, { status: "active" });
        setPlans(await client.listPlans());
      } catch (error) {
        reportError(error);
        return;
      }
    }
    setActivePlan(plan.id);
    if (!connected)
      setPlans((all) =>
        all.map((item) => ({
          ...item,
          status: item.id === plan.id ? "active" : "draft",
        })),
      );
    setShowCompare(false);
    navigate("today");
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
    if (!apiBase.trim()) {
      notify("請先填入 guru-core API 網址", "info");
      return;
    }
    if (!clientId) {
      notify("尚未設定 Google Client ID", "error");
      return;
    }
    localStorage.setItem("guru_api_base", apiBase.replace(/\/$/, ""));
    const redirectUri = `${window.location.origin}/oauth/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem("guru_oauth_state", state);
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
      state,
    });
    sessionStorage.setItem("guru_oauth_flow", "google-login");
    window.location.assign(
      `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
    );
  };

  const checkCalendarExport = async (planId: string) => {
    if (checkingExportRef.current) return;
    checkingExportRef.current = true;
    setCheckingExport(true);
    try {
      const result = (await client.listExports(planId)).find(
        (item) => item.target === "google_calendar",
      );
      if (!result) {
        notify("尚未找到同步紀錄，請稍後再查看。", "info");
        return;
      }
      setCalendarExport((previous) =>
        previous?.planId === planId
          ? {
              ...previous,
              status:
                result.pending_changes > 0 && result.status === "synced"
                  ? "queued"
                  : result.status,
            }
          : previous,
      );
      if (result.status === "synced" && result.pending_changes === 0)
        notify("Google Calendar 已同步完成");
    } catch (error) {
      reportError(error);
    } finally {
      checkingExportRef.current = false;
      setCheckingExport(false);
    }
  };

  const exportPlan = async (target: "markdown" | "google_calendar") => {
    if (!connected) {
      notify("展示模式不會建立匯出檔", "info");
      return;
    }
    try {
      const result = await client.requestExport(activePlan, target);
      if (target === "markdown" && result.markdown) {
        const link = document.createElement("a");
        link.href = result.markdown.download_url;
        link.download = `${currentPlan?.title || "guru-plan"}.md`;
        link.click();
        notify("Markdown 已開始下載");
      } else {
        setCalendarExport({
          planId: activePlan,
          title: currentPlan?.title || "",
          status: "queued",
        });
        notify("同步已排入佇列，可從同步狀態查看結果。", "info");
        await checkCalendarExport(activePlan);
      }
    } catch (error) {
      reportError(error);
    }
  };

  const renamePlan = async (title: string) => {
    if (connected) {
      try {
        await client.updatePlan(activePlan, { title });
      } catch (error) {
        reportError(error);
        return;
      }
    }
    setPlans((all) =>
      all.map((plan) => (plan.id === activePlan ? { ...plan, title } : plan)),
    );
    setPlanDetail((detail) =>
      detail?.id === activePlan ? { ...detail, title } : detail,
    );
    setShowManage(false);
    notify("計畫名稱已更新");
  };

  const archivePlan = async () => {
    if (connected) {
      try {
        await client.archivePlan(activePlan);
      } catch (error) {
        reportError(error);
        return;
      }
    }
    const remaining = plans.filter(
      (plan) => plan.id !== activePlan && plan.status !== "archived",
    );
    setPlans((all) =>
      all.map((plan) =>
        plan.id === activePlan ? { ...plan, status: "archived" } : plan,
      ),
    );
    setActivePlan(remaining[0]?.id || "");
    if (!remaining.length) {
      setTasks([]);
      setPlanDetail(null);
      setCheckins(null);
    }
    setShowManage(false);
    notify("計畫已封存", "info");
  };

  const deletePlan = async () => {
    if (connected) {
      try {
        await client.deletePlan(activePlan);
      } catch (error) {
        reportError(error);
        return;
      }
    }
    const remaining = plans.filter((plan) => plan.id !== activePlan);
    setPlans(remaining);
    setActivePlan(remaining[0]?.id || "");
    if (!remaining.length) {
      ++planRequest.current;
      setTasks([]);
      setPlanDetail(null);
      setCheckins(null);
      setLoadingPlan(false);
      setPlanLoadFailed(false);
    }
    setShowManage(false);
    notify("計畫已刪除", "info");
  };

  const createRevision = async (strategy: "postpone" | "reduce") => {
    setShowRevision(false);
    if (!connected) {
      notify("展示模式不會變更後續任務", "info");
      return;
    }
    if (pendingRevision) {
      if (revision) setShowProposal(true);
      else void checkRevision(pendingRevision);
      return;
    }
    if (revisionCheckingRef.current) return;
    revisionCheckingRef.current = true;
    setRevisionChecking(true);
    try {
      const created = await client.createRevision(activePlan, strategy);
      const pending = { planId: activePlan, id: created.revision_id };
      setPendingRevision(pending);
      writePendingWork(sessionStorage, pendingWorkKey.current, {
        revision: pending,
      });
      notify("正在整理調整方案，完成後可先預覽差異。", "info");
      revisionCheckingRef.current = false;
      await checkRevision(pending);
    } catch (error) {
      reportError(error);
    } finally {
      revisionCheckingRef.current = false;
      setRevisionChecking(false);
    }
  };

  const checkRevision = async (pending: { planId: string; id: string }) => {
    if (revisionCheckingRef.current) return;
    revisionCheckingRef.current = true;
    setRevisionChecking(true);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const proposal = await client.getRevision(pending.planId, pending.id);
        if (proposal.status === "proposed") {
          setRevision(proposal);
          setShowProposal(true);
          return;
        }
        if (["failed", "accepted", "rejected"].includes(proposal.status)) {
          setPendingRevision(null);
          writePendingWork(sessionStorage, pendingWorkKey.current, {
            revision: undefined,
          });
          throw new Error(`Revision ended with status ${proposal.status}`);
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      notify("調整方案仍在產生中，請稍後再查看", "info");
    } catch (error) {
      reportError(error);
    } finally {
      revisionCheckingRef.current = false;
      setRevisionChecking(false);
    }
  };

  const decideRevision = async (decision: "accept" | "reject") => {
    if (!revision) return;
    try {
      const planId = revision.plan_id;
      await client.decideRevision(planId, revision.id, decision);
      setRevision(null);
      setShowProposal(false);
      setPendingRevision(null);
      writePendingWork(sessionStorage, pendingWorkKey.current, {
        revision: undefined,
      });
      if (activePlan === planId) await loadPlanData(client, planId);
      notify(decision === "accept" ? "已套用新的後續安排" : "已保留原本計畫");
    } catch (error) {
      reportError(error);
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳至主要內容
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("today")}
          aria-label="回到今天"
        >
          <span className="brand-mark">g</span>
          <span>guru</span>
        </button>
        <button className="new-goal" onClick={() => setShowCreate(true)}>
          <span>＋</span> 建立新目標
        </button>
        <nav aria-label="主要導覽">
          {navItems.map((item) => (
            <button
              key={item.key}
              aria-current={view === item.key ? "page" : undefined}
              className={view === item.key ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.key)}
            >
              <span className="nav-icon" aria-hidden="true">
                <item.icon size={18} />
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="connection" onClick={() => setShowSettings(true)}>
            <span className={connected ? "status-dot online" : "status-dot"} />
            <span>
              <b>{connected ? "帳號已連線" : "範例工作區"}</b>
              <small>{connected ? "資料已連接" : "登入並建立自己的計畫"}</small>
            </span>
            <span className="chevron">›</span>
          </button>
          <div className="user-card">
            <span className="avatar">
              {userEmail ? userEmail[0].toUpperCase() : "G"}
            </span>
            <span>
              <b>{userEmail || "訪客"}</b>
              <small>讓今天有進度</small>
            </span>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="開啟帳號設定"
            >
              <MoreHorizontal size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <header className="mobile-header">
          <button
            className="brand"
            onClick={() => navigate("today")}
            aria-label="回到今天"
          >
            <span className="brand-mark">g</span>
            <span>guru</span>
          </button>
          <div>
            <button
              className="mobile-settings"
              onClick={() => setShowSettings(true)}
              aria-label="連線與帳號設定"
            >
              <Settings2 size={20} aria-hidden="true" />
            </button>
            <button onClick={() => setShowCreate(true)} aria-label="建立新目標">
              ＋
            </button>
          </div>
        </header>
        <div className="workspace-bar">
          <span>
            工作區 <span aria-hidden="true"> / </span>{" "}
            <strong>{navItems.find((item) => item.key === view)?.label}</strong>
          </span>
          <span className="workspace-status">
            <span
              className={connected ? "status-dot online" : "status-dot"}
              aria-hidden="true"
            />
            {connected ? "個人計畫" : "範例預覽"}
          </span>
        </div>
        {visiblePlans.length > 0 && (
          <div className="plan-switcher">
            <label htmlFor="workspace-plan">目前計畫</label>
            <select
              id="workspace-plan"
              value={currentPlan?.id || ""}
              disabled={busy}
              onChange={(event) => {
                ++planRequest.current;
                setPlanDetail(null);
                setCheckins(null);
                setTasks(connected ? [] : initialTasks);
                setLoadingPlan(connected);
                setActivePlan(event.target.value);
              }}
            >
              {visiblePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                  {plan.status === "draft" ? " · 待啟用" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {connecting && (
          <section className="sample-banner" role="status">
            <div>
              <b>正在連接你的工作區…</b>
              <p>正在確認帳號與取得個人計畫。</p>
            </div>
          </section>
        )}
        {!connected && !connecting && (
          <section className="sample-banner" aria-label="範例模式說明">
            <div>
              <b>把目標，排進生活。</b>
              <p>
                目前是 5K 跑步範例。你可以體驗操作；登入後建立自己的計畫與紀錄。
              </p>
            </div>
            <button className="secondary" onClick={() => setShowSettings(true)}>
              連接我的帳號 <span aria-hidden="true">→</span>
            </button>
          </section>
        )}
        {connected && !currentPlan && (
          <section className="sample-banner">
            <div>
              <b>從第一個目標開始</b>
              <p>告訴 guru 你想做到什麼，再選擇適合自己的執行節奏。</p>
            </div>
            <button className="primary" onClick={() => setShowCreate(true)}>
              建立新目標
            </button>
          </section>
        )}
        {errorMessage && (
          <section className="sample-banner error-banner" role="alert">
            <p>{errorMessage}</p>
            <button className="secondary" onClick={() => setErrorMessage("")}>
              知道了
            </button>
          </section>
        )}
        {generationStatus && (
          <div className="generation-banner" role="status">
            <span className="generation-pulse" />
            <div>
              <b>計畫生成中</b>
              <small>{generationStatus}</small>
            </div>
            <button
              onClick={resumeGeneration}
              disabled={checkingSession}
              aria-label="查看生成進度"
            >
              {checkingSession ? "查看中…" : "查看進度"}
            </button>
          </div>
        )}
        {(pendingRevision || revisionChecking) && (
          <section className="sample-banner" role="status">
            <div>
              <b>調整方案{revision ? "已準備好" : "處理中"}</b>
              <p>
                {revision
                  ? "先確認所有變更，再決定是否套用。"
                  : "原本的安排仍然保留，完成後會顯示差異。"}
              </p>
            </div>
            <button
              className="secondary"
              disabled={revisionChecking}
              onClick={() =>
                revision
                  ? setShowProposal(true)
                  : pendingRevision && checkRevision(pendingRevision)
              }
            >
              {revisionChecking
                ? "正在整理…"
                : revision
                  ? "查看調整方案"
                  : "查看進度"}
            </button>
          </section>
        )}
        {calendarExport && (
          <section className="sample-banner" role="status">
            <div>
              <b>
                日曆同步 ·{" "}
                {calendarExport.status === "synced"
                  ? "已完成"
                  : calendarExport.status === "failed"
                    ? "未完成"
                    : "處理中"}
              </b>
              <p>
                {calendarExport.title} ·{" "}
                {calendarExport.status === "failed"
                  ? "請確認日曆授權，再從計畫頁重新同步。"
                  : calendarExport.status === "synced"
                    ? "任務已同步至 Google Calendar。"
                    : "已送出同步要求，完成時間取決於任務數量。"}
              </p>
            </div>
            <button
              className="secondary"
              disabled={checkingExport}
              onClick={() => checkCalendarExport(calendarExport.planId)}
            >
              {checkingExport ? "正在查看…" : "更新同步狀態"}
            </button>
          </section>
        )}
        {currentPlan?.status === "draft" && !loadingPlan && (
          <section className="sample-banner">
            <div>
              <b>這份計畫尚未啟用</b>
              <p>確認內容後啟用，開始執行每日任務。其他目標不受影響。</p>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => perform(() => choosePlan(currentPlan))}
            >
              {busy ? "正在啟用…" : "啟用這份計畫"}
            </button>
          </section>
        )}
        {(loadingPlan || planLoadFailed) && (
          <section className="page">
            <div className="panel" role="status">
              <h2>{loadingPlan ? "正在載入計畫…" : "計畫暫時無法載入"}</h2>
              <p className="empty-copy">
                {loadingPlan
                  ? "正在取得最新任務與回顧紀錄。"
                  : "請確認連線後重新載入。"}
              </p>
              {planLoadFailed && (
                <button
                  className="secondary"
                  onClick={() =>
                    loadPlanData(client, activePlan).catch(reportError)
                  }
                >
                  重新載入
                </button>
              )}
            </div>
          </section>
        )}
        {!connecting && !loadingPlan && !planLoadFailed && view === "today" && (
          <TodayView
            busy={busy}
            tasks={tasks}
            completed={completed}
            remaining={pending.length}
            minutes={todayMinutes}
            onStatus={(task, status) =>
              perform(() => updateTaskStatus(task, status))
            }
            onCheckin={() => perform(submitCheckin)}
            onRevision={() => setShowRevision(true)}
            plan={currentPlan}
            detail={planDetail}
            history={checkins}
          />
        )}
        {!connecting && !loadingPlan && !planLoadFailed && view === "plan" && (
          <PlanView
            busy={busy}
            plan={currentPlan}
            detail={planDetail}
            isDemo={!connected}
            onCompare={openComparison}
            onExport={(target) => perform(() => exportPlan(target))}
            onRevision={() => setShowRevision(true)}
            onManage={() => setShowManage(true)}
          />
        )}
        {!connecting &&
          !loadingPlan &&
          !planLoadFailed &&
          view === "progress" && (
            <ProgressView
              detail={planDetail}
              history={checkins}
              isDemo={!connected}
            />
          )}
      </main>
      <nav className="mobile-nav" aria-label="行動版導覽">
        {navItems.map((item) => (
          <button
            key={item.key}
            aria-current={view === item.key ? "page" : undefined}
            className={view === item.key ? "active" : ""}
            onClick={() => navigate(item.key)}
          >
            <span aria-hidden="true">
              <item.icon size={20} />
            </span>
            {item.label}
          </button>
        ))}
      </nav>
      {showCreate && (
        <CreateModal
          importing={importing}
          isDemo={!connected}
          goal={goal}
          setGoal={setGoal}
          weeks={weeks}
          setWeeks={setWeeks}
          capacity={capacity}
          setCapacity={setCapacity}
          traitId={traitId}
          setTraitId={setTraitId}
          personaId={personaId}
          setPersonaId={setPersonaId}
          traits={traits}
          personas={personas}
          importLabel={importLabel}
          onUpload={uploadContext}
          onCalendar={connectCalendar}
          creating={creating}
          onCreate={createPlan}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showCompare && (
        <CompareModal
          busy={busy}
          plans={candidates}
          activeId={activePlan}
          onChoose={(plan) => perform(() => choosePlan(plan))}
          onClose={() => setShowCompare(false)}
        />
      )}
      {showRevision && (
        <RevisionModal
          onClose={() => setShowRevision(false)}
          onSubmit={createRevision}
        />
      )}
      {revision && showProposal && (
        <RevisionProposalModal
          busy={busy}
          revision={revision}
          onDecision={(decision) => perform(() => decideRevision(decision))}
          onClose={() => setShowProposal(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          apiBase={apiBase}
          token={token}
          setApiBase={setApiBase}
          setToken={setToken}
          onGoogleLogin={loginWithGoogle}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showQuestions && (
        <QuestionsModal
          answers={questionAnswers}
          setAnswers={setQuestionAnswers}
          submitting={submittingAnswers}
          questions={questions}
          onSubmit={submitAnswers}
          onClose={() => {
            setShowQuestions(false);
          }}
        />
      )}
      {showManage && currentPlan && (
        <ManageModal
          busy={busy}
          plan={currentPlan}
          onRename={(title) => perform(() => renamePlan(title))}
          onArchive={() => perform(archivePlan)}
          onDelete={() => perform(deletePlan)}
          onClose={() => setShowManage(false)}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.tone || "success"}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span>
            {toast.tone === "error" ? "!" : toast.tone === "info" ? "↗" : "✓"}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function TodayView({
  busy,
  tasks,
  completed,
  remaining,
  minutes,
  onStatus,
  onCheckin,
  onRevision,
  plan,
  detail,
  history,
}: {
  busy: boolean;
  tasks: Task[];
  completed: number;
  remaining: number;
  minutes: number;
  onStatus: (task: Task, status: TaskStatus) => void;
  onCheckin: () => void;
  onRevision: () => void;
  plan?: Plan;
  detail: PlanDetail | null;
  history: CheckinHistory | null;
}) {
  const now = new Date();
  const dayProgress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const rateByDate = new Map(
    (history?.daily_rates || []).map((item) => [item.date, item.rate]),
  );
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: localDate(date),
      d: ["一", "二", "三", "四", "五", "六", "日"][index],
      n: String(date.getDate()).padStart(2, "0"),
      today: localDate(date) === localDate(now),
      done: (rateByDate.get(localDate(date)) || 0) > 0,
    };
  });
  const weekRates = weekDays
    .map((day) => rateByDate.get(day.key))
    .filter((rate): rate is number => rate !== undefined);
  const weekScore = weekRates.length
    ? Math.round(
        (weekRates.reduce((sum, rate) => sum + rate, 0) / weekRates.length) *
          100,
      )
    : 0;
  const weekIndex = detail
    ? Math.max(
        0,
        Math.floor(
          (new Date(`${localDate(now)}T00:00:00`).getTime() -
            new Date(`${detail.start_date}T00:00:00`).getTime()) /
            604800000,
        ),
      )
    : 0;
  const phase = detail?.phases.find(
    (item) => item.week_start <= weekIndex && item.week_end >= weekIndex,
  );
  const overall = Math.round(
    (detail?.progress.completion_rate ?? plan?.completion_rate ?? 0) * 100,
  );
  // Formatted by hand: Node and browser ICU disagree on the separator before the
  // weekday, which breaks hydration of the server-rendered shell.
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${"日一二三四五六"[now.getDay()]}`;
  return (
    <div className="page page-enter">
      <div className="top-row">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>今天也往前一點。</h1>
          <p className="lede">不用完美，完成眼前這一步就好。</p>
        </div>
        <div className="streak">
          <span>↗</span>
          <div>
            <b>整體達成率 {overall}%</b>
            <small>
              {detail
                ? `${detail.progress.done} / ${detail.progress.total} 項完成`
                : "展示資料"}
            </small>
          </div>
        </div>
      </div>
      <section className="week-strip" aria-label="本週日期">
        <div className="week-copy">
          <b>第 {weekIndex + 1} 週</b>
          <span>{phase?.name || "目前階段"}</span>
        </div>
        <div className="days">
          {weekDays.map((day) => (
            <div key={day.key} className={day.today ? "day today" : "day"}>
              <small>{day.d}</small>
              <span>{day.n}</span>
              {day.done && <i>✓</i>}
            </div>
          ))}
        </div>
        <div className="week-score">
          <strong>{weekScore}%</strong>
          <span>本週</span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">TODAY</p>
          <h2>今天的安排</h2>
        </div>
        <span>
          {remaining} 項 · {minutes} 分鐘
        </span>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article
            className={`task-card ${task.status === "done" ? "is-done" : ""}`}
            key={task.id}
          >
            <div className={`task-accent ${task.color}`} />
            <button
              className="check"
              disabled={busy || plan?.status !== "active"}
              aria-pressed={task.status === "done"}
              onClick={() => onStatus(task, "done")}
              aria-label={
                task.status === "done"
                  ? `取消完成 ${task.title}`
                  : `完成 ${task.title}`
              }
            >
              {task.status === "done" ? "✓" : ""}
            </button>
            <div className="task-time">
              <b>{task.time}</b>
              <span>{task.endTime}</span>
            </div>
            <div className="task-content">
              <div className="task-title-row">
                <h3>{task.title}</h3>
                <span>
                  {task.type === "habit"
                    ? "習慣"
                    : task.type === "checkpoint"
                      ? "里程碑"
                      : "訓練"}
                </span>
              </div>
              <p>{task.description}</p>
              <div className="task-actions">
                <button
                  aria-pressed={task.status === "missed"}
                  disabled={busy || plan?.status !== "active"}
                  className={task.status === "missed" ? "active missed" : ""}
                  onClick={() => onStatus(task, "missed")}
                >
                  未達
                </button>
                <button
                  aria-pressed={task.status === "skipped"}
                  disabled={busy || plan?.status !== "active"}
                  className={task.status === "skipped" ? "active" : ""}
                  onClick={() => onStatus(task, "skipped")}
                >
                  略過
                </button>
              </div>
            </div>
            <span className="task-state">
              {task.status === "missed"
                ? "✕"
                : task.status === "skipped"
                  ? "—"
                  : ""}
            </span>
          </article>
        ))}
      </div>
      {tasks.length === 0 && (
        <section className="panel empty-state">
          <h3>今天沒有排定任務</h3>
          <p>可以休息，或建立一個新的目標。</p>
        </section>
      )}
      <div className="checkin-row">
        <button
          className="primary"
          onClick={onCheckin}
          disabled={
            busy ||
            plan?.status !== "active" ||
            !tasks.some((task) => task.status !== "pending")
          }
        >
          {busy ? "正在儲存…" : "儲存今日回顧"}
        </button>
        <span>記錄會用來計算達成率與調整後續計畫。</span>
      </div>
      <section className="plan-note">
        <div className="note-icon">✦</div>
        <div>
          <p className="eyebrow">YOUR PLAN</p>
          <h3>{plan?.title || "尚未建立計畫"}</h3>
          <p>若今天的安排不合適，可以只調整之後的任務。</p>
        </div>
        {plan?.status === "active" && (
          <button className="text-button" onClick={onRevision}>
            重新排程 <span>→</span>
          </button>
        )}
      </section>
      <section className="quote">
        <p>
          已完成 {completed} / {tasks.length} 項，
          {remaining ? `還有 ${remaining} 項待執行。` : "今天沒有待辦任務。"}
        </p>
        <span>勾選任務以記錄完成，再儲存今日回顧。</span>
        <div
          className="progress-ring"
          role="img"
          aria-label={`今日完成率 ${dayProgress}%`}
          style={{ "--progress": `${dayProgress}%` } as React.CSSProperties}
        >
          <b>{dayProgress}%</b>
          <small>今日</small>
        </div>
      </section>
    </div>
  );
}

function PlanView({
  busy,
  plan,
  detail,
  isDemo,
  onCompare,
  onExport,
  onRevision,
  onManage,
}: {
  busy: boolean;
  plan?: Plan;
  detail: PlanDetail | null;
  isDemo: boolean;
  onCompare: () => void;
  onExport: (target: "markdown" | "google_calendar") => void;
  onRevision: () => void;
  onManage: () => void;
}) {
  const demoPhases = [
    {
      index: 0,
      name: "建立基礎",
      week_start: 0,
      week_end: 3,
      focus: "養成固定節奏，完成 5K 不停走",
    },
    {
      index: 1,
      name: "提升配速",
      week_start: 4,
      week_end: 9,
      focus: "加入間歇訓練，逐步接近目標配速",
    },
    {
      index: 2,
      name: "減量測驗",
      week_start: 10,
      week_end: 11,
      focus: "降低訓練量，保持狀態迎接測驗",
    },
  ];
  const phases = detail?.phases.length
    ? detail.phases
    : isDemo
      ? demoPhases
      : [];
  const progress = detail?.progress;
  const criteria = detail?.success_criteria.length
    ? detail.success_criteria
    : isDemo
      ? [
          "第 12 週完成 5K 測驗不超過 30 分鐘",
          "全程不停下步行",
          "完成至少 80% 計畫任務",
        ]
      : [];
  return (
    <div className="page page-enter">
      <div className="plan-hero">
        <div>
          <p className="eyebrow">ACTIVE PLAN</p>
          <h1>{plan?.title || "你的計畫"}</h1>
          <p className="lede">
            {detail?.goal_statement ||
              plan?.goal_statement ||
              "建立一個目標後，路線與進度會出現在這裡。"}
          </p>
        </div>
        {plan && (
          <div className="hero-actions">
            <button
              className="quiet-button"
              onClick={onManage}
              aria-label="管理計畫"
            >
              <MoreHorizontal size={20} aria-hidden="true" />
            </button>
            <button className="secondary" onClick={onCompare}>
              比較三種節奏
            </button>
            <button
              className="primary"
              disabled={plan.status !== "active"}
              onClick={onRevision}
            >
              重新排程
            </button>
          </div>
        )}
      </div>
      <div className="metrics">
        <div>
          <small>目前進度</small>
          <strong>
            {Math.round(
              (progress?.completion_rate ?? plan?.completion_rate ?? 0) * 100,
            )}
            <em>%</em>
          </strong>
          <span>
            {progress
              ? `${progress.done} / ${progress.total} 項完成`
              : "尚未開始"}
          </span>
        </div>
        <div>
          <small>每週投入</small>
          <strong>
            {Math.round((plan?.total_minutes_per_week || 0) / 6) / 10}
            <em>h</em>
          </strong>
          <span>每週 {plan?.sessions_per_week || 0} 次</span>
        </div>
        <div>
          <small>預計完成</small>
          <strong>{plan?.deadline.slice(5).replace("-", ".") || "—"}</strong>
          <span>{plan?.duration_weeks || 0} 週計畫</span>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ROADMAP</p>
            <h2>計畫路線</h2>
          </div>
          {plan && (
            <span className="pill">
              {plan.difficulty === "easy"
                ? "從容節奏"
                : plan.difficulty === "extremely_hard"
                  ? "突破節奏"
                  : "穩健節奏"}
            </span>
          )}
        </div>
        <div className="phase-list">
          {phases.map((phase, index) => {
            const phaseRate =
              progress?.phase_rates.find(
                (item) => item.phase_index === phase.index,
              )?.rate || 0;
            const pct = Math.round(phaseRate * 100);
            return (
              <div className="phase" key={`${phase.index}-${phase.name}`}>
                <div
                  className={
                    pct > 0 || index === 0
                      ? "phase-index active"
                      : "phase-index"
                  }
                >
                  {index + 1}
                </div>
                <div className="phase-copy">
                  <div>
                    <b>{phase.name}</b>
                    <span>
                      W{phase.week_start + 1}–{phase.week_end + 1}
                    </span>
                  </div>
                  <p>{phase.focus}</p>
                  <div
                    className="phase-bar"
                    role="progressbar"
                    aria-label={`${phase.name}進度`}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <strong>{pct}%</strong>
              </div>
            );
          })}
          {phases.length === 0 && (
            <p className="empty-copy">尚未有可顯示的計畫路線。</p>
          )}
        </div>
      </section>
      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SUCCESS</p>
              <h2>達成標準</h2>
            </div>
          </div>
          <ul className="criteria">
            {criteria.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item}
              </li>
            ))}
          </ul>
          {criteria.length === 0 && (
            <p className="empty-copy">計畫產生後會列出明確的達成標準。</p>
          )}
        </section>
        <section className="panel export-panel">
          <div>
            <p className="eyebrow">TAKE IT WITH YOU</p>
            <h2>同步你的計畫</h2>
            <p>將任務加入日曆，或下載文字版本。修改計畫後可再次同步。</p>
          </div>
          <button
            disabled={busy || plan?.status !== "active"}
            onClick={() => onExport("google_calendar")}
          >
            <span className="google-dot">G</span>Google Calendar <b>→</b>
          </button>
          <button
            disabled={busy || plan?.status !== "active"}
            onClick={() => onExport("markdown")}
          >
            <span className="md-dot">M↓</span>下載 Markdown <b>→</b>
          </button>
          {busy && <p role="status">正在準備匯出…</p>}
        </section>
      </div>
      <p className="plan-count">
        比較同一個目標的不同節奏，再選擇適合目前生活的安排。
      </p>
    </div>
  );
}

function ProgressView({
  detail,
  history,
  isDemo,
}: {
  detail: PlanDetail | null;
  history: CheckinHistory | null;
  isDemo: boolean;
}) {
  const recent = history?.daily_rates.slice(-7) || [];
  const bars = recent.length
    ? recent.map((item) => Math.round(item.rate * 100))
    : isDemo
      ? [38, 58, 28, 74, 55, 88, 64]
      : [0, 0, 0, 0, 0, 0, 0];
  const labels = recent.length
    ? recent.map((item) =>
        new Date(`${item.date}T12:00:00`)
          .toLocaleDateString("zh-TW", { weekday: "short" })
          .replace("週", ""),
      )
    : ["五", "六", "日", "一", "二", "三", "四"];
  const rate = Math.round((detail?.progress.completion_rate || 0) * 100);
  return (
    <div className="page page-enter">
      <div className="top-row">
        <div>
          <p className="eyebrow">YOUR MOMENTUM</p>
          <h1>進度不是直線。</h1>
          <p className="lede">每一次記錄，都讓下一步更貼近現實。</p>
        </div>
        <div className="streak">
          <span>✓</span>
          <div>
            <b>整體達成率 {rate}%</b>
            <small>
              {isDemo ? "範例資料，尚未有個人紀錄" : "來自實際任務完成紀錄"}
            </small>
          </div>
        </div>
      </div>
      <div className="metrics">
        <div>
          <small>已完成</small>
          <strong>{detail?.progress.done || 0}</strong>
          <span>個計畫任務</span>
        </div>
        <div>
          <small>未達標</small>
          <strong>{detail?.progress.missed || 0}</strong>
          <span>個計畫任務</span>
        </div>
        <div>
          <small>已回顧</small>
          <strong>
            {history?.items.length || 0}
            <em>天</em>
          </strong>
          <span>每日紀錄</span>
        </div>
      </div>
      <section className="panel chart-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">LAST 7 CHECK-INS</p>
            <h2>最近回顧完成率</h2>
          </div>
          <span className="trend">
            {isDemo ? "範例圖表" : `${recent.length} 筆紀錄`}
          </span>
        </div>
        {!isDemo && !recent.length ? (
          <p className="empty-copy">
            還沒有回顧紀錄。完成今天的任務並儲存回顧後，這裡會顯示你的進度。
          </p>
        ) : (
          <div
            className="bar-chart"
            role="img"
            aria-label={`最近七次回顧完成率：${bars.join("%、")}％`}
          >
            {bars.map((height, index) => (
              <div key={`${labels[index]}-${index}`}>
                <b className="chart-value">{height}%</b>
                <span
                  style={{ height: `${height}%` }}
                  className={index === bars.length - 1 ? "highlight" : ""}
                />
                <small>{labels[index]}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="insight">
        <div className="note-icon">✦</div>
        <div>
          <p className="eyebrow">GURU INSIGHT</p>
          <h2>
            {rate >= 80 ? "你的節奏很穩定。" : "保留紀錄，比追求完美重要。"}
          </h2>
          <p>每日回顧會成為重新排程時的依據。</p>
        </div>
      </section>
    </div>
  );
}

function ModalShell({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dismiss = useEffectEvent(onClose);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const title = dialog?.querySelector("h2");
    title?.setAttribute("id", titleId);
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(".main, .sidebar, .mobile-nav"),
    );
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (
      dialog?.querySelector<HTMLElement>("textarea, input") || focusable()[0]
    )?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => {
        element.inert = previousInert[index];
      });
      if (title?.id === titleId) title.removeAttribute("id");
      previous?.focus();
    };
  }, [titleId]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={wide ? "modal wide" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button className="modal-close" onClick={onClose} aria-label="關閉">
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}

function CreateModal({
  importing,
  isDemo,
  goal,
  setGoal,
  weeks,
  setWeeks,
  capacity,
  setCapacity,
  traitId,
  setTraitId,
  personaId,
  setPersonaId,
  traits,
  personas,
  importLabel,
  onUpload,
  onCalendar,
  creating,
  onCreate,
  onClose,
}: {
  importing: boolean;
  isDemo: boolean;
  goal: string;
  setGoal: (v: string) => void;
  weeks: string;
  setWeeks: (v: string) => void;
  capacity: string;
  setCapacity: (v: string) => void;
  traitId: string;
  setTraitId: (v: string) => void;
  personaId: string;
  setPersonaId: (v: string) => void;
  traits: RoleModel[];
  personas: RoleModel[];
  importLabel: string;
  onUpload: (file: File) => void;
  onCalendar: () => void;
  creating: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <p className="eyebrow">NEW DIRECTION</p>
      <h2 className="modal-title">你想完成什麼？</h2>
      <p className="modal-subtitle">
        {isDemo
          ? "範例預覽會展示跑步計畫的三種節奏。要依你的目標生成計畫，請先連接帳號。"
          : "寫下目標與可用時間，guru 會整理成三種執行節奏。"}
      </p>
      <ol className="journey" aria-label="建立計畫流程">
        <li aria-current="step">01 定義目標</li>
        <li>02 補充資訊</li>
        <li>03 選擇節奏</li>
      </ol>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (goal.trim() && !creating) onCreate();
        }}
      >
        <label className="field">
          <span>
            你的目標 <b>必填</b>
          </span>
          <textarea
            required
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="例如：12 週後，在 30 分鐘內跑完 5 公里"
            rows={4}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>
              希望用多久 <i>選填</i>
            </span>
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
              <option>8 週</option>
              <option>12 週</option>
              <option>16 週</option>
              <option>不確定</option>
            </select>
          </label>
          <label className="field">
            <span>
              每週可投入 <i>選填</i>
            </span>
            <select
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            >
              <option>每週 1–2 小時</option>
              <option>每週 3–4 小時</option>
              <option>每週 5 小時以上</option>
              <option>不確定</option>
            </select>
          </label>
        </div>
        <details className="optional-fields">
          <summary>個人偏好與參考資料 · 選填</summary>
          <div className="form-grid role-fields">
            <label className="field">
              <span>
                執行風格 <i>選填</i>
              </span>
              <select
                value={traitId}
                onChange={(e) => setTraitId(e.target.value)}
              >
                {traits.map((role) => (
                  <option value={role.id} key={role.id || "trait-none"}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                參考榜樣 <i>選填</i>
              </span>
              <select
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
              >
                {personas.map((role) => (
                  <option value={role.id} key={role.id || "persona-none"}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="context-tools">
            <label className="upload-button">
              <input
                type="file"
                accept=".csv,.xlsx,.md,.html,.pdf,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
              <span>↑</span>
              {importLabel || "加入參考文件"}
            </label>
            <button type="button" onClick={onCalendar}>
              <span>G</span>參考 Google Calendar
            </button>
          </div>
        </details>
        <div className="role-preview">
          <span className="role-symbol">✦</span>
          <div>
            <b>需要更多資訊時，guru 會再詢問你</b>
            <small>先生成方案，確認節奏後才開始執行。</small>
          </div>
        </div>
        <button
          className="primary full"
          disabled={!goal.trim() || creating || importing}
          type="submit"
        >
          {creating
            ? "正在理解你的目標…"
            : isDemo
              ? "預覽三種範例節奏"
              : "開始生成計畫"}
          <span>→</span>
        </button>
      </form>
    </ModalShell>
  );
}

function CompareModal({
  busy,
  plans,
  activeId,
  onChoose,
  onClose,
}: {
  busy: boolean;
  plans: Plan[];
  activeId: string;
  onChoose: (plan: Plan) => void;
  onClose: () => void;
}) {
  const labels: Record<
    Difficulty,
    { name: string; tag: string; desc: string }
  > = {
    easy: {
      name: "從容",
      tag: "可長期維持",
      desc: "壓力最低，給生活保留更多彈性。",
    },
    hard: {
      name: "穩健",
      tag: "guru 推薦",
      desc: "在挑戰與可持續之間取得平衡。",
    },
    extremely_hard: {
      name: "突破",
      tag: "高強度",
      desc: "更密集的節奏，用較短時間達標。",
    },
  };
  return (
    <ModalShell onClose={onClose} wide>
      <p className="eyebrow center">CHOOSE YOUR PACE</p>
      <h2 className="modal-title center">同一個終點，三種走法。</h2>
      <p className="modal-subtitle center">
        所有方案都有相同達成標準，差別只在投入強度與時間。
      </p>
      <div className="compare-grid">
        {plans.map((plan) => {
          const copy = labels[plan.difficulty];
          const recommended = plan.difficulty === "hard";
          const active = plan.status === "active";
          return (
            <article
              className={
                recommended ? "compare-card recommended" : "compare-card"
              }
              key={plan.id}
            >
              {recommended && <span className="recommend-flag">推薦</span>}
              <p>{copy.tag}</p>
              <h3>{copy.name}</h3>
              <span className="compare-line" />
              <p className="compare-desc">{copy.desc}</p>
              <dl>
                <div>
                  <dt>期程</dt>
                  <dd>{plan.duration_weeks} 週</dd>
                </div>
                <div>
                  <dt>每週</dt>
                  <dd>{plan.sessions_per_week} 次</dd>
                </div>
                <div>
                  <dt>投入</dt>
                  <dd>
                    {Math.round(plan.total_minutes_per_week / 6) / 10} 小時
                  </dd>
                </div>
              </dl>
              <button
                className={recommended ? "primary full" : "secondary full"}
                disabled={active || busy}
                aria-pressed={active}
                onClick={() => onChoose(plan)}
              >
                {active
                  ? activeId === plan.id
                    ? "目前採用"
                    : "已啟用"
                  : busy
                    ? "正在啟用…"
                    : `選擇${copy.name}`}
              </button>
            </article>
          );
        })}
      </div>
    </ModalShell>
  );
}

function RevisionModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (strategy: "postpone" | "reduce") => void;
}) {
  const [strategy, setStrategy] = useState<"postpone" | "reduce">("postpone");
  return (
    <ModalShell onClose={onClose}>
      <p className="eyebrow">ADJUST, DON&apos;T ABANDON</p>
      <h2 className="modal-title">怎麼調整比較適合？</h2>
      <p className="modal-subtitle">
        已完成與錯過的紀錄都會保留，guru 只重新安排今天之後的任務。
      </p>
      <div className="strategy-list">
        <button
          className={strategy === "postpone" ? "strategy active" : "strategy"}
          aria-pressed={strategy === "postpone"}
          onClick={() => setStrategy("postpone")}
        >
          <span>→</span>
          <div>
            <b>延後截止日</b>
            <small>保留目標與每週強度，給自己多一點時間。</small>
          </div>
          <i>{strategy === "postpone" ? "✓" : ""}</i>
        </button>
        <button
          className={strategy === "reduce" ? "strategy active" : "strategy"}
          aria-pressed={strategy === "reduce"}
          onClick={() => setStrategy("reduce")}
        >
          <span>↘</span>
          <div>
            <b>降低目標</b>
            <small>截止日不變，縮小任務範圍到做得到的程度。</small>
          </div>
          <i>{strategy === "reduce" ? "✓" : ""}</i>
        </button>
      </div>
      <button className="primary full" onClick={() => onSubmit(strategy)}>
        讓 guru 重新安排 <span>→</span>
      </button>
    </ModalShell>
  );
}

function RevisionProposalModal({
  busy,
  revision,
  onDecision,
  onClose,
}: {
  busy: boolean;
  revision: Revision;
  onDecision: (decision: "accept" | "reject") => void;
  onClose: () => void;
}) {
  const changed = revision.diff.filter((item) => item.kind !== "unchanged");
  const labels: Record<string, string> = {
    added: "新增",
    moved: "移動",
    removed: "移除",
    shortened: "縮短",
    lengthened: "延長",
    reduced: "降低強度",
  };
  return (
    <ModalShell onClose={onClose} wide>
      <p className="eyebrow center">REVISION PROPOSAL</p>
      <h2 className="modal-title center">先看差異，再決定是否套用。</h2>
      <p className="modal-subtitle center">
        {revision.rationale || "guru 已依照你的策略重新安排未來任務。"}
      </p>
      <div className="question-list">
        <p className="empty-copy">
          共 {changed.length} 項變更。關閉視窗後，仍可從「調整方案」重新查看。
        </p>
        {changed.map((item) => (
          <fieldset
            key={`${item.template_key}-${item.week_index}-${item.occurrence}`}
          >
            <legend>
              <span>{labels[item.kind] || item.kind}</span>
              {item.title}
            </legend>
            <p>
              {item.before?.start_at
                ? `原本：${new Date(item.before.start_at).toLocaleString("zh-TW")}`
                : "原本沒有這項任務"}
            </p>
            <p>
              {item.after?.start_at
                ? `調整後：${new Date(item.after.start_at).toLocaleString("zh-TW")}`
                : "調整後將移除"}
            </p>
          </fieldset>
        ))}
      </div>
      <div className="form-grid">
        <button
          className="secondary full"
          disabled={busy}
          onClick={() => onDecision("reject")}
        >
          保留原計畫
        </button>
        <button
          className="primary full"
          disabled={busy}
          onClick={() => onDecision("accept")}
        >
          {busy ? "正在儲存決定…" : "套用調整"} <span>→</span>
        </button>
      </div>
    </ModalShell>
  );
}

function SettingsModal({
  apiBase,
  token,
  setApiBase,
  setToken,
  onGoogleLogin,
  onSave,
  onClose,
}: {
  apiBase: string;
  token: string;
  setApiBase: (v: string) => void;
  setToken: (v: string) => void;
  onGoogleLogin: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <p className="eyebrow">CONNECTION</p>
      <h2 className="modal-title">連接你的帳號</h2>
      <p className="modal-subtitle">
        登入後，建立自己的計畫並保存每日進度。服務網址由你的管理者提供。
      </p>
      <label className="field">
        <span>服務網址</span>
        <input
          type="url"
          autoComplete="url"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder="https://api.example.com"
        />
      </label>
      <button className="secondary full" onClick={onGoogleLogin}>
        <span className="google-dot">G</span> 使用 Google 登入
      </button>
      <details className="optional-fields">
        <summary>開發者連線設定</summary>
        <label className="field">
          <span>
            Bearer JWT <i>開發用</i>
          </span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOi..."
          />
        </label>
      </details>
      <p className="security-note">憑證只保存在這台裝置的瀏覽器中。</p>
      <button className="primary full" onClick={onSave}>
        儲存並重新連線 <span>→</span>
      </button>
    </ModalShell>
  );
}

function QuestionsModal({
  answers,
  setAnswers,
  submitting,
  questions,
  onSubmit,
  onClose,
}: {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submitting: boolean;
  questions: FollowupQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <p className="eyebrow">A LITTLE MORE CONTEXT</p>
      <h2 className="modal-title">再確認幾件事。</h2>
      <p className="modal-subtitle">
        回答以下問題，讓安排更貼近生活。標示「可略過」的題目可以留白。
      </p>
      <div className="question-list">
        {questions.map((question, index) => (
          <fieldset key={question.id}>
            <legend>
              <span>0{index + 1}</span>
              {question.text}
              <span>{question.allow_skip ? "可略過" : "必填"}</span>
            </legend>
            {question.options.map((option) => (
              <label
                key={option}
                className={
                  answers[question.id] === option ? "answer active" : "answer"
                }
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answers[question.id] === option}
                  onChange={() =>
                    setAnswers((all) => ({ ...all, [question.id]: option }))
                  }
                />
                <span>{option}</span>
              </label>
            ))}
            {question.allow_custom && (
              <input
                className="custom-answer"
                aria-label={`${question.text}，自訂回答`}
                value={
                  question.options.includes(answers[question.id] || "")
                    ? ""
                    : answers[question.id] || ""
                }
                placeholder="或輸入自己的情況…"
                onChange={(e) =>
                  setAnswers((all) => ({
                    ...all,
                    [question.id]: e.target.value,
                  }))
                }
              />
            )}
          </fieldset>
        ))}
      </div>
      <button
        className="primary full"
        disabled={
          submitting ||
          questions.some(
            (question) => !question.allow_skip && !answers[question.id]?.trim(),
          )
        }
        onClick={() => onSubmit(answers)}
      >
        {submitting ? "正在送出回答…" : "完成並生成計畫"} <span>→</span>
      </button>
    </ModalShell>
  );
}

function ManageModal({
  busy,
  plan,
  onRename,
  onArchive,
  onDelete,
  onClose,
}: {
  busy: boolean;
  plan: Plan;
  onRename: (title: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(plan.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <ModalShell onClose={onClose}>
      <p className="eyebrow">PLAN SETTINGS</p>
      <h2 className="modal-title">管理這份計畫</h2>
      <label className="field">
        <span>計畫名稱</span>
        <input disabled={busy} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button
        className="primary full"
        disabled={busy || !title.trim()}
        onClick={() => onRename(title.trim())}
      >
        {busy ? "正在儲存…" : "儲存名稱"}
      </button>
      <div className="manage-actions">
        <button disabled={busy} onClick={onArchive}>
          封存計畫<span>保留資料，從主要列表隱藏</span>
        </button>
        {confirmDelete ? (
          <button className="danger" disabled={busy} onClick={onDelete}>
            確認永久刪除<span>這個動作無法復原</span>
          </button>
        ) : (
          <button disabled={busy} onClick={() => setConfirmDelete(true)}>
            刪除計畫<span>移除計畫與後續任務</span>
          </button>
        )}
      </div>
    </ModalShell>
  );
}
