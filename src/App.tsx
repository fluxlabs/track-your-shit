// Track Your Shit - Main App Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { MainLayout } from "./components/layout/main-layout";
import { ErrorBoundary } from "./components/error-boundary";
import { TerminalProvider } from "./contexts/terminal-context";
import { Dashboard } from "./pages/dashboard";
import { useCloseWarning } from "./hooks/use-close-warning";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

// Lazy-loaded page components for route-level code splitting
const ProjectPage = lazy(() => import("./pages/project").then(m => ({ default: m.ProjectPage })));
const SettingsPage = lazy(() => import("./pages/settings").then(m => ({ default: m.SettingsPage })));
const ShellAsTerminalPage = lazy(() => import("./pages/shell").then(m => ({ default: m.ShellPage })));
const ProjectsPage = lazy(() => import("./pages/projects").then(m => ({ default: m.ProjectsPage })));
const LogsPage = lazy(() => import("./pages/logs").then(m => ({ default: m.LogsPage })));
const NotificationsPage = lazy(() => import("./pages/notifications").then(m => ({ default: m.NotificationsPage })));
const TodosPage = lazy(() => import("./pages/todos").then(m => ({ default: m.TodosPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function CloseWarningDialog() {
  const { showWarning, processInfo, handleCancel, handleForceClose } = useCloseWarning();

  if (!showWarning || !processInfo) return null;

  const totalProcesses = processInfo.active_terminals;
  const hasTerminals = processInfo.active_terminals > 0;

  let description = "You have ";
  const parts: string[] = [];
  if (hasTerminals) {
    parts.push(`${processInfo.active_terminals} active terminal session${processInfo.active_terminals > 1 ? "s" : ""}`);
  }
  description += parts.join(" and ") + ". ";
  description += "Closing the app will terminate all active processes.";

  return (
    <AlertDialog open={showWarning} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Active Processes Running</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void handleForceClose()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Close Anyway ({totalProcesses} process{totalProcesses > 1 ? "es" : ""})
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function App() {
  return (
    <ErrorBoundary label="Application">
      <TerminalProvider>
        <BrowserRouter>
          <MainLayout>
            <ErrorBoundary label="Page" inline>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectPage />} />
                  <Route path="/todos" element={<TodosPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/terminal" element={<ShellAsTerminalPage />} />
                  <Route path="/terminal/:projectId" element={<ShellAsTerminalPage />} />
                  <Route path="/logs" element={<LogsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </MainLayout>
          <CloseWarningDialog />
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "bg-background border-border text-foreground",
              duration: 8000,
            }}
          />
        </BrowserRouter>
      </TerminalProvider>
    </ErrorBoundary>
  );
}

export default App;
