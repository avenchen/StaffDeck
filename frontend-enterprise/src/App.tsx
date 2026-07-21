import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { api, isAuthError, TENANT_ID } from "./api/client";
import {
  clearEnterpriseAuthSession,
  getEnterpriseAuthSession,
  isEnterpriseAdmin,
  isGalleryEmployee,
  setEnterpriseAuthSession,
  type EnterpriseAuthSession,
  type EnterpriseAuthUser,
} from "./auth";
import AppSidebar from "./components/AppSidebar";
import OnboardingGuide from "./components/OnboardingGuide";
import StaffdeckIcon from "./components/StaffdeckIcon";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EnterpriseRoute } from "./enums/routes";
import AgentCreateDialog from "./app/AgentCreateDialog";
import {
  EMPTY_AGENT_FORM,
  ENTERPRISE_SIDEBAR_STORAGE_KEY,
  MODEL_CONFIGS_UPDATED_EVENT,
  type AgentCreateFormState,
} from "./app/appTypes";
import { deriveSelectedRoute } from "./app/routeSelection";
import { AuthProvider } from "./app/AuthProvider";
import {
  employeeBlankMetadata,
  canAccessEmployeeAgent,
  canManageEmployeeAgent,
  canSelectCurrentEmployeeAgent,
  employeeDisplayName,
  employeeDisplayNameWithCreator,
  employeeProfile,
  preferredEmployeeAgent,
} from "./employee";
import AccountsPage from "./pages/AccountsPage";
import AgentsPage from "./pages/AgentsPage";
import ChatPage from "./pages/chat/ChatPage";
import ChatGalleryPage from "./pages/chat/ChatGalleryPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import EmptyEmployeeState from "./components/EmptyEmployeeState";
import DistillPage from "./pages/DistillPage";
import GeneralSkillsPage, {
  GeneralSkillEditPage,
  GeneralSkillNewPage,
} from "./pages/GeneralSkillsPage";
import KnowledgeManagePage, { KnowledgeAddPage } from "./pages/KnowledgePage";
import WikiPage from "./pages/WikiPage";
import LoginPage from "./pages/LoginPage";
import ModelsPage from "./pages/ModelsPage";
import OpenPlatformPage from "./pages/OpenPlatformPage";
import SkillsPage from "./pages/SkillsPage";
import {
  ScheduledTaskEditPage,
  ScheduledTaskNewPage,
} from "./pages/dashboard/ScheduledTasksTab";
import ToolsPage, {
  McpServerEditPage,
  McpServerNewPage,
  ToolEditPage,
  ToolNewPage,
  ToolTestPage,
} from "./pages/ToolsPage";
import { useIsMobile } from "./hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import { Button as UIButton } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { notify } from "@/components/ui/app-toast";
import {
  emitAgentScopeChange,
  ENTERPRISE_AGENT_STORAGE_KEY,
  persistSharedAgentScope,
} from "@/lib/agent-scope-storage";
import { cn } from "@/lib/utils";
import {
  SELECT_TRIGGER_CLASS,
  DIALOG_CANCEL_BUTTON_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_PRIMARY_BUTTON_CLASS,
} from "@/lib/enterprise-ui";
import type { AgentProfileRead, ModelConfigRead } from "./types";
import { useI18n } from "./i18n";

