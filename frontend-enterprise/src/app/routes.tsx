import { type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { EnterpriseRoute } from "../enums/routes";
import AccountsPage from "../pages/AccountsPage";
import AgentsPage from "../pages/AgentsPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import GeneralSkillsPage, {
  GeneralSkillEditPage,
  GeneralSkillNewPage,
} from "../pages/GeneralSkillsPage";
import KnowledgeManagePage, { KnowledgeAddPage } from "../pages/KnowledgePage";
import WikiPage from "../pages/WikiPage";
import ModelsPage from "../pages/ModelsPage";
import OpenPlatformPage from "../pages/OpenPlatformPage";
import SkillsPage from "../pages/SkillsPage";
import {
  ScheduledTaskEditPage,
  ScheduledTaskNewPage,
} from "../pages/dashboard/ScheduledTasksTab";
import ToolsPage, {
  McpServerEditPage,
  McpServerNewPage,
  ToolEditPage,
  ToolNewPage,
  ToolTestPage,
} from "../pages/ToolsPage";

// Gate a route element behind a permission flag, redirecting elsewhere when the
// current user is not allowed. Keeps admin-only routes declarative instead of
// each route inlining its own `isAdmin ? <Page/> : <Navigate/>` ternary.
export function ProtectedRoute({
  allow,
  redirectTo = EnterpriseRoute.Gallery,
  children,
}: {
  allow: boolean;
  redirectTo?: string;
  children: ReactElement;
}): ReactElement {
  return allow ? children : <Navigate to={redirectTo} replace />;
}

// The management shell's route table. Extracted from App.tsx so App stays an
// assembly root. Behaviour is unchanged from the previous inline <Routes>.
export function EnterpriseShellRoutes({
  isAdmin,
  onCreateAgent,
}: {
  isAdmin: boolean;
  onCreateAgent: () => void;
}) {
  return (
    <Routes>
      <Route
        path="/enterprise"
        element={<Navigate to="/enterprise/dashboard" replace />}
      />
      <Route
        path="/enterprise/platform"
        element={<OpenPlatformPage isAdmin={isAdmin} />}
      />
      <Route
        path="/enterprise/platform/:kind"
        element={<OpenPlatformPage isAdmin={isAdmin} />}
      />
      <Route
        path="/enterprise/dashboard"
        element={<DashboardPage isAdmin={isAdmin} />}
      />
      <Route
        path="/enterprise/agents"
        element={
          <AgentsPage isAdmin={isAdmin} onCreateAgent={onCreateAgent} />
        }
      />
      <Route
        path="/enterprise/memories"
        element={<DashboardPage isAdmin={isAdmin} profileTab="memories" />}
      />
      <Route path="/enterprise/knowledge" element={<KnowledgeManagePage />} />
      <Route path="/enterprise/knowledge/new" element={<KnowledgeAddPage />} />
      <Route path="/enterprise/wiki" element={<WikiPage />} />
      <Route
        path="/enterprise/feedback"
        element={<DashboardPage isAdmin={isAdmin} profileTab="logs" />}
      />
      <Route
        path="/enterprise/scheduled-tasks"
        element={<DashboardPage isAdmin={isAdmin} profileTab="scheduled" />}
      />
      <Route
        path="/enterprise/scheduled-tasks/new"
        element={<ScheduledTaskNewPage />}
      />
      <Route
        path="/enterprise/scheduled-tasks/:taskId/edit"
        element={<ScheduledTaskEditPage />}
      />
      <Route path="/enterprise/skills" element={<SkillsPage />} />
      <Route
        path="/enterprise/general-skills"
        element={<GeneralSkillsPage />}
      />
      <Route
        path="/enterprise/general-skills/new"
        element={<GeneralSkillNewPage />}
      />
      <Route
        path="/enterprise/general-skills/:slug/edit"
        element={<GeneralSkillEditPage />}
      />
      <Route
        path="/enterprise/accounts"
        element={
          <ProtectedRoute allow={isAdmin}>
            <AccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/enterprise/models"
        element={
          <ProtectedRoute allow={isAdmin}>
            <ModelsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/enterprise/tools" element={<ToolsPage />} />
      <Route path="/enterprise/tools/new" element={<ToolNewPage />} />
      <Route
        path="/enterprise/tools/mcp/new"
        element={<McpServerNewPage />}
      />
      <Route
        path="/enterprise/tools/mcp/:serverId/edit"
        element={<McpServerEditPage />}
      />
      <Route
        path="/enterprise/tools/:toolId/edit"
        element={<ToolEditPage />}
      />
      <Route
        path="/enterprise/tools/:toolId/test"
        element={<ToolTestPage />}
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
  );
}