function Shell({
  auth,
  onLogout,
}: {
  auth: EnterpriseAuthSession;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(
    () => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || "",
  );
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const stored = window.localStorage.getItem(ENTERPRISE_SIDEBAR_STORAGE_KEY);
    return stored == null ? true : stored === "1";
  });
  const [agentCreateOpen, setAgentCreateOpen] = useState(false);
  const [agentForm, setAgentForm] =
    useState<AgentCreateFormState>(EMPTY_AGENT_FORM);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigRead[]>([]);
  const [modelConfigsLoaded, setModelConfigsLoaded] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = isEnterpriseAdmin(auth.user);
  const accountRoleLabel = isAdmin ? "管理員" : "";
  const isDistillRoute = location.pathname === "/enterprise/skills/distill";
  const selected = deriveSelectedRoute(location.pathname);
  const isAgentRosterRoute = location.pathname.startsWith("/enterprise/agents");
  const [lastDistillSearch, setLastDistillSearch] = useState(() =>
    isDistillRoute ? location.search : "",
  );
  const distillSearch = isDistillRoute ? location.search : lastDistillSearch;
  const distillSearchParams = useMemo(
    () => new URLSearchParams(distillSearch),
    [distillSearch],
  );

  useEffect(() => {
    if (isDistillRoute) {
      setLastDistillSearch(location.search);
    }
  }, [isDistillRoute, location.search]);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadModelConfigs = useCallback(() => {
    return api
      .get<ModelConfigRead[]>(`/api/enterprise/model-configs?tenant_id=${TENANT_ID}`)
      .then((items) => {
        setModelConfigs(items);
        setModelConfigsLoaded(true);
      })
      .catch(() => {
        setModelConfigs([]);
        setModelConfigsLoaded(false);
      });
  }, []);

  useEffect(() => {
    void loadModelConfigs();
  }, [loadModelConfigs]);

  useEffect(() => {
    const onModelConfigsUpdated = (event: Event) => {
      const rows = (event as CustomEvent<{ models?: ModelConfigRead[] }>).detail?.models;
      if (rows) {
        setModelConfigs(rows);
        setModelConfigsLoaded(true);
      } else {
        void loadModelConfigs();
      }
    };
    window.addEventListener(MODEL_CONFIGS_UPDATED_EVENT, onModelConfigsUpdated);
    return () => window.removeEventListener(MODEL_CONFIGS_UPDATED_EVENT, onModelConfigsUpdated);
  }, [loadModelConfigs]);

  // Auto-collapse the sidebar on small screens; restore the saved preference on desktop.
  useEffect(() => {
    if (isMobile) {
      setSidebarExpanded(false);
    } else {
      const stored = window.localStorage.getItem(
        ENTERPRISE_SIDEBAR_STORAGE_KEY,
      );
      setSidebarExpanded(stored == null ? true : stored === "1");
    }
  }, [isMobile]);

  useEffect(() => {
    const onAgentRefresh = () => {
      void loadAgents();
    };
    window.addEventListener(
      "ultrarag-enterprise-agent-scope-refresh",
      onAgentRefresh,
    );
    return () =>
      window.removeEventListener(
        "ultrarag-enterprise-agent-scope-refresh",
        onAgentRefresh,
      );
  }, []);

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const nextAgentId =
        (event as CustomEvent<{ agentId?: string }>).detail?.agentId ||
        window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) ||
        "";
      if (nextAgentId) {
        persistSharedAgentScope(nextAgentId, auth.user.id);
        const knownSelectableAgent = agents.some(
          (item) => item.id === nextAgentId && canUseAgentScope(item),
        );
        if (!knownSelectableAgent) void loadAgents(nextAgentId);
      }
      setSelectedAgentId(nextAgentId);
    };
    window.addEventListener(
      "ultrarag-enterprise-agent-scope-change",
      onScopeChange,
    );
    return () =>
      window.removeEventListener(
        "ultrarag-enterprise-agent-scope-change",
        onScopeChange,
      );
  }, [agents, auth.user.id]);

  useEffect(() => {
    const onCreateAgent = () => openCreateAgentModal();
    window.addEventListener("ultrarag-enterprise-agent-create", onCreateAgent);
    return () =>
      window.removeEventListener(
        "ultrarag-enterprise-agent-create",
        onCreateAgent,
      );
  }, []);

  function loadAgents(preferredAgentId = "") {
    return api
      .get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`)
      .then((rows) => {
        setAgents(rows);
        const selectableRows = rows.filter((item) => canUseAgentScope(item));
        setSelectedAgentId((current) => {
          const requestedAgentId = preferredAgentId || current;
          if (
            requestedAgentId &&
            selectableRows.some((item) => item.id === requestedAgentId)
          ) {
            persistSharedAgentScope(requestedAgentId, auth.user.id);
            return requestedAgentId;
          }
          const manageableRows = selectableRows.filter((item) =>
            canManageEmployeeAgent(item, auth.user),
          );
          const next = isAdmin
            ? preferredEmployeeAgent(selectableRows)?.id || ""
            : preferredEmployeeAgent(manageableRows)?.id ||
              preferredEmployeeAgent(selectableRows)?.id ||
              "";
          if (next) {
            persistSharedAgentScope(next, auth.user.id);
            if (next !== current) {
              emitAgentScopeChange(next);
            }
          }
          return next;
        });
      })
      .catch(() => setAgents([]))
      .finally(() => setAgentsLoaded(true));
  }

  function canUseAgentScope(agent: AgentProfileRead): boolean {
    return canSelectCurrentEmployeeAgent(agent, auth.user, { activeOnly: true });
  }

  function changeAgentScope(agentId: string) {
    setSelectedAgentId(agentId);
    persistSharedAgentScope(agentId, auth.user.id);
    emitAgentScopeChange(agentId);
  }

  function handleSidebarOpenChange(open: boolean) {
    setSidebarExpanded(open);
    window.localStorage.setItem(
      ENTERPRISE_SIDEBAR_STORAGE_KEY,
      open ? "1" : "0",
    );
  }

  const scopeAgents = agents.filter(canUseAgentScope);
  const hasUsableModelConfig = modelConfigs.some((item) => item.enabled);
  const showModelSetupNotice = modelConfigsLoaded && !hasUsableModelConfig;
  const modelSetupNoticeText = isAdmin
    ? t("還沒有可用模型配置，數字員工暫不能調用模型。請先完成模型配置。")
    : t("系統管理員尚未配置可用模型，數字員工暫不能調用模型。請聯繫管理員完成模型配置。");
  const selectedAgent = scopeAgents.find((item) => item.id === selectedAgentId);
  const sidebarAgent = selectedAgent;
  // Routes that operate on a specific employee; show the empty guide when none exist.
  const EMPLOYEE_SCOPED_PREFIXES = [
    "/enterprise/dashboard",
    "/enterprise/scheduled-tasks",
    "/enterprise/memories",
    "/enterprise/feedback",
    "/enterprise/knowledge",
    "/enterprise/general-skills",
    "/enterprise/skills",
    "/enterprise/tools",
  ];
  const hasEmployees = scopeAgents.some((item) => !item.is_overall);
  const isEmployeeScopedRoute = EMPLOYEE_SCOPED_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );
  const showEmployeeEmptyState =
    agentsLoaded && !hasEmployees && isEmployeeScopedRoute;
  const sourceAgents = agents.filter((item) =>
    canAccessEmployeeAgent(item, auth.user, {
      activeOnly: true,
      includeOverall: isAdmin,
    }),
  );
  const selectedAgentName = selectedAgent
    ? employeeDisplayName(selectedAgent)
    : "未選擇";
  const selectedAgentCaption = selectedAgent
    ? selectedAgent.is_overall
      ? "開放廣場"
      : employeeProfile(selectedAgent).roleName
    : "-";
  function openCreateAgentModal() {
    setAgentForm({
      ...EMPTY_AGENT_FORM,
      copyFromAgentId: selectedAgentId || sourceAgents[0]?.id || "",
    });
    setAgentCreateOpen(true);
  }

  async function saveAgentCreateModal() {
    const name = agentForm.name.trim();
    if (!name) {
      notify.error("請填寫數字員工姓名");
      return;
    }
    const isBlankOnboarding = agentForm.sourceMode === "blank";
    const sourceAgent = agentForm.copyFromAgentId
      ? sourceAgents.find((item) => item.id === agentForm.copyFromAgentId)
      : undefined;
    const sourceMetadata =
      !isBlankOnboarding && sourceAgent?.metadata ? sourceAgent.metadata : {};
    const sourceRoleName =
      sourceAgent && !sourceAgent.is_overall
        ? employeeProfile(sourceAgent).roleName
        : "";
    const roleName =
      agentForm.roleName.trim() ||
      (!isBlankOnboarding ? sourceRoleName : "") ||
      "待補充職位";
    const description =
      agentForm.description.trim() ||
      (!isBlankOnboarding
        ? sourceAgent?.description ||
          String(sourceMetadata.system_prompt_summary || "")
        : "") ||
      "";
    const baseMetadata = {
      ...sourceMetadata,
      system_prompt_summary: description,
      owner_user_id: auth.user.id,
      owner_username: auth.user.username,
      owner_display_name: auth.user.display_name || auth.user.username,
      created_by_user_id: auth.user.id,
      created_by_username: auth.user.username,
      created_by: auth.user.username,
      created_by_display_name: auth.user.display_name || auth.user.username,
      creator_name: auth.user.username,
      role_key: "",
      role_name: roleName,
      onboarded_at: new Date().toISOString().slice(0, 10),
      blank_onboarding: isBlankOnboarding,
    };
    try {
      const created = await api.post<AgentProfileRead>(
        "/api/enterprise/agents",
        {
          tenant_id: TENANT_ID,
          name,
          description,
          source_mode: agentForm.sourceMode,
          copy_from_agent_id:
            agentForm.sourceMode === "copy"
              ? agentForm.copyFromAgentId || undefined
              : undefined,
          metadata: isBlankOnboarding
            ? employeeBlankMetadata(baseMetadata)
            : baseMetadata,
        },
      );
      await loadAgents();
      changeAgentScope(created.id);
      setAgentCreateOpen(false);
      notify.success("數字員工創建成功");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "創建數字員工失敗");
    }
  }

  return (
    <SidebarProvider
      open={sidebarExpanded}
      onOpenChange={handleSidebarOpenChange}
      style={
        {
          "--sidebar-width": "220px",
          "--sidebar-width-icon": "72px",
        } as CSSProperties
      }
      className={`app-shell ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"} ${isAgentRosterRoute ? "is-agent-roster" : ""}`}
    >
      <AppSidebar
        selected={selected}
        onNavigate={navigate}
        isAdmin={isAdmin}
        sidebarAgent={sidebarAgent}
        scopeAgents={scopeAgents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(agentId) => {
          if (agentId !== selectedAgentId) changeAgentScope(agentId);
          navigate(EnterpriseRoute.Dashboard);
        }}
        onOpenChat={() => {
          navigate(EnterpriseRoute.Gallery);
        }}
        modelSetupAttention={isAdmin && showModelSetupNotice}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={`content flex-1 ${isDistillRoute ? "flex min-h-0 flex-col overflow-hidden p-0!" : ""} ${selected === "/enterprise/dashboard" ? "sd1-dashboard-content" : ""} ${selected !== "/enterprise/dashboard" && !isDistillRoute ? "sd1-management-content" : ""}`}
        >
          {showModelSetupNotice && (
            <div className="mx-[24px] mt-[18px] mb-[10px] flex shrink-0 flex-col items-start justify-between gap-[12px] rounded-[12px] border border-[#f3d28b] bg-[#fff8e8] px-[18px] py-[12px] text-[#6f4500] shadow-[0_8px_24px_rgba(92,62,0,0.08)] sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-[10px]">
                <span className="flex size-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#ffe7ad] text-[#8a4b00]">
                  <StaffdeckIcon name="model" className="size-[15px]" />
                </span>
                <span className="min-w-0 text-[13px] leading-[20px]">{modelSetupNoticeText}</span>
              </div>
              {isAdmin && (
                <UIButton
                  type="button"
                  size="sm"
                  onClick={() => navigate(EnterpriseRoute.Models)}
                  className="h-[32px] shrink-0 rounded-[8px] bg-[#1a71ff] px-[12px] text-[12px] text-white hover:bg-[#0f5ed7]"
                >
                  {t("去配置")}
                </UIButton>
              )}
            </div>
          )}
          <div
            className={
              isDistillRoute
                ? "persistent-distill active flex min-h-0 flex-1 flex-col"
                : "persistent-distill hidden"
            }
          >
            <DistillPage
              active={isDistillRoute}
              searchParamsOverride={distillSearchParams}
            />
          </div>
          {!isDistillRoute && showEmployeeEmptyState && (
            <EmptyEmployeeState
              isAdmin={isAdmin}
              onCreate={openCreateAgentModal}
              onBrowsePlatform={() => navigate(EnterpriseRoute.Platform)}
            />
          )}
          {!isDistillRoute && !showEmployeeEmptyState && (
            <Routes>
              <Route
                path="/enterprise"
                element={<Navigate to="/enterprise/dashboard" replace />}
              />
              <Route
                path="/enterprise/platform"
                element={
                  <OpenPlatformPage
                    isAdmin={isAdmin}
                  />
                }
              />
              <Route
                path="/enterprise/platform/:kind"
                element={
                  <OpenPlatformPage
                    isAdmin={isAdmin}
                  />
                }
              />
              <Route
                path="/enterprise/dashboard"
                element={
                  <DashboardPage
                    isAdmin={isAdmin}
                  />
                }
              />
              <Route
                path="/enterprise/agents"
                element={
                  <AgentsPage
                    isAdmin={isAdmin}
                    onCreateAgent={openCreateAgentModal}
                  />
                }
              />
              <Route
                path="/enterprise/memories"
                element={
                  <DashboardPage
                    isAdmin={isAdmin}
                    profileTab="memories"
                  />
                }
              />
              <Route
                path="/enterprise/knowledge"
                element={
                  <KnowledgeManagePage
                  />
                }
              />
              <Route
                path="/enterprise/knowledge/new"
                element={
                  <KnowledgeAddPage
                  />
                }
              />
              <Route
                path="/enterprise/wiki"
                element={
                  <WikiPage
                  />
                }
              />
              <Route
                path="/enterprise/feedback"
                element={
                  <DashboardPage
                    isAdmin={isAdmin}
                    profileTab="logs"
                  />
                }
              />
              <Route
                path="/enterprise/scheduled-tasks"
                element={
                  <DashboardPage
                    isAdmin={isAdmin}
                    profileTab="scheduled"
                  />
                }
              />
              <Route
                path="/enterprise/scheduled-tasks/new"
                element={
                  <ScheduledTaskNewPage
                  />
                }
              />
              <Route
                path="/enterprise/scheduled-tasks/:taskId/edit"
                element={
                  <ScheduledTaskEditPage
                  />
                }
              />
              <Route
                path="/enterprise/skills"
                element={
                  <SkillsPage />
                }
              />
              <Route
                path="/enterprise/general-skills"
                element={
                  <GeneralSkillsPage
                  />
                }
              />
              <Route
                path="/enterprise/general-skills/new"
                element={
                  <GeneralSkillNewPage
                  />
                }
              />
              <Route
                path="/enterprise/general-skills/:slug/edit"
                element={
                  <GeneralSkillEditPage
                  />
                }
              />
              <Route
                path="/enterprise/accounts"
                element={
                  isAdmin ? (
                    <AccountsPage />
                  ) : (
                    <Navigate to={EnterpriseRoute.Gallery} replace />
                  )
                }
              />
              <Route
                path="/enterprise/models"
                element={
                  isAdmin ? (
                    <ModelsPage />
                  ) : (
                    <Navigate to={EnterpriseRoute.Gallery} replace />
                  )
                }
              />
              <Route
                path="/enterprise/tools"
                element={
                  <ToolsPage />
                }
              />
              <Route
                path="/enterprise/tools/new"
                element={
                  <ToolNewPage />
                }
              />
              <Route
                path="/enterprise/tools/mcp/new"
                element={
                  <McpServerNewPage
                  />
                }
              />
              <Route
                path="/enterprise/tools/mcp/:serverId/edit"
                element={
                  <McpServerEditPage
                  />
                }
              />
              <Route
                path="/enterprise/tools/:toolId/edit"
                element={
                  <ToolEditPage />
                }
              />
              <Route
                path="/enterprise/tools/:toolId/test"
                element={
                  <ToolTestPage />
                }
              />
              <Route
                path="/enterprise/persona"
                element={<Navigate to="/enterprise/dashboard" replace />}
              />
              <Route
                path="*"
                element={<Navigate to="/enterprise/dashboard" replace />}
              />
            </Routes>
          )}
        </div>
      </div>
      <AgentCreateDialog
        open={agentCreateOpen}
        onOpenChange={setAgentCreateOpen}
        form={agentForm}
        onFormChange={setAgentForm}
        sourceAgents={sourceAgents}
        onSubmit={() => void saveAgentCreateModal()}
      />
    </SidebarProvider>
  );
}

function AuthedApp({
  auth,
  onLogout,
}: {
  auth: EnterpriseAuthSession;
  onLogout: () => void;
}) {
  const location = useLocation();
  if (location.pathname === "/") {
    return <Navigate to={EnterpriseRoute.Gallery} replace />;
  }
  if (location.pathname === "/chat" || location.pathname === "/chat/") {
    return <Navigate to={EnterpriseRoute.Gallery} replace />;
  }
  if (location.pathname.startsWith("/chat/draft/")) {
    const nextPath = location.pathname.replace(/^\/chat/, EnterpriseRoute.Chat);
    return <Navigate to={`${nextPath}${location.search}`} replace />;
  }
  if (location.pathname.startsWith("/chat/session_")) {
    const nextPath = location.pathname.replace(/^\/chat/, EnterpriseRoute.Chat);
    return <Navigate to={`${nextPath}${location.search}`} replace />;
  }
  if (location.pathname === "/enterprise/chat" || location.pathname === "/enterprise/chat/") {
    return <Navigate to={EnterpriseRoute.Gallery} replace />;
  }
  if (location.pathname.startsWith("/enterprise/chat/draft/")) {
    const nextPath = location.pathname.replace(/^\/enterprise\/chat/, EnterpriseRoute.Chat);
    return <Navigate to={`${nextPath}${location.search}`} replace />;
  }
  if (location.pathname.startsWith("/enterprise/chat/session_")) {
    const nextPath = location.pathname.replace(/^\/enterprise\/chat/, EnterpriseRoute.Chat);
    return <Navigate to={`${nextPath}${location.search}`} replace />;
  }
  if (location.pathname.startsWith(EnterpriseRoute.Workspace)) {
    return (
      <Routes>
        <Route
          path="/workspace"
          element={<Navigate to="/workspace/gallery" replace />}
        />
        <Route path="/workspace/gallery" element={<ChatGalleryPage />} />
        <Route path="/workspace/chat" element={<ChatPage />} />
        <Route
          path="/workspace/chat/draft/:draftAgentId"
          element={<ChatPage />}
        />
        <Route path="/workspace/chat/:sessionId" element={<ChatPage />} />
      </Routes>
    );
  }
  return <Shell auth={auth} onLogout={onLogout} />;
}

export default function App() {
  // Subscribe the application tree to locale changes so locale-sensitive dates
  // and computed labels update without remounting or losing form state.
  useI18n();
  const [auth, setAuth] = useState<EnterpriseAuthSession | null>(() =>
    getEnterpriseAuthSession(),
  );
  const [authChecked, setAuthChecked] = useState(() => !auth?.token);

  useEffect(() => {
    if (!auth?.token) {
      setAuthChecked(true);
      return undefined;
    }
    let cancelled = false;
    setAuthChecked(false);
    void api.get<EnterpriseAuthUser>("/api/auth/me")
      .then((user) => {
        if (cancelled) return;
        const refreshed = { token: auth.token, user };
        setEnterpriseAuthSession(refreshed);
        setAuth(refreshed);
        setAuthChecked(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isAuthError(error)) {
          clearEnterpriseAuthSession();
          setAuth(null);
        }
        setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  function logout() {
    clearEnterpriseAuthSession();
    setAuth(null);
    setAuthChecked(true);
  }

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/*"
            element={
              auth && !authChecked ? null : auth ? (
                <AuthProvider user={auth.user} logout={logout}>
                  <AuthedApp auth={auth} onLogout={logout} />
                </AuthProvider>
              ) : (
                <LoginPage onLogin={setAuth} />
              )
            }
          />
        </Routes>
        {auth && authChecked ? <OnboardingGuide /> : null}
      </BrowserRouter>
      <Toaster richColors closeButton position="top-center" />
    </TooltipProvider>
  );
}
